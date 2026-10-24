begin;

-- Calculates the exact 48-hour deadline using the hotel's timezone.
create or replace function public.get_reservation_change_deadline(
  p_hotel_id uuid,
  p_check_in date
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_deadline timestamptz;
begin
  if p_check_in is null then
    raise exception 'Check-in date is required'
      using errcode = '22023';
  end if;

  select
    (
      (
        p_check_in + hotels.check_in_time
      ) at time zone hotels.timezone_name
    ) - interval '48 hours'
  into v_deadline
  from public.hotels
  where hotels.id = p_hotel_id;

  if not found then
    raise exception 'Hotel was not found'
      using errcode = 'P0002';
  end if;

  return v_deadline;
end;
$$;

revoke all
on function public.get_reservation_change_deadline(
  uuid,
  date
)
from public;

grant execute
on function public.get_reservation_change_deadline(
  uuid,
  date
)
to authenticated;

-- Modifies an eligible customer reservation.
-- The original reservation remains unchanged if any step fails.
create or replace function public.modify_reservation(
  p_reservation_id uuid,
  p_room_type_id uuid,
  p_check_in date,
  p_check_out date,
  p_guest_count integer,
  p_primary_guest_name text,
  p_primary_guest_email text,
  p_primary_guest_phone text default null,
  p_special_requests text default ''
)
returns public.reservations
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_customer_role public.user_role;
  v_existing public.reservations%rowtype;
  v_updated public.reservations%rowtype;

  v_new_hotel_id uuid;
  v_room_id uuid;
  v_original_deadline timestamptz;
  v_new_deadline timestamptz;
  v_quote record;
begin
  v_customer_id := auth.uid();

  if v_customer_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select role
  into v_customer_role
  from public.profiles
  where id = v_customer_id;

  if not found or v_customer_role <> 'customer' then
    raise exception
      'Only customers can modify their reservations'
      using errcode = '42501';
  end if;

  select *
  into v_existing
  from public.reservations
  where id = p_reservation_id
    and customer_id = v_customer_id
  for update;

  if not found then
    raise exception 'Reservation was not found'
      using errcode = 'P0002';
  end if;

  if v_existing.status <> 'confirmed' then
    raise exception
      'Only confirmed reservations can be modified'
      using errcode = 'P0001';
  end if;

  v_original_deadline :=
    public.get_reservation_change_deadline(
      v_existing.hotel_id,
      v_existing.check_in
    );

  if now() >= v_original_deadline then
    raise exception
      'The modification deadline has passed'
      using errcode = 'P0001';
  end if;

  if char_length(
    trim(coalesce(p_primary_guest_name, ''))
  ) < 2 then
    raise exception
      'Primary guest name is required'
      using errcode = '22023';
  end if;

  if char_length(
    trim(coalesce(p_primary_guest_email, ''))
  ) < 5 then
    raise exception
      'Primary guest email is required'
      using errcode = '22023';
  end if;

  select room_types.hotel_id
  into v_new_hotel_id
  from public.room_types
  join public.hotels
    on hotels.id = room_types.hotel_id
  where room_types.id = p_room_type_id
    and room_types.is_active
    and hotels.status = 'approved';

  if not found then
    raise exception 'Active room type was not found'
      using errcode = 'P0002';
  end if;

  if v_new_hotel_id <> v_existing.hotel_id then
    raise exception
      'A reservation cannot be moved to another hotel'
      using errcode = '22023';
  end if;

  v_new_deadline :=
    public.get_reservation_change_deadline(
      v_new_hotel_id,
      p_check_in
    );

  if now() >= v_new_deadline then
    raise exception
      'The new check-in date is inside the 48-hour deadline'
      using errcode = 'P0001';
  end if;

  -- Recalculate the entire price using current hotel prices.
  select *
  into v_quote
  from public.get_room_type_quote(
    p_room_type_id,
    p_check_in,
    p_check_out,
    p_guest_count
  );

  -- Find and lock a suitable room.
  -- The current reservation is excluded from its own conflict check.
  for v_room_id in
    select candidate.id
    from public.rooms as candidate
    where candidate.hotel_id = v_existing.hotel_id
      and candidate.room_type_id = p_room_type_id
      and candidate.status = 'active'
      and not exists (
        select 1
        from public.reservations
        where reservations.room_id = candidate.id
          and reservations.id <> v_existing.id
          and reservations.status in (
            'confirmed',
            'checked_in'
          )
          and reservations.stay_dates
            && daterange(
              p_check_in,
              p_check_out,
              '[)'
            )
      )
    order by
      case
        when candidate.id = v_existing.room_id
        then 0
        else 1
      end,
      candidate.room_number,
      candidate.id
    for update of candidate skip locked
  loop
    begin
      update public.reservations
      set
        room_type_id = p_room_type_id,
        room_id = v_room_id,
        check_in = p_check_in,
        check_out = p_check_out,
        guest_count = p_guest_count,
        primary_guest_name =
          trim(p_primary_guest_name),
        primary_guest_email =
          lower(trim(p_primary_guest_email)),
        primary_guest_phone =
          nullif(
            trim(
              coalesce(
                p_primary_guest_phone,
                ''
              )
            ),
            ''
          ),
        special_requests =
          trim(coalesce(p_special_requests, '')),
        nightly_rates = v_quote.nightly_rates,
        nightly_subtotal =
          v_quote.nightly_subtotal,
        tax_rate = v_quote.tax_rate,
        tax_amount = v_quote.tax_amount,
        service_fee = v_quote.service_fee,
        total_amount = v_quote.total_amount,
        currency = v_quote.currency
      where id = v_existing.id
      returning *
      into v_updated;

      exit;
    exception
      when exclusion_violation then
        -- Try another physical room if a concurrent request won.
        null;
    end;
  end loop;

  if v_updated.id is null then
    raise exception
      'No rooms are available for the selected dates'
      using errcode = 'P0001';
  end if;

  insert into public.notification_outbox (
    reservation_id,
    notification_type,
    recipient_email
  )
  values (
    v_updated.id,
    'reservation_modified',
    v_updated.primary_guest_email
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
    v_customer_id,
    v_updated.hotel_id,
    'reservation',
    v_updated.id,
    'reservation.modified',
    jsonb_build_object(
      'previous',
      jsonb_build_object(
        'roomTypeId',
        v_existing.room_type_id,
        'roomId',
        v_existing.room_id,
        'checkIn',
        v_existing.check_in,
        'checkOut',
        v_existing.check_out,
        'guestCount',
        v_existing.guest_count,
        'totalAmount',
        v_existing.total_amount
      ),
      'current',
      jsonb_build_object(
        'roomTypeId',
        v_updated.room_type_id,
        'roomId',
        v_updated.room_id,
        'checkIn',
        v_updated.check_in,
        'checkOut',
        v_updated.check_out,
        'guestCount',
        v_updated.guest_count,
        'totalAmount',
        v_updated.total_amount
      )
    )
  );

  return v_updated;
end;
$$;

revoke all
on function public.modify_reservation(
  uuid,
  uuid,
  date,
  date,
  integer,
  text,
  text,
  text,
  text
)
from public;

grant execute
on function public.modify_reservation(
  uuid,
  uuid,
  date,
  date,
  integer,
  text,
  text,
  text,
  text
)
to authenticated;

-- Customer cancellation is allowed only before the deadline.
create or replace function public.cancel_reservation(
  p_reservation_id uuid
)
returns public.reservations
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_customer_role public.user_role;
  v_existing public.reservations%rowtype;
  v_cancelled public.reservations%rowtype;
  v_deadline timestamptz;
begin
  v_customer_id := auth.uid();

  if v_customer_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select role
  into v_customer_role
  from public.profiles
  where id = v_customer_id;

  if not found or v_customer_role <> 'customer' then
    raise exception
      'Only customers can cancel their reservations'
      using errcode = '42501';
  end if;

  select *
  into v_existing
  from public.reservations
  where id = p_reservation_id
    and customer_id = v_customer_id
  for update;

  if not found then
    raise exception 'Reservation was not found'
      using errcode = 'P0002';
  end if;

  -- Repeated cancellation requests return the same result.
  if v_existing.status = 'cancelled' then
    return v_existing;
  end if;

  if v_existing.status <> 'confirmed' then
    raise exception
      'Only confirmed reservations can be cancelled'
      using errcode = 'P0001';
  end if;

  v_deadline :=
    public.get_reservation_change_deadline(
      v_existing.hotel_id,
      v_existing.check_in
    );

  if now() >= v_deadline then
    raise exception
      'The cancellation deadline has passed'
      using errcode = 'P0001';
  end if;

  update public.reservations
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = v_customer_id,
    cancellation_reason = 'Cancelled by customer'
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
    v_customer_id,
    v_cancelled.hotel_id,
    'reservation',
    v_cancelled.id,
    'reservation.cancelled_by_customer',
    jsonb_build_object(
      'confirmationNumber',
      v_cancelled.confirmation_number,
      'deadline',
      v_deadline,
      'reason',
      v_cancelled.cancellation_reason
    )
  );

  return v_cancelled;
end;
$$;

revoke all
on function public.cancel_reservation(uuid)
from public;

grant execute
on function public.cancel_reservation(uuid)
to authenticated;

commit;