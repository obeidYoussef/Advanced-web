import { throwSupabaseError } from '../../lib/supabaseError.js'
import { toCamelCase } from '../../lib/toCamelCase.js'

function definedEntries(fields) {
    return Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
    )
}

export async function createRoomType(supabase, hotelId, input) {
    const { data, error } = await supabase.rpc(
        'create_room_type_with_inventory',
        {
            p_hotel_id: hotelId,
            p_name: input.name,
            p_description: input.description,
            p_capacity: input.capacity,
            p_base_price: input.basePrice,
            p_image_url: input.imageUrl,
            p_amenity_ids: input.amenityIds,
            p_room_numbers: input.roomNumbers,
        },
    )

    throwSupabaseError(error, 'Could not create room type')
    return toCamelCase(data)
}

export async function updateRoomType(supabase, roomTypeId, input) {
    const { data, error } = await supabase
        .from('room_types')
        .update(
            definedEntries({
                name: input.name,
                description: input.description,
                capacity: input.capacity,
                base_price: input.basePrice,
                image_url: input.imageUrl,
                is_active: input.isActive,
            }),
        )
        .eq('id', roomTypeId)
        .select()
        .single()

    throwSupabaseError(error, 'Could not update room type')
    return toCamelCase(data)
}

export async function addRoomTypeAmenity(
    supabase,
    roomTypeId,
    amenityId,
) {
    const { data, error } = await supabase
        .from('room_type_amenities')
        .insert({ room_type_id: roomTypeId, amenity_id: amenityId })
        .select('amenity:amenities(*)')
        .single()

    throwSupabaseError(error, 'Could not add room amenity')
    return toCamelCase(data.amenity)
}

export async function removeRoomTypeAmenity(
    supabase,
    roomTypeId,
    amenityId,
) {
    const { error } = await supabase
        .from('room_type_amenities')
        .delete()
        .eq('room_type_id', roomTypeId)
        .eq('amenity_id', amenityId)

    throwSupabaseError(error, 'Could not remove room amenity')
}

export async function createRoom(supabase, hotelId, input) {
    const { data, error } = await supabase
        .from('rooms')
        .insert({
            hotel_id: hotelId,
            room_type_id: input.roomTypeId,
            room_number: input.roomNumber,
            status: input.status,
        })
        .select()
        .single()

    throwSupabaseError(error, 'Could not create room')
    return toCamelCase(data)
}

export async function updateRoom(supabase, roomId, input) {
    const { data, error } = await supabase
        .from('rooms')
        .update(
            definedEntries({
                room_type_id: input.roomTypeId,
                room_number: input.roomNumber,
                status: input.status,
            }),
        )
        .eq('id', roomId)
        .select()
        .single()

    throwSupabaseError(error, 'Could not update room')
    return toCamelCase(data)
}

export async function createPriceOverride(
    supabase,
    roomTypeId,
    input,
) {
    const { data, error } = await supabase
        .from('price_overrides')
        .insert({
            room_type_id: roomTypeId,
            start_date: input.startDate,
            end_date: input.endDate,
            nightly_price: input.nightlyPrice,
        })
        .select()
        .single()

    throwSupabaseError(error, 'Could not create price override')
    return toCamelCase(data)
}

export async function updatePriceOverride(supabase, overrideId, input) {
    const { data, error } = await supabase
        .from('price_overrides')
        .update(
            definedEntries({
                start_date: input.startDate,
                end_date: input.endDate,
                nightly_price: input.nightlyPrice,
            }),
        )
        .eq('id', overrideId)
        .select()
        .single()

    throwSupabaseError(error, 'Could not update price override')
    return toCamelCase(data)
}

export async function deletePriceOverride(supabase, overrideId) {
    const { error } = await supabase
        .from('price_overrides')
        .delete()
        .eq('id', overrideId)

    throwSupabaseError(error, 'Could not delete price override')
}
