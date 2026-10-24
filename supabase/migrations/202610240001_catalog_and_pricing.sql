begin;

-- Required for the non-overlapping price-range constraint.
create extension if not exists btree_gist;

-- Predefined hotel facilities.
create table public.facilities (
    id smallint generated always as identity primary key,
    code text not null unique check (
        code ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
    ),
    name text not null unique check (
        char_length(trim(name)) between 2 and 100
    )
);

-- Predefined room amenities.
create table public.amenities (
    id smallint generated always as identity primary key,
    code text not null unique check (
        code ~ '^[a-z0-9]+(_[a-z0-9]+)*$'
    ),
    name text not null unique check (
        char_length(trim(name)) between 2 and 100
    )
);

-- A hotel can have multiple image URLs.
create table public.hotel_images (
    id uuid primary key default gen_random_uuid (),
    hotel_id uuid not null references public.hotels (id) on delete restrict,
    image_url text not null check (
        char_length(trim(image_url)) between 8 and 2000
    ),
    alt_text text not null default '' check (char_length(alt_text) <= 200),
    display_order smallint not null default 0 check (display_order >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint hotel_images_url_unique unique (hotel_id, image_url)
);

create table public.hotel_facilities (
    hotel_id uuid not null references public.hotels (id) on delete restrict,
    facility_id smallint not null references public.facilities (id) on delete restrict,
    primary key (hotel_id, facility_id)
);

create table public.room_type_amenities (
    room_type_id uuid not null references public.room_types (id) on delete restrict,
    amenity_id smallint not null references public.amenities (id) on delete restrict,
    primary key (room_type_id, amenity_id)
);

-- Override dates are inclusive.
-- Example: start_date 2026-12-20 and end_date 2026-12-31.
create table public.price_overrides (
    id uuid primary key default gen_random_uuid (),
    room_type_id uuid not null references public.room_types (id) on delete restrict,
    start_date date not null,
    end_date date not null,
    nightly_price numeric(12, 2) not null check (nightly_price >= 0),
    date_range daterange generated always as (
        daterange (
            start_date,
            end_date + 1,
            '[)'
        )
    ) stored,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint price_overrides_dates_valid check (end_date >= start_date),
    constraint price_overrides_no_overlap exclude using gist (
        room_type_id
        with
            =,
            date_range
        with
            &&
    )
);

create index hotel_images_hotel_order_index on public.hotel_images (hotel_id, display_order);

create index hotel_facilities_facility_index on public.hotel_facilities (facility_id);

create index room_type_amenities_amenity_index on public.room_type_amenities (amenity_id);

create index price_overrides_room_type_dates_index on public.price_overrides (
    room_type_id,
    start_date,
    end_date
);

create trigger hotel_images_set_updated_at
before update on public.hotel_images
for each row execute function public.set_updated_at();

create trigger price_overrides_set_updated_at
before update on public.price_overrides
for each row execute function public.set_updated_at();

-- A manager must still be approved to manage an owned hotel.
-- This automatically protects existing room and room-type policies too.
create or replace function public.owns_hotel(requested_hotel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.can_manage_hotels()
    and exists (
      select 1
      from public.hotels
      where id = requested_hotel_id
        and manager_id = (select auth.uid())
    );
$$;

-- Initial predefined hotel facilities.
insert into
    public.facilities (code, name)
values ('wifi', 'Free Wi-Fi'),
    ('parking', 'Parking'),
    ('pool', 'Swimming Pool'),
    ('restaurant', 'Restaurant'),
    ('gym', 'Fitness Center'),
    ('spa', 'Spa'),
    (
        'airport_shuttle',
        'Airport Shuttle'
    ),
    (
        'pet_friendly',
        'Pet Friendly'
    ),
    (
        'accessible',
        'Accessible Facilities'
    ),
    (
        'front_desk_24h',
        '24-Hour Front Desk'
    ) on conflict (code) do nothing;

-- Initial predefined room amenities.
insert into
    public.amenities (code, name)
values (
        'air_conditioning',
        'Air Conditioning'
    ),
    (
        'private_bathroom',
        'Private Bathroom'
    ),
    ('television', 'Television'),
    ('minibar', 'Minibar'),
    ('safe', 'Safe'),
    ('balcony', 'Balcony'),
    (
        'coffee_machine',
        'Coffee Machine'
    ),
    ('work_desk', 'Work Desk'),
    ('hair_dryer', 'Hair Dryer'),
    ('bathtub', 'Bathtub') on conflict (code) do nothing;

alter table public.facilities enable row level security;

alter table public.amenities enable row level security;

alter table public.hotel_images enable row level security;

alter table public.hotel_facilities enable row level security;

alter table public.room_type_amenities enable row level security;

alter table public.price_overrides enable row level security;

revoke all on public.facilities from anon, authenticated;

revoke all on public.amenities from anon, authenticated;

revoke all on public.hotel_images from anon, authenticated;

revoke all on public.hotel_facilities from anon, authenticated;

revoke all on public.room_type_amenities from anon, authenticated;

revoke all on public.price_overrides from anon, authenticated;

-- Predefined lists are public and read-only through the API.
grant select on public.facilities to anon, authenticated;

grant select on public.amenities to anon, authenticated;

create policy facilities_public_read on public.facilities for
select to anon, authenticated using (true);

create policy amenities_public_read on public.amenities for
select to anon, authenticated using (true);

-- Hotel images.
grant select on public.hotel_images to anon, authenticated;

grant insert , update, delete on public.hotel_images to authenticated;

create policy hotel_images_public_read on public.hotel_images for
select to anon, authenticated using (
        exists (
            select 1
            from public.hotels
            where
                hotels.id = hotel_images.hotel_id
                and hotels.status = 'approved'
        )
    );

create policy hotel_images_manager_read on public.hotel_images for
select to authenticated using (
        public.owns_hotel (hotel_id)
        or public.is_admin ()
    );

create policy hotel_images_manager_insert on public.hotel_images for
insert
    to authenticated
with
    check (
        public.owns_hotel (hotel_id)
        or public.is_admin ()
    );

create policy hotel_images_manager_update on public.hotel_images for
update to authenticated using (
    public.owns_hotel (hotel_id)
    or public.is_admin ()
)
with
    check (
        public.owns_hotel (hotel_id)
        or public.is_admin ()
    );

create policy hotel_images_manager_delete on public.hotel_images for delete to authenticated using (
    public.owns_hotel (hotel_id)
    or public.is_admin ()
);

-- Hotel facility assignments.
grant select on public.hotel_facilities to anon, authenticated;

grant insert , delete on public.hotel_facilities to authenticated;

create policy hotel_facilities_public_read on public.hotel_facilities for
select to anon, authenticated using (
        exists (
            select 1
            from public.hotels
            where
                hotels.id = hotel_facilities.hotel_id
                and hotels.status = 'approved'
        )
    );

create policy hotel_facilities_manager_read on public.hotel_facilities for
select to authenticated using (
        public.owns_hotel (hotel_id)
        or public.is_admin ()
    );

create policy hotel_facilities_manager_insert on public.hotel_facilities for
insert
    to authenticated
with
    check (
        public.owns_hotel (hotel_id)
        or public.is_admin ()
    );

create policy hotel_facilities_manager_delete on public.hotel_facilities for delete to authenticated using (
    public.owns_hotel (hotel_id)
    or public.is_admin ()
);

-- Room-type amenity assignments.
grant select on public.room_type_amenities to anon, authenticated;

grant insert , delete on public.room_type_amenities to authenticated;

create policy room_type_amenities_public_read on public.room_type_amenities for
select to anon, authenticated using (
        exists (
            select 1
            from public.room_types
                join public.hotels on hotels.id = room_types.hotel_id
            where
                room_types.id = room_type_amenities.room_type_id
                and room_types.is_active
                and hotels.status = 'approved'
        )
    );

create policy room_type_amenities_manager_read on public.room_type_amenities for
select to authenticated using (
        exists (
            select 1
            from public.room_types
            where
                room_types.id = room_type_amenities.room_type_id
                and public.owns_hotel (room_types.hotel_id)
        )
        or public.is_admin ()
    );

create policy room_type_amenities_manager_insert on public.room_type_amenities for
insert
    to authenticated
with
    check (
        exists (
            select 1
            from public.room_types
            where
                room_types.id = room_type_amenities.room_type_id
                and public.owns_hotel (room_types.hotel_id)
        )
        or public.is_admin ()
    );

create policy room_type_amenities_manager_delete on public.room_type_amenities for delete to authenticated using (
    exists (
        select 1
        from public.room_types
        where
            room_types.id = room_type_amenities.room_type_id
            and public.owns_hotel (room_types.hotel_id)
    )
    or public.is_admin ()
);

-- Price overrides remain private to managers/admins.
-- Public prices will be returned through the search API.
grant
select,
insert
,
update,
delete on public.price_overrides to authenticated;

create policy price_overrides_manager_read on public.price_overrides for
select to authenticated using (
        exists (
            select 1
            from public.room_types
            where
                room_types.id = price_overrides.room_type_id
                and public.owns_hotel (room_types.hotel_id)
        )
        or public.is_admin ()
    );

create policy price_overrides_manager_insert on public.price_overrides for
insert
    to authenticated
with
    check (
        exists (
            select 1
            from public.room_types
            where
                room_types.id = price_overrides.room_type_id
                and public.owns_hotel (room_types.hotel_id)
        )
        or public.is_admin ()
    );

create policy price_overrides_manager_update on public.price_overrides for
update to authenticated using (
    exists (
        select 1
        from public.room_types
        where
            room_types.id = price_overrides.room_type_id
            and public.owns_hotel (room_types.hotel_id)
    )
    or public.is_admin ()
)
with
    check (
        exists (
            select 1
            from public.room_types
            where
                room_types.id = price_overrides.room_type_id
                and public.owns_hotel (room_types.hotel_id)
        )
        or public.is_admin ()
    );

create policy price_overrides_manager_delete on public.price_overrides for delete to authenticated using (
    exists (
        select 1
        from public.room_types
        where
            room_types.id = price_overrides.room_type_id
            and public.owns_hotel (room_types.hotel_id)
    )
    or public.is_admin ()
);

commit;