begin;

-- UUID generation.
create extension if not exists pgcrypto;

-- Roles needed by the complete application.
create type public.user_role as enum (
  'customer',
  'manager',
  'admin'
);

create type public.manager_status as enum (
  'not_applicable',
  'pending',
  'approved',
  'rejected',
  'suspended'
);

create type public.hotel_status as enum (
  'draft',
  'submitted',
  'approved',
  'rejected',
  'suspended'
);

create type public.room_status as enum (
  'active',
  'maintenance',
  'inactive'
);

-- Public information connected to Supabase Auth users.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null
    check (char_length(trim(full_name)) between 2 and 100),
  phone text,
  role public.user_role not null default 'customer',
  manager_status public.manager_status not null default 'not_applicable',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A manager can own multiple hotels.
create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.profiles(id) on delete restrict,
  name text not null
    check (char_length(trim(name)) between 2 and 150),
  description text not null default '',
  country text not null
    check (char_length(trim(country)) between 2 and 100),
  city text not null
    check (char_length(trim(city)) between 2 and 100),
  address text not null
    check (char_length(trim(address)) between 5 and 250),
  latitude numeric(9, 6)
    check (latitude between -90 and 90),
  longitude numeric(9, 6)
    check (longitude between -180 and 180),
  cover_image_url text,
  contact_email text,
  contact_phone text,
  currency char(3) not null default 'USD',
  tax_rate numeric(5, 2) not null default 0
    check (tax_rate between 0 and 100),
  service_fee numeric(12, 2) not null default 0
    check (service_fee >= 0),
  status public.hotel_status not null default 'draft',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The customer chooses a room type rather than a physical room number.
create table public.room_types (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  name text not null
    check (char_length(trim(name)) between 2 and 100),
  description text not null default '',
  capacity smallint not null
    check (capacity between 1 and 20),
  base_price numeric(12, 2) not null
    check (base_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Required by the composite foreign key on physical rooms.
  constraint room_types_id_hotel_unique unique (id, hotel_id)
);

-- Individual physical rooms used later for conflict-safe reservations.
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  room_type_id uuid not null,
  room_number text not null
    check (char_length(trim(room_number)) between 1 and 30),
  status public.room_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rooms_room_type_hotel_fk
    foreign key (room_type_id, hotel_id)
    references public.room_types(id, hotel_id)
    on delete restrict,

  constraint rooms_hotel_number_unique
    unique (hotel_id, room_number)
);

-- Prevent duplicate names while ignoring uppercase/lowercase differences.
create unique index hotels_manager_name_city_unique
  on public.hotels (
    manager_id,
    lower(name),
    lower(city)
  );

create unique index room_types_hotel_name_unique
  on public.room_types (
    hotel_id,
    lower(name)
  );

-- Indexes used by ownership checks and future searches.
create index hotels_manager_id_index
  on public.hotels(manager_id);

create index hotels_public_search_index
  on public.hotels(status, country, city);

create index room_types_hotel_id_index
  on public.room_types(hotel_id);

create index rooms_hotel_id_index
  on public.rooms(hotel_id);

create index rooms_room_type_id_index
  on public.rooms(room_type_id);

-- Reusable timestamp trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger hotels_set_updated_at
before update on public.hotels
for each row execute function public.set_updated_at();

create trigger room_types_set_updated_at
before update on public.room_types
for each row execute function public.set_updated_at();

create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

-- Automatically create a profile after Supabase Auth registration.
-- "admin" is deliberately impossible through public registration.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_account_type text;
  profile_role public.user_role;
  approval_status public.manager_status;
begin
  requested_account_type :=
    lower(coalesce(new.raw_user_meta_data ->> 'account_type', 'customer'));

  if requested_account_type = 'manager' then
    profile_role := 'manager';
    approval_status := 'pending';
  else
    profile_role := 'customer';
    approval_status := 'not_applicable';
  end if;

  insert into public.profiles (
    id,
    full_name,
    role,
    manager_status
  )
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      'New User'
    ),
    profile_role,
    approval_status
  );

  return new;
