begin;

create type public.reservation_status as enum (
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show'
);

create type public.payment_status as enum (
  'unpaid',
  'paid',
  'refunded'
);

create type public.notification_type as enum (
  'reservation_confirmed',
  'reservation_modified',
  'reservation_cancelled'
);

create type public.notification_status as enum (
  'pending',
  'sent',
  'failed'
);

-- Required for a reservation to verify that its physical room,
-- room type, and hotel all belong together.
alter table public.rooms
add constraint rooms_id_hotel_room_type_unique
unique (id, hotel_id, room_type_id);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),

  confirmation_number text not null unique
    check (
      confirmation_number ~ '^[A-Z0-9-]{10,30}$'
    ),

  customer_id uuid not null
    references public.profiles(id)
    on delete restrict,

  hotel_id uuid not null
    references public.hotels(id)
    on delete restrict,

  room_type_id uuid not null,
  room_id uuid not null,

  check_in date not null,
  check_out date not null,

  stay_dates daterange generated always as (
    daterange(check_in, check_out, '[)')
  ) stored,

  guest_count smallint not null
    check (guest_count between 1 and 20),

  primary_guest_name text not null
    check (
      char_length(trim(primary_guest_name))
      between 2 and 100
    ),

  primary_guest_email text not null
    check (
      char_length(trim(primary_guest_email))
      between 5 and 320
    ),

  primary_guest_phone text
    check (
      primary_guest_phone is null
      or char_length(trim(primary_guest_phone))
        between 5 and 30
    ),

  special_requests text not null default ''
    check (char_length(special_requests) <= 1000),

  status public.reservation_status
    not null
    default 'confirmed',

  payment_status public.payment_status
    not null
    default 'unpaid',

  -- Price snapshot: later hotel price changes cannot modify it.
  nightly_rates jsonb not null
    check (jsonb_typeof(nightly_rates) = 'array'),

  nightly_subtotal numeric(12, 2) not null
    check (nightly_subtotal >= 0),

  tax_rate numeric(5, 2) not null
    check (tax_rate between 0 and 100),

  tax_amount numeric(12, 2) not null
    check (tax_amount >= 0),

  service_fee numeric(12, 2) not null
    check (service_fee >= 0),

  total_amount numeric(12, 2) not null
    check (total_amount >= 0),

  currency char(3) not null
    check (currency ~ '^[A-Z]{3}$'),

  cancelled_at timestamptz,
  cancelled_by uuid
    references public.profiles(id)
    on delete restrict,
  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reservations_dates_valid
    check (check_in < check_out),

  constraint reservations_total_valid
    check (
      total_amount =
        round(
          nightly_subtotal
          + tax_amount
          + service_fee,
          2
        )
    ),

  constraint reservations_cancellation_valid
    check (
      (
        status = 'cancelled'
        and cancelled_at is not null
        and cancelled_by is not null
        and cancellation_reason is not null
        and char_length(trim(cancellation_reason))
          between 2 and 500
      )
      or
      (
        status <> 'cancelled'
        and cancelled_at is null
        and cancelled_by is null
        and cancellation_reason is null
      )
    ),

  constraint reservations_room_type_hotel_fk
    foreign key (room_type_id, hotel_id)
    references public.room_types(id, hotel_id)
    on delete restrict,

  constraint reservations_room_hotel_type_fk
    foreign key (room_id, hotel_id, room_type_id)
    references public.rooms(id, hotel_id, room_type_id)
    on delete restrict,

  constraint reservations_id_customer_hotel_unique
    unique (id, customer_id, hotel_id),

  -- PostgreSQL guarantees that the same physical room cannot
  -- have overlapping active reservations, including concurrent requests.
  constraint reservations_no_active_room_overlap
    exclude using gist (
      room_id with =,
      stay_dates with &&
    )
    where (
      status in (
        'confirmed'::public.reservation_status,
        'checked_in'::public.reservation_status
      )
    )
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),

  reservation_id uuid not null unique,
  customer_id uuid not null,
  hotel_id uuid not null,

  rating smallint not null
    check (rating between 1 and 5),

  comment text not null default ''
    check (char_length(comment) <= 2000),

  is_visible boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reviews_reservation_owner_fk
    foreign key (
      reservation_id,
      customer_id,
      hotel_id
    )
    references public.reservations(
      id,
      customer_id,
      hotel_id
    )
    on delete restrict
);

-- Email jobs are stored separately from reservations.
-- Therefore an email failure never rolls back a valid booking.
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),

  reservation_id uuid not null
    references public.reservations(id)
    on delete restrict,

  notification_type public.notification_type not null,

  recipient_email text not null
    check (
      char_length(trim(recipient_email))
      between 5 and 320
    ),

  status public.notification_status
    not null
    default 'pending',

  attempts smallint not null default 0
    check (attempts >= 0),

  last_error text,
  sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notification_outbox_sent_valid
    check (
      (
        status = 'sent'
        and sent_at is not null
      )
      or
      (
        status <> 'sent'
        and sent_at is null
      )
    )
);

