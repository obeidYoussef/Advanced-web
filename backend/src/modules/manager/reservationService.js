import { getPagination, getPaginationMeta } from '../../lib/pagination.js'
import { throwSupabaseError } from '../../lib/supabaseError.js'
import { toCamelCase } from '../../lib/toCamelCase.js'

const reservationFields = `
    *,
    hotel:hotels(id, name, city, country),
    room_type:room_types(id, name, capacity)
`

function applyReservationFilters(query, filters) {
    if (filters.hotelId) query = query.eq('hotel_id', filters.hotelId)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.paymentStatus) {
        query = query.eq('payment_status', filters.paymentStatus)
    }
    if (filters.from) query = query.gte('check_in', filters.from)
    if (filters.to) query = query.lte('check_in', filters.to)
    if (filters.search) {
        query = query.or(
            `confirmation_number.ilike.%${filters.search}%,primary_guest_name.ilike.%${filters.search}%`,
        )
    }
    return query
}

export async function listManagerReservations(supabase, filters) {
    const { from, to } = getPagination(filters.page, filters.limit)
    let query = supabase
        .from('reservations')
        .select(reservationFields, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

    query = applyReservationFilters(query, filters)
    const { data, error, count } = await query
    throwSupabaseError(error, 'Could not load reservations')

    return {
        reservations: toCamelCase(data),
        pagination: getPaginationMeta(
            count ?? 0,
            filters.page,
            filters.limit,
        ),
    }
}

export async function getManagerReservation(supabase, reservationId) {
    const { data, error } = await supabase
        .from('reservations')
        .select(reservationFields)
        .eq('id', reservationId)
        .single()

    throwSupabaseError(error, 'Could not load reservation')
    return toCamelCase(data)
}

async function reservationRpc(supabase, name, parameters, fallback) {
    const { data, error } = await supabase.rpc(name, parameters)
    throwSupabaseError(error, fallback)
    return toCamelCase(data)
}

export function managerCancelReservation(supabase, reservationId, reason) {
    return reservationRpc(
        supabase,
        'manager_cancel_reservation',
        { p_reservation_id: reservationId, p_reason: reason },
        'Could not cancel reservation',
    )
}

export function updateReservationStatus(supabase, reservationId, status) {
    return reservationRpc(
        supabase,
        'update_reservation_status',
        { p_reservation_id: reservationId, p_status: status },
        'Could not update reservation status',
    )
}

export function updatePaymentStatus(
    supabase,
    reservationId,
    paymentStatus,
) {
    return reservationRpc(
        supabase,
        'update_reservation_payment_status',
        {
            p_reservation_id: reservationId,
            p_payment_status: paymentStatus,
        },
        'Could not update payment status',
    )
}

export async function getReportRows(supabase, filters) {
    let query = supabase
        .from('reservations')
        .select(reservationFields)
        .order('check_in')
        .range(0, 9999)

    query = applyReservationFilters(query, filters)
    const { data, error } = await query
    throwSupabaseError(error, 'Could not build reservation report')
    return data
}
