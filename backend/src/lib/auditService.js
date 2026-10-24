import { getPagination, getPaginationMeta } from './pagination.js'
import { throwSupabaseError } from './supabaseError.js'
import { toCamelCase } from './toCamelCase.js'

export async function listAuditLogs(supabase, filters) {
    const { from, to } = getPagination(filters.page, filters.limit)
    let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

    if (filters.hotelId) query = query.eq('hotel_id', filters.hotelId)
    if (filters.action) query = query.eq('action', filters.action)
    if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00Z`)
    if (filters.to) query = query.lte('created_at', `${filters.to}T23:59:59Z`)

    const { data, error, count } = await query
    throwSupabaseError(error, 'Could not load audit history')

    return {
        auditLogs: toCamelCase(data),
        pagination: getPaginationMeta(
            count ?? 0,
            filters.page,
            filters.limit,
        ),
    }
}
