import { getPagination, getPaginationMeta } from '../../lib/pagination.js'
import { throwSupabaseError } from '../../lib/supabaseError.js'
import { toCamelCase } from '../../lib/toCamelCase.js'

const hotelFields = `
    *,
    hotel_images(*),
    hotel_facilities(facility:facilities(*))
`

function hotelRow(input) {
    const fields = {
        name: input.name,
        description: input.description,
        country: input.country,
        city: input.city,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        cover_image_url: input.coverImageUrl,
        contact_email: input.contactEmail,
        contact_phone: input.contactPhone,
        currency: input.currency,
        service_fee: input.serviceFee,
        timezone_name: input.timezoneName,
        check_in_time: input.checkInTime,
        check_out_time: input.checkOutTime,
    }

    return Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
    )
}

export async function listManagerHotels(
    supabase,
    managerId,
    { page, limit },
) {
    const { from, to } = getPagination(page, limit)
    let query = supabase
        .from('hotels')
        .select(hotelFields, { count: 'exact' })
        .eq('manager_id', managerId)
        .order('created_at', { ascending: false })
        .range(from, to)

    const { data, error, count } = await query
    throwSupabaseError(error, 'Could not load hotels')

    return {
        hotels: toCamelCase(data),
        pagination: getPaginationMeta(count ?? 0, page, limit),
    }
}

export async function getManagerHotel(supabase, hotelId) {
    const { data, error } = await supabase
        .from('hotels')
        .select(`
            ${hotelFields},
            room_types(
                *,
                rooms(*),
                price_overrides(*),
                room_type_amenities(amenity:amenities(*))
            )
        `)
        .eq('id', hotelId)
        .single()

    throwSupabaseError(error, 'Could not load hotel')
    return toCamelCase(data)
}

export async function createHotel(supabase, managerId, input) {
    const { data, error } = await supabase
        .from('hotels')
        .insert({
            ...hotelRow(input),
            manager_id: managerId,
            status: 'approved',
        })
        .select()
        .single()

    throwSupabaseError(error, 'Could not create hotel')
    return toCamelCase(data)
}

export async function updateHotel(supabase, hotelId, input) {
    const { data, error } = await supabase
        .from('hotels')
        .update(hotelRow(input))
        .eq('id', hotelId)
        .select()
        .single()

    throwSupabaseError(error, 'Could not update hotel')
    return toCamelCase(data)
}

export async function addHotelFacility(
    supabase,
    hotelId,
    facilityId,
) {
    const { data, error } = await supabase
        .from('hotel_facilities')
        .insert({ hotel_id: hotelId, facility_id: facilityId })
        .select('facility:facilities(*)')
        .single()

    throwSupabaseError(error, 'Could not add hotel facility')
    return toCamelCase(data.facility)
}

export async function removeHotelFacility(
    supabase,
    hotelId,
    facilityId,
) {
    const { error } = await supabase
        .from('hotel_facilities')
        .delete()
        .eq('hotel_id', hotelId)
        .eq('facility_id', facilityId)

    throwSupabaseError(error, 'Could not remove hotel facility')
}

export async function addHotelImage(supabase, hotelId, input) {
    const { data, error } = await supabase
        .from('hotel_images')
        .insert({
            hotel_id: hotelId,
            image_url: input.imageUrl,
            alt_text: input.altText,
            display_order: input.displayOrder,
        })
        .select()
        .single()

    throwSupabaseError(error, 'Could not add hotel image')
    return toCamelCase(data)
}

export async function updateHotelImage(supabase, imageId, input) {
    const fields = {
        image_url: input.imageUrl,
        alt_text: input.altText,
        display_order: input.displayOrder,
    }
    const changes = Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
    )
    const { data, error } = await supabase
        .from('hotel_images')
        .update(changes)
        .eq('id', imageId)
        .select()
        .single()

    throwSupabaseError(error, 'Could not update hotel image')
    return toCamelCase(data)
}

export async function deleteHotelImage(supabase, imageId) {
    const { error } = await supabase
        .from('hotel_images')
        .delete()
        .eq('id', imageId)

    throwSupabaseError(error, 'Could not delete hotel image')
}
