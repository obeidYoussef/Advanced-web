begin;

-- Hotel-local times are required for the 48-hour policy.
alter table public.hotels
add column timezone_name text not null default 'UTC'
  check (
    char_length(trim(timezone_name))
    between 1 and 100
  ),
add column check_in_time time not null default '15:00',
add column check_out_time time not null default '11:00';

grant update (
  timezone_name,
  check_in_time,
  check_out_time
)
on public.hotels
to authenticated;

-- Reject invalid IANA timezone names such as "My Timezone".
create or replace function public.validate_hotel_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = new.timezone_name
  ) then
    raise exception 'Invalid hotel timezone: %',
      new.timezone_name
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger hotels_validate_timezone
before insert or update of timezone_name
on public.hotels
for each row
execute function public.validate_hotel_timezone();

-- Returns the server-calculated price and current availability.
create or replace function public.get_room_type_quote(
  p_room_type_id uuid,
  p_check_in date,
  p_check_out date,
  p_guest_count integer
)
returns table (
  night_count integer,
  available_rooms integer,
  nightly_rates jsonb,
  nightly_subtotal numeric,
  tax_rate numeric,
  tax_amount numeric,
  service_fee numeric,
  total_amount numeric,
  currency text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_base_price numeric(12, 2);
  v_capacity smallint;
  v_tax_rate numeric(5, 2);
  v_service_fee numeric(12, 2);
  v_currency char(3);
  v_timezone_name text;

  v_hotel_today date;
  v_night_count integer;
  v_available_rooms integer;
  v_nightly_rates jsonb;
  v_nightly_subtotal numeric(12, 2);
  v_tax_amount numeric(12, 2);
  v_total_amount numeric(12, 2);
begin
  if p_check_in is null or p_check_out is null then
    raise exception 'Check-in and check-out are required'
      using errcode = '22023';
  end if;

  if p_check_in >= p_check_out then
    raise exception 'Check-in must be before check-out'
      using errcode = '22023';
  end if;

  if p_guest_count is null
    or p_guest_count < 1
    or p_guest_count > 20
  then
    raise exception 'Guest count must be between 1 and 20'
      using errcode = '22023';
  end if;

  select
    room_types.hotel_id,
    room_types.base_price,
    room_types.capacity,
    hotels.tax_rate,
    hotels.service_fee,
    hotels.currency,
    hotels.timezone_name
  into
    v_hotel_id,
    v_base_price,
    v_capacity,
    v_tax_rate,
    v_service_fee,
    v_currency,
    v_timezone_name
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

  v_hotel_today :=
    (now() at time zone v_timezone_name)::date;

  if p_check_in < v_hotel_today then
    raise exception 'Check-in cannot be in the past'
      using errcode = '22023';
  end if;

  if p_guest_count > v_capacity then
    raise exception
      'Guest count exceeds room capacity of %',
      v_capacity
      using errcode = '22023';
  end if;

  v_night_count := p_check_out - p_check_in;

  select count(*)::integer
  into v_available_rooms
  from public.rooms
  where rooms.room_type_id = p_room_type_id
    and rooms.hotel_id = v_hotel_id
    and rooms.status = 'active'
    and not exists (
      select 1
      from public.reservations
      where reservations.room_id = rooms.id
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
    );

  select
    jsonb_agg(
      jsonb_build_object(
        'date',
        (p_check_in + nights.day_number)::text,
        'amount',
        coalesce(
          price_overrides.nightly_price,
          v_base_price
        )
      )
      order by nights.day_number
    ),
    round(
      sum(
        coalesce(
          price_overrides.nightly_price,
          v_base_price
        )
      ),
      2
    )
  into
    v_nightly_rates,
    v_nightly_subtotal
  from generate_series(
    0,
    v_night_count - 1
  ) as nights(day_number)
  left join public.price_overrides
    on price_overrides.room_type_id =
      p_room_type_id
    and (
      p_check_in + nights.day_number
    ) <@ price_overrides.date_range;

  v_tax_amount :=
    round(
      v_nightly_subtotal
      * v_tax_rate
      / 100,
      2
    );

  v_total_amount :=
    round(
      v_nightly_subtotal
      + v_tax_amount
      + v_service_fee,
      2
    );

  return query
  select
    v_night_count,
    v_available_rooms,
    v_nightly_rates,
    v_nightly_subtotal,
    v_tax_rate,
    v_tax_amount,
    v_service_fee,
    v_total_amount,
    trim(v_currency)::text;
end;
$$;

revoke all
on function public.get_room_type_quote(
  uuid,
  date,
  date,
  integer
)
from public;

grant execute
on function public.get_room_type_quote(
  uuid,
  date,
  date,
  integer
)
to anon, authenticated;

-- Creates a confirmed reservation inside one database transaction.
create or replace function public.create_reservation(
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
  v_hotel_id uuid;
  v_room_id uuid;
  v_confirmation_number text;
  v_quote record;
  v_reservation public.reservations%rowtype;
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
      'Only customers can create reservations'
      using errcode = '42501';
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

  select *
  into v_quote
  from public.get_room_type_quote(
    p_room_type_id,
    p_check_in,
    p_check_out,
    p_guest_count
  );

  if v_quote.available_rooms < 1 then
    raise exception
      'No rooms are available for the selected dates'
      using errcode = 'P0001';
  end if;

  select room_types.hotel_id
  into v_hotel_id
  from public.room_types
  join public.hotels
    on hotels.id = room_types.hotel_id
  where room_types.id = p_room_type_id
    and room_types.is_active
    and hotels.status = 'approved';

  -- Lock one physical room.
  -- Concurrent requests skip rooms already being allocated.
  for v_room_id in
    select candidate.id
    from public.rooms as candidate
    where candidate.hotel_id = v_hotel_id
      and candidate.room_type_id = p_room_type_id
      and candidate.status = 'active'
      and not exists (
        select 1
        from public.reservations
        where reservations.room_id = candidate.id
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
    order by candidate.room_number, candidate.id
    for update of candidate skip locked
  loop
    begin
      v_confirmation_number :=
        'HTL-'
        || upper(
          substring(
            replace(
              gen_random_uuid()::text,
              '-',
              ''
            ),
            1,
            16
          )
        );

      insert into public.reservations (
        confirmation_number,
        customer_id,
        hotel_id,
        room_type_id,
        room_id,
        check_in,
        check_out,
        guest_count,
        primary_guest_name,
        primary_guest_email,
        primary_guest_phone,
        special_requests,
        nightly_rates,
        nightly_subtotal,
        tax_rate,
        tax_amount,
        service_fee,
        total_amount,
        currency
      )
      values (
        v_confirmation_number,
        v_customer_id,
        v_hotel_id,
        p_room_type_id,
        v_room_id,
        p_check_in,
        p_check_out,
        p_guest_count,
        trim(p_primary_guest_name),
        lower(trim(p_primary_guest_email)),
        nullif(
          trim(
            coalesce(
              p_primary_guest_phone,
              ''
            )
          ),
          ''
        ),
        trim(coalesce(p_special_requests, '')),
        v_quote.nightly_rates,
        v_quote.nightly_subtotal,
        v_quote.tax_rate,
        v_quote.tax_amount,
        v_quote.service_fee,
        v_quote.total_amount,
        v_quote.currency
      )
      returning *
      into v_reservation;

      exit;
    exception
      when exclusion_violation then
        -- Another transaction took this room first.
        null;
    end;
  end loop;

  if v_reservation.id is null then
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
    v_reservation.id,
    'reservation_confirmed',
    v_reservation.primary_guest_email
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
    v_hotel_id,
    'reservation',
    v_reservation.id,
    'reservation.created',
    jsonb_build_object(
      'confirmationNumber',
      v_reservation.confirmation_number,
      'status',
      v_reservation.status,
      'checkIn',
      v_reservation.check_in,
      'checkOut',
      v_reservation.check_out
    )
  );

  return v_reservation;
end;
$$;

revoke all
on function public.create_reservation(
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
on function public.create_reservation(
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

commit;