begin;

-- Manager accounts and hotels are usable immediately after email confirmation.
update public.profiles
set manager_status = 'approved',
    manager_status_reason = null
where role = 'manager';

update public.hotels
set status = 'approved',
    rejection_reason = null,
    tax_rate = 0;

alter table public.hotels
  alter column status set default 'approved',
  alter column tax_rate set default 0;

alter table public.hotels
  drop constraint if exists hotels_tax_rate_check;

alter table public.hotels
  add constraint hotels_tax_disabled check (tax_rate = 0);

alter table public.room_types
  add column if not exists image_url text
    check (
      image_url is null
      or char_length(trim(image_url)) between 8 and 2000
    );

grant update (image_url) on public.room_types to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_account_type text;
  profile_role public.user_role;
  initial_manager_status public.manager_status;
begin
  requested_account_type :=
    lower(coalesce(new.raw_user_meta_data ->> 'account_type', 'customer'));

  if requested_account_type = 'manager' then
    profile_role := 'manager';
    initial_manager_status := 'approved';
  else
    profile_role := 'customer';
    initial_manager_status := 'not_applicable';
  end if;

  insert into public.profiles (id, full_name, role, manager_status)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      'New User'
    ),
    profile_role,
    initial_manager_status
  );

  return new;
end;
$$;

create or replace function public.can_manage_hotels()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'manager'
  );
$$;

drop policy if exists hotels_manager_create_draft on public.hotels;

create policy hotels_manager_create
on public.hotels
for insert
to authenticated
with check (
  manager_id = (select auth.uid())
  and status = 'approved'
  and public.can_manage_hotels()
);

create or replace function public.create_room_type_with_inventory(
  p_hotel_id uuid,
  p_name text,
  p_description text,
  p_capacity smallint,
  p_base_price numeric,
  p_image_url text,
  p_amenity_ids smallint[],
  p_room_numbers text[]
)
returns public.room_types
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_room_type public.room_types;
  cleaned_room_numbers text[];
begin
  if not public.owns_hotel(p_hotel_id) then
    raise exception 'You do not own this hotel';
  end if;

  select array_agg(distinct trim(room_number))
  into cleaned_room_numbers
  from unnest(p_room_numbers) as room_number
  where trim(room_number) <> '';

  if coalesce(array_length(cleaned_room_numbers, 1), 0) = 0 then
    raise exception 'At least one room number is required';
  end if;

  insert into public.room_types (
    hotel_id,
    name,
    description,
    capacity,
    base_price,
    image_url,
    is_active
  )
  values (
    p_hotel_id,
    trim(p_name),
    coalesce(trim(p_description), ''),
    p_capacity,
    p_base_price,
    nullif(trim(p_image_url), ''),
    true
  )
  returning * into created_room_type;

  insert into public.room_type_amenities (room_type_id, amenity_id)
  select created_room_type.id, amenity_id
  from unnest(coalesce(p_amenity_ids, array[]::smallint[])) as amenity_id;

  insert into public.rooms (hotel_id, room_type_id, room_number)
  select p_hotel_id, created_room_type.id, room_number
  from unnest(cleaned_room_numbers) as room_number;

  return created_room_type;
end;
$$;

revoke all on function public.create_room_type_with_inventory(
  uuid,
  text,
  text,
  smallint,
  numeric,
  text,
  smallint[],
  text[]
) from public;

grant execute on function public.create_room_type_with_inventory(
  uuid,
  text,
  text,
  smallint,
  numeric,
  text,
  smallint[],
  text[]
) to authenticated;

-- Public bucket. File writes are limited to the signed-in manager's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hotel-images',
  'hotel-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy hotel_images_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'hotel-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.can_manage_hotels()
);

create policy hotel_images_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'hotel-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'hotel-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.can_manage_hotels()
);

create policy hotel_images_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'hotel-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop function if exists public.submit_hotel(uuid);
drop function if exists public.admin_update_manager_status(
  uuid,
  public.manager_status,
  text
);
drop function if exists public.admin_update_hotel_status(
  uuid,
  public.hotel_status,
  text
);

commit;