-- Sensitive actions and status changes are recorded here.
create table public.audit_logs (
  id bigint generated always as identity primary key,

  actor_id uuid
    references public.profiles(id)
    on delete set null,

  hotel_id uuid
    references public.hotels(id)
    on delete restrict,

  entity_type text not null
    check (
      char_length(trim(entity_type))
      between 2 and 50
    ),

  entity_id uuid,

  action text not null
    check (
      char_length(trim(action))
      between 2 and 100
    ),

  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object'),

  created_at timestamptz not null default now()
);

create index reservations_customer_status_index
  on public.reservations(
    customer_id,
    status,
    check_in
  );

create index reservations_hotel_status_index
  on public.reservations(
    hotel_id,
    status,
    check_in
  );

create index reservations_room_dates_index
  on public.reservations(
    room_id,
    check_in,
    check_out
  );

create index reservations_room_type_dates_index
  on public.reservations(
    room_type_id,
    check_in,
    check_out
  );

create index reviews_hotel_created_index
  on public.reviews(
    hotel_id,
    created_at desc
  )
  where is_visible;

create index notification_outbox_pending_index
  on public.notification_outbox(
    status,
    created_at
  )
  where status in ('pending', 'failed');

create index audit_logs_hotel_created_index
  on public.audit_logs(
    hotel_id,
    created_at desc
  );

create index audit_logs_actor_created_index
  on public.audit_logs(
    actor_id,
    created_at desc
  );

create trigger reservations_set_updated_at
before update on public.reservations
for each row execute function public.set_updated_at();

create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

create trigger notification_outbox_set_updated_at
before update on public.notification_outbox
for each row execute function public.set_updated_at();

alter table public.reservations enable row level security;
alter table public.reviews enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.reservations from anon, authenticated;
revoke all on public.reviews from anon, authenticated;
revoke all on public.notification_outbox from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

-- Reservations can be read by their customer, hotel manager, or admin.
-- Creation and state changes will only happen through secure SQL functions.
grant select on public.reservations to authenticated;

create policy reservations_customer_read
on public.reservations
for select
to authenticated
using (
  customer_id = (select auth.uid())
);

create policy reservations_manager_read
on public.reservations
for select
to authenticated
using (
  public.owns_hotel(hotel_id)
);

create policy reservations_admin_read
on public.reservations
for select
to authenticated
using (
  public.is_admin()
);

-- Visible reviews for approved hotels are public.
grant select on public.reviews to anon, authenticated;

-- Customers may submit only the safe review columns.
grant insert (
  reservation_id,
  customer_id,
  hotel_id,
  rating,
  comment
)
on public.reviews
to authenticated;

create policy reviews_public_read
on public.reviews
for select
to anon, authenticated
using (
  is_visible
  and exists (
    select 1
    from public.hotels
    where hotels.id = reviews.hotel_id
      and hotels.status = 'approved'
  )
);

create policy reviews_customer_read_own
on public.reviews
for select
to authenticated
using (
  customer_id = (select auth.uid())
);

create policy reviews_manager_read
on public.reviews
for select
to authenticated
using (
  public.owns_hotel(hotel_id)
  or public.is_admin()
);

create policy reviews_customer_create
on public.reviews
for insert
to authenticated
with check (
  customer_id = (select auth.uid())
  and is_visible
  and exists (
    select 1
    from public.reservations
    where reservations.id = reviews.reservation_id
      and reservations.customer_id =
        (select auth.uid())
      and reservations.hotel_id =
        reviews.hotel_id
      and reservations.status = 'completed'
  )
);

-- Only managers of the related hotel and admins may read audit history.
-- No client role can insert, modify, or delete audit records directly.
grant select on public.audit_logs to authenticated;

create policy audit_logs_manager_read
on public.audit_logs
for select
to authenticated
using (
  hotel_id is not null
  and public.owns_hotel(hotel_id)
);

create policy audit_logs_admin_read
on public.audit_logs
for select
to authenticated
using (
  public.is_admin()
);

-- The outbox intentionally has no client policies.
-- The backend's private server client will process these records.

-- Public aggregate used by hotel search and hotel details.
create view public.hotel_rating_summary
with (security_invoker = true)
as
select
  hotel_id,
  count(*)::integer as review_count,
  round(avg(rating)::numeric, 2) as average_rating
from public.reviews
where is_visible
group by hotel_id;

grant select
on public.hotel_rating_summary
to anon, authenticated;

commit;