begin;

-- Stores the reason shown when a manager application is
-- rejected or suspended.
alter table public.profiles
add column manager_status_reason text
  check (
    manager_status_reason is null
    or char_length(trim(manager_status_reason))
      between 2 and 500
  );

-- Existing admins can change user roles.
-- A manager who already owns hotels cannot be changed to another role.
create or replace function public.admin_update_user_role(
  p_user_id uuid,
  p_role public.user_role
)
returns public.profiles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_existing public.profiles%rowtype;
  v_updated public.profiles%rowtype;
  v_admin_count integer;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null or not public.is_admin() then
    raise exception 'Administrator access required'
      using errcode = '42501';
  end if;

  if p_role is null then
    raise exception 'Role is required'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User profile was not found'
      using errcode = 'P0002';
  end if;

  if v_existing.role = p_role then
    return v_existing;
  end if;

  if v_existing.role = 'manager'
    and p_role <> 'manager'
    and exists (
      select 1
      from public.hotels
      where manager_id = v_existing.id
    )
  then
    raise exception
      'A manager who owns hotels cannot change roles'
      using errcode = 'P0001';
  end if;

  if v_existing.role = 'admin'
    and p_role <> 'admin'
  then
    select count(*)::integer
    into v_admin_count
    from public.profiles
    where role = 'admin';

    if v_admin_count <= 1 then
      raise exception
        'The last administrator cannot be demoted'
        using errcode = 'P0001';
    end if;
  end if;

  update public.profiles
  set
    role = p_role,
    manager_status =
      case
        when p_role = 'manager'
          then 'pending'
        else 'not_applicable'
      end,
    manager_status_reason = null
  where id = v_existing.id
  returning *
  into v_updated;

  insert into public.audit_logs (
    actor_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_actor_id,
    'profile',
    v_updated.id,
    'profile.role_changed',
    jsonb_build_object(
      'previousRole',
      v_existing.role,
      'currentRole',
      v_updated.role
    )
  );

  return v_updated;
end;
$$;

revoke all
on function public.admin_update_user_role(
  uuid,
  public.user_role
)
from public;

grant execute
on function public.admin_update_user_role(
  uuid,
  public.user_role
)
to authenticated;

-- Approves, rejects, reopens, or suspends a manager account.
create or replace function public.admin_update_manager_status(
  p_manager_id uuid,
  p_status public.manager_status,
  p_reason text default null
)
returns public.profiles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_existing public.profiles%rowtype;
  v_updated public.profiles%rowtype;
  v_reason text;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null or not public.is_admin() then
    raise exception 'Administrator access required'
      using errcode = '42501';
  end if;

  if p_status is null
    or p_status = 'not_applicable'
  then
    raise exception 'Invalid manager status'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from public.profiles
  where id = p_manager_id
  for update;

  if not found then
    raise exception 'Manager profile was not found'
      using errcode = 'P0002';
  end if;

  if v_existing.role <> 'manager' then
    raise exception
      'The selected user is not a manager'
      using errcode = '22023';
  end if;

  if p_status in ('rejected', 'suspended') then
    v_reason := trim(coalesce(p_reason, ''));

    if char_length(v_reason) not between 2 and 500 then
      raise exception
        'A reason between 2 and 500 characters is required'
        using errcode = '22023';
    end if;
  else
    v_reason := null;
  end if;

  if v_existing.manager_status = p_status
    and v_existing.manager_status_reason
      is not distinct from v_reason
  then
    return v_existing;
  end if;

  update public.profiles
  set
    manager_status = p_status,
    manager_status_reason = v_reason
  where id = v_existing.id
  returning *
  into v_updated;

  insert into public.audit_logs (
    actor_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_actor_id,
    'profile',
    v_updated.id,
    'manager.status_changed',
    jsonb_build_object(
      'previousStatus',
      v_existing.manager_status,
      'currentStatus',
      v_updated.manager_status,
      'reason',
      v_updated.manager_status_reason
    )
  );

  return v_updated;
end;
$$;

revoke all
on function public.admin_update_manager_status(
  uuid,
  public.manager_status,
  text
)
from public;

grant execute
on function public.admin_update_manager_status(
  uuid,
  public.manager_status,
  text
)
to authenticated;

