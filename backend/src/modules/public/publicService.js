import { getPagination, getPaginationMeta } from '../../lib/pagination.js'
import { supabaseAuth } from '../../lib/supabase.js'
import { throwSupabaseError } from '../../lib/supabaseError.js'
import { toCamelCase } from '../../lib/toCamelCase.js'

async function addRatings(hotels) {
    if (hotels.length === 0) return hotels

    const { data, error } = await supabaseAuth
        .from('hotel_rating_summary')
        .select('*')
        .in(
            'hotel_id',
            hotels.map((hotel) => hotel.id),
        )

    throwSupabaseError(error, 'Could not load hotel ratings')
    const ratings = new Map(data.map((rating) => [rating.hotel_id, rating]))

    return hotels.map((hotel) => ({
        ...hotel,
        rating: ratings.get(hotel.id) ?? {
            average_rating: null,
            review_count: 0,
        },
    }))
}

export async function listLookups() {
    const [facilitiesResult, amenitiesResult] = await Promise.all([
        supabaseAuth.from('facilities').select('*').order('name'),
        supabaseAuth.from('amenities').select('*').order('name'),
    ])

    throwSupabaseError(facilitiesResult.error, 'Could not load facilities')
    throwSupabaseError(amenitiesResult.error, 'Could not load amenities')

    return toCamelCase({
        facilities: facilitiesResult.data,
        amenities: amenitiesResult.data,
    })
}

export async function getQuote(input) {
    const { data, error } = await supabaseAuth.rpc('get_room_type_quote', {
        p_room_type_id: input.roomTypeId,
        p_check_in: input.checkIn,
        p_check_out: input.checkOut,
        p_guest_count: input.guests,
    })

    throwSupabaseError(error, 'Could not calculate room quote')
    return toCamelCase(data[0])
}

export async function searchHotels(input) {
    const roomTypesRelation = 'room_types!inner'
    const facilitiesRelation = input.facilityId
        ? 'hotel_facilities!inner'
        : 'hotel_facilities'

    let query = supabaseAuth
        .from('hotels')
        .select(
            `
                *,
                hotel_images(*),
                ${facilitiesRelation}(facility_id, facility:facilities(*)),
                ${roomTypesRelation}(
                    *,
                    room_type_amenities(amenity:amenities(*))
                )
            `,
            { count: 'exact' },
        )

    if (input.search) query = query.ilike('name', `%${input.search}%`)
    if (input.country) query = query.ilike('country', input.country)
    if (input.city) query = query.ilike('city', input.city)
    if (input.facilityId) {
        query = query.eq('hotel_facilities.facility_id', input.facilityId)
    }
    if (input.guests) {
        query = query.gte('room_types.capacity', input.guests)
    }
    if (input.roomType) {
        query = query.ilike('room_types.name', `%${input.roomType}%`)
    }
    if (input.minPrice !== undefined) {
        query = query.gte('room_types.base_price', input.minPrice)
    }
    if (input.maxPrice !== undefined) {
        query = query.lte('room_types.base_price', input.maxPrice)
    }

    query = query.order('name', { ascending: true })

    const { data, error } = await query
    throwSupabaseError(error, 'Could not search hotels')

    let hotels = await addRatings(data)

    if (input.minRating !== undefined) {
        hotels = hotels.filter(
            (hotel) =>
                Number(hotel.rating.average_rating ?? 0) >= input.minRating,
        )
    }

    if (input.checkIn && input.checkOut) {
        hotels = await Promise.all(
            hotels.map(async (hotel) => {
                const roomTypes = await Promise.all(
                    hotel.room_types.map(async (roomType) => ({
                        ...roomType,
                        quote: await getQuote({
                            roomTypeId: roomType.id,
                            checkIn: input.checkIn,
                            checkOut: input.checkOut,
                            guests: input.guests ?? 1,
                        }),
                    })),
                )

                return {
                    ...hotel,
                    room_types: roomTypes.filter(
                        (roomType) => roomType.quote.availableRooms > 0,
                    ),
                }
            }),
        )
        hotels = hotels.filter((hotel) => hotel.room_types.length > 0)
    }

    const lowestPrice = (hotel) =>
        Math.min(
            ...hotel.room_types.map((roomType) =>
                Number(roomType.quote?.totalAmount ?? roomType.base_price),
            ),
        )
    const averageRating = (hotel) =>
        Number(hotel.rating.average_rating ?? 0)

    hotels.sort((left, right) => {
        if (input.sort === 'name_desc') {
            return right.name.localeCompare(left.name)
        }
        if (input.sort === 'newest') {
            return Date.parse(right.created_at) - Date.parse(left.created_at)
        }
        if (input.sort === 'price_asc') {
            return lowestPrice(left) - lowestPrice(right)
        }
        if (input.sort === 'price_desc') {
            return lowestPrice(right) - lowestPrice(left)
        }
        if (input.sort === 'rating_desc') {
            return averageRating(right) - averageRating(left)
        }
        return left.name.localeCompare(right.name)
    })

    const total = hotels.length
    const { from, to } = getPagination(input.page, input.limit)
    hotels = hotels.slice(from, to + 1)

    return {
        hotels: toCamelCase(hotels),
        pagination: getPaginationMeta(total, input.page, input.limit),
    }
}

export async function getPublicHotel(hotelId) {
    const { data, error } = await supabaseAuth
        .from('hotels')
        .select(`
            *,
            hotel_images(*),
            hotel_facilities(facility:facilities(*)),
            room_types(
                *,
                room_type_amenities(amenity:amenities(*))
            )
        `)
        .eq('id', hotelId)
        .single()

    throwSupabaseError(error, 'Could not load hotel')
    const [hotel] = await addRatings([data])
    return toCamelCase(hotel)
}

export async function listHotelReviews(hotelId, { page, limit }) {
    const { from, to } = getPagination(page, limit)
    const { data, error, count } = await supabaseAuth
        .from('reviews')
        .select('id, rating, comment, created_at', { count: 'exact' })
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: false })
        .range(from, to)

    throwSupabaseError(error, 'Could not load reviews')
    return {
        reviews: toCamelCase(data),
        pagination: getPaginationMeta(count ?? 0, page, limit),
    }
}
