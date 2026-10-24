import { throwSupabaseError } from '../../lib/supabaseError.js'

function differenceInDays(start, end) {
    return Math.max(
        0,
        Math.round((Date.parse(end) - Date.parse(start)) / 86400000),
    )
}

export async function buildReport(supabase, rows, filters) {
    const validRows = rows.filter(
        (row) => !['cancelled', 'no_show'].includes(row.status),
    )
    const hotelIds = [
        ...new Set(
            rows.map((row) => row.hotel_id).filter(Boolean),
        ),
    ]
    let roomsQuery = supabase
        .from('rooms')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')

    if (filters.hotelId) roomsQuery = roomsQuery.eq('hotel_id', filters.hotelId)
    else if (hotelIds.length > 0) roomsQuery = roomsQuery.in('hotel_id', hotelIds)

    const { count: activeRoomCount, error } = await roomsQuery
    throwSupabaseError(error, 'Could not calculate room availability')

    const statusCounts = Object.fromEntries(
        ['confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'].map(
            (status) => [
                status,
                rows.filter((row) => row.status === status).length,
            ],
        ),
    )
    const paymentCounts = Object.fromEntries(
        ['unpaid', 'paid', 'refunded'].map((status) => [
            status,
            rows.filter((row) => row.payment_status === status).length,
        ]),
    )
    const revenueByMonth = validRows.reduce((result, row) => {
        const month = row.check_in.slice(0, 7)
        result[month] = (result[month] ?? 0) + Number(row.total_amount)
        return result
    }, {})
    const bookedRoomNights = validRows.reduce(
        (total, row) => total + differenceInDays(row.check_in, row.check_out),
        0,
    )
    const periodNights = differenceInDays(filters.from, filters.to) + 1
    const availableRoomNights = (activeRoomCount ?? 0) * periodNights

    return {
        totals: {
            reservations: rows.length,
            grossRevenue: validRows.reduce(
                (sum, row) => sum + Number(row.total_amount),
                0,
            ),
            collectedRevenue: validRows
                .filter((row) => row.payment_status === 'paid')
                .reduce((sum, row) => sum + Number(row.total_amount), 0),
            bookedRoomNights,
            occupancyRate:
                availableRoomNights > 0
                    ? Number(
                          ((bookedRoomNights / availableRoomNights) * 100).toFixed(2),
                      )
                    : 0,
        },
        statusCounts,
        paymentCounts,
        revenueByMonth: Object.entries(revenueByMonth).map(
            ([month, revenue]) => ({ month, revenue }),
        ),
    }
}

function csvCell(value) {
    let text = value == null ? '' : String(value)
    if (/^[=+\-@]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
}

export function reservationsToCsv(rows) {
    const columns = [
        ['Confirmation', 'confirmation_number'],
        ['Hotel', (row) => row.hotel?.name],
        ['Room type', (row) => row.room_type?.name],
        ['Guest', 'primary_guest_name'],
        ['Email', 'primary_guest_email'],
        ['Check-in', 'check_in'],
        ['Check-out', 'check_out'],
        ['Guests', 'guest_count'],
        ['Status', 'status'],
        ['Payment', 'payment_status'],
        ['Total', 'total_amount'],
        ['Currency', 'currency'],
        ['Created', 'created_at'],
    ]
    const values = rows.map((row) =>
        columns.map(([, accessor]) =>
            csvCell(
                typeof accessor === 'function' ? accessor(row) : row[accessor],
            ),
        ),
    )

    return [
        columns.map(([header]) => csvCell(header)),
        ...values,
    ]
        .map((line) => line.join(','))
        .join('\r\n')
}
