import { getPagination, getPaginationMeta } from '../../lib/pagination.js'
import { throwSupabaseError } from '../../lib/supabaseError.js'
import { toCamelCase } from '../../lib/toCamelCase.js'

const reservationFields = `
    *,
    hotel:hotels(
        id,
        name,
        city,
        country,
        address,
        cover_image_url,
        timezone_name,
        check_in_time,
        check_out_time
    ),
    room_type:room_types(id, name, capacity),
    review:reviews(id, rating, comment, created_at)
`

async function addChangePolicy(supabase, reservation) {
    const { data, error } = await supabase.rpc(
        'get_reservation_change_deadline',
        {
            p_hotel_id: reservation.hotel_id,
            p_check_in: reservation.check_in,
        },
    )

    throwSupabaseError(error, 'Could not calculate reservation deadline')
    const eligible =
        reservation.status === 'confirmed' && new Date() < new Date(data)

    return {
        ...reservation,
        change_deadline: data,
        can_modify: eligible,
        can_cancel: eligible,
    }
}

export async function listCustomerReservations(
    supabase,
    customerId,
    { status, page, limit },
) {
    const { from, to } = getPagination(page, limit)
    let query = supabase
        .from('reservations')
        .select(reservationFields, { count: 'exact' })
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .range(from, to)

    if (status) query = query.eq('status', status)

    const { data, error, count } = await query
    throwSupabaseError(error, 'Could not load reservations')
    const reservations = await Promise.all(
        data.map((reservation) => addChangePolicy(supabase, reservation)),
    )

    return {
        reservations: toCamelCase(reservations),
        pagination: getPaginationMeta(count ?? 0, page, limit),
    }
}

export async function getCustomerReservation(supabase, reservationId) {
    const { data, error } = await supabase
        .from('reservations')
        .select(reservationFields)
        .eq('id', reservationId)
        .single()

    throwSupabaseError(error, 'Could not load reservation')
    return toCamelCase(await addChangePolicy(supabase, data))
}

function reservationArguments(input) {
    return {
        p_room_type_id: input.roomTypeId,
        p_check_in: input.checkIn,
        p_check_out: input.checkOut,
        p_guest_count: input.guestCount,
        p_primary_guest_name: input.primaryGuestName,
        p_primary_guest_email: input.primaryGuestEmail,
        p_primary_guest_phone: input.primaryGuestPhone ?? null,
        p_special_requests: input.specialRequests ?? '',
    }
}

export async function createReservation(supabase, input) {
    const { data, error } = await supabase.rpc('create_reservation',
        reservationArguments(input),
    )

    throwSupabaseError(error, 'Could not create reservation')
    return toCamelCase(data)
}

export async function modifyReservation(
    supabase,
    reservationId,
    input,
) {
    const { data, error } = await supabase.rpc('modify_reservation', {
        p_reservation_id: reservationId,
        ...reservationArguments(input),
    })

    throwSupabaseError(error, 'Could not modify reservation')
    return toCamelCase(data)
}

export async function cancelReservation(supabase, reservationId) {
    const { data, error } = await supabase.rpc('cancel_reservation', {
        p_reservation_id: reservationId,
    })

    throwSupabaseError(error, 'Could not cancel reservation')
    return toCamelCase(data)
}

export async function createReview(
    supabase,
    customerId,
    reservationId,
    input,
) {
    const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .select('id, hotel_id')
        .eq('id', reservationId)
        .single()

    throwSupabaseError(reservationError, 'Could not load reservation')

    const { data, error } = await supabase
        .from('reviews')
        .insert({
            reservation_id: reservation.id,
            customer_id: customerId,
            hotel_id: reservation.hotel_id,
            rating: input.rating,
            comment: input.comment,
        })
        .select()
        .single()

    throwSupabaseError(error, 'Could not create review')
    return toCamelCase(data)
}