-- A manager submits a complete hotel for administrator review.
create or replace function public.submit_hotel(
  p_hotel_id uuid
)
returns public.hotels
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_existing public.hotels%rowtype;
  v_submitted public.hotels%rowtype;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select *
  into v_existing
  from public.hotels
  where id = p_hotel_id
  for update;

  if not found then
    raise exception 'Hotel was not found'
      using errcode = 'P0002';
  end if;

  if not public.owns_hotel(v_existing.id) then
    raise exception
      'You cannot submit this hotel'
      using errcode = '42501';
  end if;

  if v_existing.status = 'submitted' then
    return v_existing;
  end if;

  if v_existing.status not in ('draft', 'rejected') then
    raise exception
      'Only draft or rejected hotels can be submitted'
      using errcode = 'P0001';
  end if;

  if char_length(trim(v_existing.description)) < 20 then
    raise exception
      'Hotel description must contain at least 20 characters'
      using errcode = 'P0001';
  end if;

  if v_existing.latitude is null
    or v_existing.longitude is null
  then
    raise exception
      'Hotel map coordinates are required'
      using errcode = 'P0001';
  end if;

  if char_length(
    trim(coalesce(v_existing.contact_email, ''))
  ) < 5 then
    raise exception
      'Hotel contact email is required'
      using errcode = 'P0001';
  end if;

  if v_existing.cover_image_url is null
    and not exists (
      select 1
      from public.hotel_images
      where hotel_id = v_existing.id
    )
  then
    raise exception
      'At least one hotel image is required'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.hotel_facilities
    where hotel_id = v_existing.id
  ) then
    raise exception
      'At least one hotel facility is required'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.room_types
    join public.rooms
      on rooms.room_type_id = room_types.id
      and rooms.hotel_id = room_types.hotel_id
    where room_types.hotel_id = v_existing.id
      and room_types.is_active
      and rooms.status = 'active'
  ) then
    raise exception
      'At least one active room type and physical room are required'
      using errcode = 'P0001';
  end if;

  update public.hotels
  set
    status = 'submitted',
    rejection_reason = null
  where id = v_existing.id
  returning *
  into v_submitted;

  insert into public.audit_logs (
    actor_id,
    hotel_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_actor_id,
    v_submitted.id,
    'hotel',
    v_submitted.id,
    'hotel.submitted',
    jsonb_build_object(
      'previousStatus',
      v_existing.status,
      'currentStatus',
      v_submitted.status
    )
  );

  return v_submitted;
end;
$$;

revoke all
on function public.submit_hotel(uuid)
from public;

grant execute
on function public.submit_hotel(uuid)
to authenticated;

-- Valid hotel transitions:
-- submitted -> approved
-- submitted -> rejected
-- approved -> suspended
-- suspended -> approved
create or replace function public.admin_update_hotel_status(
  p_hotel_id uuid,
  p_status public.hotel_status,
  p_reason text default null
)
returns public.hotels
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_existing public.hotels%rowtype;
  v_updated public.hotels%rowtype;
  v_reason text;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null or not public.is_admin() then
    raise exception 'Administrator access required'
      using errcode = '42501';
  end if;

  select *
  into v_existing
  from public.hotels
  where id = p_hotel_id
  for update;

  if not found then
    raise exception 'Hotel was not found'
      using errcode = 'P0002';
  end if;

  if p_status is null then
    raise exception 'Hotel status is required'
      using errcode = '22023';
  end if;

  if v_existing.status = p_status then
    return v_existing;
  end if;

  if not (
    (
      v_existing.status = 'submitted'
      and p_status in ('approved', 'rejected')
    )
    or
    (
      v_existing.status = 'approved'
      and p_status = 'suspended'
    )
    or
    (
      v_existing.status = 'suspended'
      and p_status = 'approved'
    )
  ) then
    raise exception
      'Invalid hotel status transition from % to %',
      v_existing.status,
      p_status
      using errcode = 'P0001';
  end if;

  if p_status in ('rejected', 'suspended') then
    v_reason := trim(coalesce(p_reason, ''));

    if char_length(v_reason) not between 2 and 500 then
      raise exception
        'A reason between 2 and 500 characters is required'
        using errcode = '22023';
    end if;
  else
    v_reason := null;

    if not exists (
      select 1
      from public.profiles
      where id = v_existing.manager_id
        and role = 'manager'
        and manager_status = 'approved'
    ) then
      raise exception
        'The hotel manager must be approved'
        using errcode = 'P0001';
    end if;
  end if;

  update public.hotels
  set
    status = p_status,
    rejection_reason = v_reason
  where id = v_existing.id
  returning *
  into v_updated;

  insert into public.audit_logs (
    actor_id,
    hotel_id,
    entity_type,
    entity_id,
    action,
    details
  )
  values (
    v_actor_id,
    v_updated.id,
    'hotel',
    v_updated.id,
    'hotel.status_changed',
    jsonb_build_object(
      'previousStatus',
      v_existing.status,
      'currentStatus',
      v_updated.status,
      'reason',
      v_updated.rejection_reason
    )
  );

  return v_updated;
end;
$$;

revoke all
on function public.admin_update_hotel_status(
  uuid,
  public.hotel_status,
  text
)
from public;

grant execute
on function public.admin_update_hotel_status(
  uuid,
  public.hotel_status,
  text
)
to authenticated;

commit;