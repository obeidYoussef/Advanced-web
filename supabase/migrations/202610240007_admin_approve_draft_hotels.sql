begin;

-- Administrators may publish a draft directly when it is ready.
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
      v_existing.status in ('draft', 'submitted')
      and p_status = 'approved'
    )
    or
    (
      v_existing.status = 'submitted'
      and p_status = 'rejected'
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