end;
$$;

create trigger create_profile_after_signup
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Security helpers used by several RLS policies.
create or replace function public.is_admin()
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
      and role = 'admin'
  );
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
      and manager_status = 'approved'
  );
$$;

create or replace function public.owns_hotel(requested_hotel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.hotels
    where id = requested_hotel_id
      and manager_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.can_manage_hotels() from public;
revoke all on function public.owns_hotel(uuid) from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_manage_hotels() to authenticated;
grant execute on function public.owns_hotel(uuid) to authenticated;

-- Enable database-level authorization.
alter table public.profiles enable row level security;
alter table public.hotels enable row level security;
alter table public.room_types enable row level security;
alter table public.rooms enable row level security;

-- Remove broad default permissions first.
revoke all on public.profiles from anon, authenticated;
revoke all on public.hotels from anon, authenticated;
revoke all on public.room_types from anon, authenticated;
revoke all on public.rooms from anon, authenticated;

-- Profiles: users may read their own profile and edit safe fields only.
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create policy profiles_select_own_or_admin
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.is_admin()
);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Hotels: public users see approved hotels.
-- Managers see and manage only their own hotels.
grant select on public.hotels to anon, authenticated;
grant insert on public.hotels to authenticated;

grant update (
  name,
  description,
  country,
  city,
  address,
  latitude,
  longitude,
  cover_image_url,
  contact_email,
  contact_phone,
  currency,
  tax_rate,
  service_fee
) on public.hotels to authenticated;

create policy hotels_public_read_approved
on public.hotels
for select
to anon, authenticated
using (status = 'approved');

create policy hotels_manager_read_own
on public.hotels
for select
to authenticated
using (
  manager_id = (select auth.uid())
  or public.is_admin()
);

create policy hotels_manager_create_draft
on public.hotels
for insert
to authenticated
with check (
  manager_id = (select auth.uid())
  and status = 'draft'
  and public.can_manage_hotels()
);

create policy hotels_manager_update_own
on public.hotels
for update
to authenticated
using (
  public.owns_hotel(id)
  or public.is_admin()
)
with check (
  (
    manager_id = (select auth.uid())
    and public.can_manage_hotels()
  )
  or public.is_admin()
);

-- Room types: public users see active types belonging to approved hotels.
grant select on public.room_types to anon, authenticated;
grant insert on public.room_types to authenticated;

grant update (
  name,
  description,
  capacity,
  base_price,
  is_active
) on public.room_types to authenticated;

create policy room_types_public_read
on public.room_types
for select
to anon, authenticated
using (
  is_active
  and exists (
    select 1
    from public.hotels
    where hotels.id = room_types.hotel_id
      and hotels.status = 'approved'
  )
);

create policy room_types_manager_read
on public.room_types
for select
to authenticated
using (
  public.owns_hotel(hotel_id)
  or public.is_admin()
);

create policy room_types_manager_create
on public.room_types
for insert
to authenticated
with check (
  public.owns_hotel(hotel_id)
  or public.is_admin()
);

create policy room_types_manager_update
on public.room_types
for update
to authenticated
using (
  public.owns_hotel(hotel_id)
  or public.is_admin()
)
with check (
  public.owns_hotel(hotel_id)
  or public.is_admin()
);

-- Physical room numbers are private hotel operational information.
grant select, insert on public.rooms to authenticated;

grant update (
  room_type_id,
  room_number,
  status
) on public.rooms to authenticated;

create policy rooms_manager_read
on public.rooms
for select
to authenticated
using (
  public.owns_hotel(hotel_id)
  or public.is_admin()
);

create policy rooms_manager_create
on public.rooms
for insert
to authenticated
with check (
  public.owns_hotel(hotel_id)
  or public.is_admin()
);

create policy rooms_manager_update
on public.rooms
for update
to authenticated
using (
  public.owns_hotel(hotel_id)
  or public.is_admin()
)
with check (
  public.owns_hotel(hotel_id)
  or public.is_admin()
);

commit;