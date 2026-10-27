-- Demo catalog for local/development testing.
-- Run this after every migration in the Supabase SQL Editor.
-- It is safe to run again: matching demo hotels, room types, and rooms are updated.
--
-- Optional: replace null below with a manager login email when the database has
-- more than one manager, for example: 'manager@example.com'

do $seed$
declare
  v_target_manager_email text := null;
  v_manager_id uuid;
  v_hotel_id uuid;
  v_room_type_id uuid;
  v_hotel jsonb;
  v_room_type jsonb;
  v_room_number text;
  v_room_index integer;
  v_room_slot integer;
  v_hotel_count integer := 0;
  v_room_type_count integer := 0;
  v_physical_room_count integer := 0;

  v_hotels jsonb := $$
  [
    {
      "name": "Cedar Bay Hotel",
      "description": "A contemporary waterfront stay with Mediterranean views, a rooftop pool, and quick access to central Beirut.",
      "country": "Lebanon",
      "city": "Beirut",
      "address": "Ain El Mreisseh, Beirut Waterfront",
      "latitude": 33.899200,
      "longitude": 35.497900,
      "cover_image_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=85",
      "contact_email": "cedarbay@example.com",
      "contact_phone": "+961 1 555 101",
      "currency": "USD",
      "standard_price": 95,
      "service_fee": 8,
      "timezone_name": "Asia/Beirut",
      "facilities": ["wifi", "parking", "pool", "restaurant", "gym", "front_desk_24h"]
    },
    {
      "name": "Byblos Harbor House",
      "description": "A relaxed harbor hotel near the old souks, combining warm Lebanese hospitality with sea-facing terraces.",
      "country": "Lebanon",
      "city": "Byblos",
      "address": "Old Port Road, Jbeil",
      "latitude": 34.121100,
      "longitude": 35.648100,
      "cover_image_url": "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1600&q=85",
      "contact_email": "byblosharbor@example.com",
      "contact_phone": "+961 9 555 202",
      "currency": "USD",
      "standard_price": 110,
      "service_fee": 10,
      "timezone_name": "Asia/Beirut",
      "facilities": ["wifi", "parking", "restaurant", "airport_shuttle", "front_desk_24h"]
    },
    {
      "name": "Batroun Seaside Retreat",
      "description": "A bright coastal retreat with private beach access, sunset dining, and an easy walk to Batroun old town.",
      "country": "Lebanon",
      "city": "Batroun",
      "address": "Coastal Road, Batroun",
      "latitude": 34.255300,
      "longitude": 35.658500,
      "cover_image_url": "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1600&q=85",
      "contact_email": "batrounretreat@example.com",
      "contact_phone": "+961 6 555 303",
      "currency": "USD",
      "standard_price": 125,
      "service_fee": 12,
      "timezone_name": "Asia/Beirut",
      "facilities": ["wifi", "parking", "pool", "restaurant", "pet_friendly", "front_desk_24h"]
    },
    {
      "name": "Zahle Vineyard Hotel",
      "description": "A quiet valley hotel inspired by local vineyards, with garden dining and views toward Mount Sannine.",
      "country": "Lebanon",
      "city": "Zahle",
      "address": "Berdawni Promenade, Zahle",
      "latitude": 33.846300,
      "longitude": 35.902000,
      "cover_image_url": "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1600&q=85",
      "contact_email": "zahlevineyard@example.com",
      "contact_phone": "+961 8 555 404",
      "currency": "USD",
      "standard_price": 85,
      "service_fee": 7,
      "timezone_name": "Asia/Beirut",
      "facilities": ["wifi", "parking", "restaurant", "accessible", "front_desk_24h"]
    },
    {
      "name": "Marrakech Riad Gardens",
      "description": "A peaceful riad-style hotel with shaded courtyards, traditional details, and a spa close to the Medina.",
      "country": "Morocco",
      "city": "Marrakesh",
      "address": "Rue Dar El Bacha, Medina",
      "latitude": 31.629500,
      "longitude": -7.981100,
      "cover_image_url": "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1600&q=85",
      "contact_email": "riadgardens@example.com",
      "contact_phone": "+212 5 24 55 05 05",
      "currency": "MAD",
      "standard_price": 1050,
      "service_fee": 90,
      "timezone_name": "Africa/Casablanca",
      "facilities": ["wifi", "pool", "restaurant", "spa", "airport_shuttle", "front_desk_24h"]
    },
    {
      "name": "Bosphorus Terrace Hotel",
      "description": "A stylish city hotel with Bosphorus views, Turkish breakfast, and convenient connections to historic Istanbul.",
      "country": "Türkiye",
      "city": "Istanbul",
      "address": "Cihannuma Mahallesi, Besiktas",
      "latitude": 41.045000,
      "longitude": 29.015000,
      "cover_image_url": "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1600&q=85",
      "contact_email": "bosphorusterrace@example.com",
      "contact_phone": "+90 212 555 06 06",
      "currency": "TRY",
      "standard_price": 5600,
      "service_fee": 400,
      "timezone_name": "Europe/Istanbul",
      "facilities": ["wifi", "parking", "restaurant", "gym", "airport_shuttle", "front_desk_24h"]
    },
    {
      "name": "Alpine Lake Lodge",
      "description": "A welcoming alpine lodge with mountain panoramas, a wellness area, and easy access to Interlaken excursions.",
      "country": "Switzerland",
      "city": "Interlaken",
      "address": "Hoheweg, Interlaken",
      "latitude": 46.686300,
      "longitude": 7.863200,
      "cover_image_url": "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1600&q=85",
      "contact_email": "alpinelake@example.com",
      "contact_phone": "+41 33 555 07 07",
      "currency": "CHF",
      "standard_price": 210,
      "service_fee": 18,
      "timezone_name": "Europe/Zurich",
      "facilities": ["wifi", "parking", "restaurant", "gym", "spa", "pet_friendly"]
    },
    {
      "name": "Lisbon Riverside Hotel",
      "description": "A comfortable riverside base with modern Portuguese design, breakfast service, and Baixa within walking distance.",
      "country": "Portugal",
      "city": "Lisbon",
      "address": "Rua do Arsenal, Baixa",
      "latitude": 38.707800,
      "longitude": -9.136600,
      "cover_image_url": "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1600&q=85",
      "contact_email": "lisbonriverside@example.com",
      "contact_phone": "+351 21 555 08 08",
      "currency": "EUR",
      "standard_price": 145,
      "service_fee": 12,
      "timezone_name": "Europe/Lisbon",
      "facilities": ["wifi", "restaurant", "gym", "accessible", "airport_shuttle", "front_desk_24h"]
    },
    {
      "name": "Santorini Caldera Suites",
      "description": "A cliffside boutique stay offering caldera sunsets, private terraces, and a peaceful pool above the Aegean Sea.",
      "country": "Greece",
      "city": "Santorini",
      "address": "Caldera Path, Imerovigli",
      "latitude": 36.461800,
      "longitude": 25.375300,
      "cover_image_url": "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1600&q=85",
      "contact_email": "calderasuites@example.com",
      "contact_phone": "+30 22860 55509",
      "currency": "EUR",
      "standard_price": 240,
      "service_fee": 20,
      "timezone_name": "Europe/Athens",
      "facilities": ["wifi", "pool", "restaurant", "spa", "airport_shuttle", "front_desk_24h"]
    },
    {
      "name": "Kyoto Garden Hotel",
      "description": "A calm Kyoto stay built around a landscaped garden, with understated rooms and convenient access to central temples.",
      "country": "Japan",
      "city": "Kyoto",
      "address": "Nakagyo Ward, Kyoto",
      "latitude": 35.011600,
      "longitude": 135.768100,
      "cover_image_url": "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=85",
      "contact_email": "kyotogarden@example.com",
      "contact_phone": "+81 75 555 1010",
      "currency": "JPY",
      "standard_price": 18000,
      "service_fee": 1200,
      "timezone_name": "Asia/Tokyo",
      "facilities": ["wifi", "parking", "restaurant", "spa", "accessible", "front_desk_24h"]
    }
  ]
  $$::jsonb;

  v_room_types jsonb := $$
  [
    {
      "name": "Standard Queen Room",
      "description": "A comfortable 24 m² room with one queen bed, a private bathroom, and a practical work area.",
      "capacity": 2,
      "price_multiplier": 1.00,
      "image_url": "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=85",
      "amenities": ["air_conditioning", "private_bathroom", "television", "safe", "work_desk", "hair_dryer"]
    },
    {
      "name": "Deluxe King Room",
      "description": "A spacious 32 m² room with a king bed, lounge chair, minibar, and upgraded bathroom amenities.",
      "capacity": 2,
      "price_multiplier": 1.25,
      "image_url": "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=85",
      "amenities": ["air_conditioning", "private_bathroom", "television", "minibar", "safe", "coffee_machine", "hair_dryer"]
    },
    {
      "name": "Superior Twin Room",
      "description": "A flexible 29 m² room with two single beds, a work desk, and space for two independent travelers.",
      "capacity": 2,
      "price_multiplier": 1.15,
      "image_url": "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=85",
      "amenities": ["air_conditioning", "private_bathroom", "television", "safe", "work_desk", "hair_dryer"]
    },
    {
      "name": "Family Suite",
      "description": "A 48 m² suite with separate sleeping and sitting areas, designed for families of up to four guests.",
      "capacity": 4,
      "price_multiplier": 1.60,
      "image_url": "https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&w=1200&q=85",
      "amenities": ["air_conditioning", "private_bathroom", "television", "minibar", "safe", "coffee_machine", "bathtub", "hair_dryer"]
    },
    {
      "name": "Executive Terrace Suite",
      "description": "A premium 58 m² suite with a furnished balcony, generous living space, and enhanced in-room comforts.",
      "capacity": 3,
      "price_multiplier": 2.00,
      "image_url": "https://images.unsplash.com/photo-1587985064135-0366536eab42?auto=format&fit=crop&w=1200&q=85",
      "amenities": ["air_conditioning", "private_bathroom", "television", "minibar", "safe", "balcony", "coffee_machine", "work_desk", "bathtub", "hair_dryer"]
    }
  ]
  $$::jsonb;
