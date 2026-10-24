begin;

-- Managers may process exceptional cancellations after the
-- customer cancellation deadline, but must provide a reason.
create or replace function public.manager_cancel_reservation(
  p_reservation_id uuid,
  p_reason text
)
returns public.reservations
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_actor_role public.user_role;
  v_existing public.reservations%rowtype;
  v_cancelled public.reservations%rowtype;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_reason, '')))
    not between 2 and 500
  then
    raise exception
      'Cancellation reason must contain between 2 and 500 characters'
      using errcode = '22023';
  end if;

  select role
  into v_actor_role
  from public.profiles
  where id = v_actor_id;

  select *
  into v_existing
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'Reservation was not found'
      using errcode = 'P0002';
  end if;

  if not (
    public.owns_hotel(v_existing.hotel_id)
    or public.is_admin()
  ) then
    raise exception
      'You cannot manage this reservation'
      using errcode = '42501';
  end if;

  if v_existing.status = 'cancelled' then
    return v_existing;
  end if;

  if v_existing.status <> 'confirmed' then
    raise exception
      'Only confirmed reservations can be cancelled'
      using errcode = 'P0001';
  end if;

  update public.reservations
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = v_actor_id,
    cancellation_reason = trim(p_reason)
  where id = v_existing.id
  returning *
  into v_cancelled;

  insert into public.notification_outbox (
    reservation_id,
    notification_type,
    recipient_email
  )
  values (
    v_cancelled.id,
    'reservation_cancelled',
    v_cancelled.primary_guest_email
  );

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
    v_cancelled.hotel_id,
    'reservation',
    v_cancelled.id,
    'reservation.cancelled_by_management',
    jsonb_build_object(
      'actorRole',
      v_actor_role,
      'confirmationNumber',
      v_cancelled.confirmation_number,
      'reason',
      v_cancelled.cancellation_reason
    )
  );

  return v_cancelled;
end;
$$;

revoke all
on function public.manager_cancel_reservation(
  uuid,
  text
)
from public;

grant execute
on function public.manager_cancel_reservation(
  uuid,
  text
)
to authenticated;

-- Allowed operational transitions:
-- confirmed -> checked_in
-- confirmed -> no_show
-- checked_in -> completed
create or replace function public.update_reservation_status(
  p_reservation_id uuid,
  p_status public.reservation_status
)
returns public.reservations
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_existing public.reservations%rowtype;
  v_updated public.reservations%rowtype;
  v_hotel_today date;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select *
  into v_existing
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'Reservation was not found'
      using errcode = 'P0002';
  end if;

  if not (
    public.owns_hotel(v_existing.hotel_id)
    or public.is_admin()
  ) then
    raise exception
      'You cannot manage this reservation'
      using errcode = '42501';
  end if;

  if p_status is null then
    raise exception 'Reservation status is required'
      using errcode = '22023';
  end if;

  -- Makes retries safe.
  if v_existing.status = p_status then
    return v_existing;
  end if;

  if p_status not in (
    'checked_in',
    'completed',
    'no_show'
  ) then
    raise exception
      'Use the cancellation operation to cancel a reservation'
      using errcode = '22023';
  end if;

  select
    (
      now() at time zone hotels.timezone_name
    )::date
  into v_hotel_today
  from public.hotels
  where id = v_existing.hotel_id;

  if p_status = 'checked_in' then
    if v_existing.status <> 'confirmed' then
      raise exception
        'Only confirmed reservations can be checked in'
        using errcode = 'P0001';
    end if;

    if v_hotel_today < v_existing.check_in
      or v_hotel_today >= v_existing.check_out
    then
      raise exception
        'Check-in is allowed only during the reserved stay dates'
        using errcode = 'P0001';
    end if;
  end if;

  if p_status = 'completed' then
    if v_existing.status <> 'checked_in' then
      raise exception
        'Only checked-in reservations can be completed'
        using errcode = 'P0001';
    end if;

    if v_hotel_today < v_existing.check_out then
      raise exception
        'The reservation cannot be completed before check-out'
        using errcode = 'P0001';
    end if;
  end if;

  if p_status = 'no_show' then
    if v_existing.status <> 'confirmed' then
      raise exception
        'Only confirmed reservations can be marked as no-show'
        using errcode = 'P0001';
    end if;

    if v_hotel_today < v_existing.check_in then
      raise exception
        'A reservation cannot be marked as no-show before check-in'
        using errcode = 'P0001';
    end if;
  end if;

  update public.reservations
  set status = p_status
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
    v_updated.hotel_id,
    'reservation',
    v_updated.id,
    'reservation.status_changed',
    jsonb_build_object(
      'confirmationNumber',
      v_updated.confirmation_number,
      'previousStatus',
      v_existing.status,
      'currentStatus',
      v_updated.status
    )
  );

  return v_updated;
end;
$$;

revoke all
on function public.update_reservation_status(
  uuid,
  public.reservation_status
)
from public;

grant execute
on function public.update_reservation_status(
  uuid,
  public.reservation_status
)
to authenticated;

-- Payment processing is excluded, so managers/admins update
-- only the stored payment status.
create or replace function public.update_reservation_payment_status(
  p_reservation_id uuid,
  p_payment_status public.payment_status
)
returns public.reservations
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_existing public.reservations%rowtype;
  v_updated public.reservations%rowtype;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select *
  into v_existing
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'Reservation was not found'
      using errcode = 'P0002';
  end if;

  if not (
    public.owns_hotel(v_existing.hotel_id)
    or public.is_admin()
  ) then
    raise exception
      'You cannot manage this reservation'
      using errcode = '42501';
  end if;

  if p_payment_status is null then
    raise exception 'Payment status is required'
      using errcode = '22023';
  end if;

  -- Makes retries safe.
  if v_existing.payment_status = p_payment_status then
    return v_existing;
  end if;

  if not (
    (
      v_existing.payment_status = 'unpaid'
      and p_payment_status = 'paid'
    )
    or
    (
      v_existing.payment_status = 'paid'
      and p_payment_status = 'refunded'
    )
  ) then
    raise exception
      'Invalid payment status transition from % to %',
      v_existing.payment_status,
      p_payment_status
      using errcode = 'P0001';
  end if;

  update public.reservations
  set payment_status = p_payment_status
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
    v_updated.hotel_id,
    'reservation',
    v_updated.id,
    'reservation.payment_status_changed',
    jsonb_build_object(
      'confirmationNumber',
      v_updated.confirmation_number,
      'previousPaymentStatus',
      v_existing.payment_status,
      'currentPaymentStatus',
      v_updated.payment_status
    )
  );

  return v_updated;
end;
$$;

revoke all
on function public.update_reservation_payment_status(
  uuid,
  public.payment_status
)
from public;

grant execute
on function public.update_reservation_payment_status(
  uuid,
  public.payment_status
)
to authenticated;

commit;