begin
  select p.id
  into v_manager_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'manager'
    and (
      v_target_manager_email is null
      or lower(u.email) = lower(v_target_manager_email)
    )
  order by p.created_at, p.id
  limit 1;

  if v_manager_id is null then
    raise exception
      'No manager account found. Register a manager, confirm the email, then run this seed again.';
  end if;

  -- The status column remains for backward compatibility, but managers now work
  -- immediately after confirming their email.
  update public.profiles
  set manager_status = 'approved',
      manager_status_reason = null
  where id = v_manager_id;

  for v_hotel in
    select value from jsonb_array_elements(v_hotels)
  loop
    v_hotel_id := null;

    select h.id
    into v_hotel_id
    from public.hotels h
    where h.manager_id = v_manager_id
      and lower(h.name) = lower(v_hotel ->> 'name')
      and lower(h.city) = lower(v_hotel ->> 'city')
    order by h.created_at
    limit 1;

    if v_hotel_id is null then
      insert into public.hotels (
        manager_id,
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
        service_fee,
        status,
        rejection_reason,
        timezone_name,
        check_in_time,
        check_out_time
      )
      values (
        v_manager_id,
        v_hotel ->> 'name',
        v_hotel ->> 'description',
        v_hotel ->> 'country',
        v_hotel ->> 'city',
        v_hotel ->> 'address',
        (v_hotel ->> 'latitude')::numeric,
        (v_hotel ->> 'longitude')::numeric,
        v_hotel ->> 'cover_image_url',
        v_hotel ->> 'contact_email',
        v_hotel ->> 'contact_phone',
        v_hotel ->> 'currency',
        0,
        (v_hotel ->> 'service_fee')::numeric,
        'approved',
        null,
        v_hotel ->> 'timezone_name',
        '15:00',
        '11:00'
      )
      returning id into v_hotel_id;
    else
      update public.hotels
      set description = v_hotel ->> 'description',
          country = v_hotel ->> 'country',
          address = v_hotel ->> 'address',
          latitude = (v_hotel ->> 'latitude')::numeric,
          longitude = (v_hotel ->> 'longitude')::numeric,
          cover_image_url = v_hotel ->> 'cover_image_url',
          contact_email = v_hotel ->> 'contact_email',
          contact_phone = v_hotel ->> 'contact_phone',
          currency = v_hotel ->> 'currency',
          tax_rate = 0,
          service_fee = (v_hotel ->> 'service_fee')::numeric,
          status = 'approved',
          rejection_reason = null,
          timezone_name = v_hotel ->> 'timezone_name',
          check_in_time = '15:00',
          check_out_time = '11:00'
      where id = v_hotel_id;
    end if;

    insert into public.hotel_facilities (hotel_id, facility_id)
    select v_hotel_id, f.id
    from public.facilities f
    where f.code in (
      select jsonb_array_elements_text(v_hotel -> 'facilities')
    )
    on conflict do nothing;

    v_hotel_count := v_hotel_count + 1;
    v_room_index := 0;

    for v_room_type in
      select value from jsonb_array_elements(v_room_types)
    loop
      v_room_index := v_room_index + 1;
      v_room_type_id := null;

      select rt.id
      into v_room_type_id
      from public.room_types rt
      where rt.hotel_id = v_hotel_id
        and lower(rt.name) = lower(v_room_type ->> 'name')
      order by rt.created_at
      limit 1;

      if v_room_type_id is null then
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
          v_hotel_id,
          v_room_type ->> 'name',
          v_room_type ->> 'description',
          (v_room_type ->> 'capacity')::smallint,
          round(
            (v_hotel ->> 'standard_price')::numeric
            * (v_room_type ->> 'price_multiplier')::numeric,
            2
          ),
          v_room_type ->> 'image_url',
          true
        )
        returning id into v_room_type_id;
      else
        update public.room_types
        set description = v_room_type ->> 'description',
            capacity = (v_room_type ->> 'capacity')::smallint,
            base_price = round(
              (v_hotel ->> 'standard_price')::numeric
              * (v_room_type ->> 'price_multiplier')::numeric,
              2
            ),
            image_url = v_room_type ->> 'image_url',
            is_active = true
        where id = v_room_type_id;
      end if;

      insert into public.room_type_amenities (room_type_id, amenity_id)
      select v_room_type_id, a.id
      from public.amenities a
      where a.code in (
        select jsonb_array_elements_text(v_room_type -> 'amenities')
      )
      on conflict do nothing;

      -- Three physical rooms keep each room type bookable during repeated tests.
      for v_room_slot in 1..3 loop
        v_room_number := v_room_index::text || lpad(v_room_slot::text, 2, '0');

        insert into public.rooms (
          hotel_id,
          room_type_id,
          room_number,
          status
        )
        values (
          v_hotel_id,
          v_room_type_id,
          v_room_number,
          'active'
        )
        on conflict (hotel_id, room_number) do update
        set room_type_id = excluded.room_type_id,
            status = excluded.status;

        v_physical_room_count := v_physical_room_count + 1;
      end loop;

      v_room_type_count := v_room_type_count + 1;
    end loop;
  end loop;

  raise notice
    'Demo catalog ready: % hotels, % room types, % physical rooms. Manager: %',
    v_hotel_count,
    v_room_type_count,
    v_physical_room_count,
    v_manager_id;
end
$seed$;

-- Verification summary. Expected result: 10 hotels, 50 room types, 150 rooms.
select
  count(distinct h.id) as demo_hotels,
  count(distinct rt.id) as demo_room_types,
  count(distinct r.id) as demo_physical_rooms
from public.hotels h
join public.room_types rt on rt.hotel_id = h.id
join public.rooms r on r.room_type_id = rt.id
where h.name in (
  'Cedar Bay Hotel',
  'Byblos Harbor House',
  'Batroun Seaside Retreat',
  'Zahle Vineyard Hotel',
  'Marrakech Riad Gardens',
  'Bosphorus Terrace Hotel',
  'Alpine Lake Lodge',
  'Lisbon Riverside Hotel',
  'Santorini Caldera Suites',
  'Kyoto Garden Hotel'
);
