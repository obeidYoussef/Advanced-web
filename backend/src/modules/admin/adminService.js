import {
    getPagination,
    getPaginationMeta,
} from '../../lib/pagination.js'
import { throwSupabaseError } from '../../lib/supabaseError.js'
import { toCamelCase } from '../../lib/toCamelCase.js'
import { supabaseAdmin } from '../../lib/supabase.js'

export async function listUsers(supabase, { role, page, limit }) {
    const { from, to } = getPagination(page, limit)
    let query = supabase
        .from('profiles')
        .select(
            'id, full_name, phone, role, manager_status, manager_status_reason, created_at, updated_at',
            { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(from, to)

    if (role) query = query.eq('role', role)

    const { data, error, count } = await query
    throwSupabaseError(error, 'Could not load users')

    const users = await Promise.all(
        data.map(async (profile) => {
            if (!supabaseAdmin) return { ...profile, email: null }
            const { data: authData } =
                await supabaseAdmin.auth.admin.getUserById(profile.id)
            return { ...profile, email: authData.user?.email ?? null }
        }),
    )

    return {
        users: toCamelCase(users),
        pagination: getPaginationMeta(count ?? 0, page, limit),
    }
}

export async function listManagers(
    supabase,
    { status, page, limit },
) {
    const { from, to } = getPagination(page, limit)
    let query = supabase
        .from('profiles')
        .select(
            'id, full_name, phone, role, manager_status, manager_status_reason, created_at, updated_at',
            { count: 'exact' },
        )
        .eq('role', 'manager')
        .order('created_at', { ascending: false })
        .range(from, to)

    if (status) {
        query = query.eq('manager_status', status)
    }

    const { data, error, count } = await query

    throwSupabaseError(error, 'Could not load manager applications')

    return {
        managers: toCamelCase(data),
        pagination: getPaginationMeta(count ?? 0, page, limit),
    }
}

export async function updateManagerStatus(
    supabase,
    { managerId, status, reason },
) {
    const { data, error } = await supabase.rpc(
        'admin_update_manager_status',
        {
            p_manager_id: managerId,
            p_status: status,
            p_reason: reason ?? null,
        },
    )

    throwSupabaseError(error, 'Could not update manager status')
    return toCamelCase(data)
}

export async function updateUserRole(
    supabase,
    { userId, role },
) {
    const { data, error } = await supabase.rpc(
        'admin_update_user_role',
        {
            p_user_id: userId,
            p_role: role,
        },
    )

    throwSupabaseError(error, 'Could not update user role')
    return toCamelCase(data)
}

export async function listHotels(
    supabase,
    { status, page, limit },
) {
    const { from, to } = getPagination(page, limit)
    let query = supabase
        .from('hotels')
        .select(
            `
                *,
                manager:profiles!hotels_manager_id_fkey(
                    id,
                    full_name,
                    manager_status
                )
            `,
            { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(from, to)

    if (status) {
        query = query.eq('status', status)
    }

    const { data, error, count } = await query

    throwSupabaseError(error, 'Could not load hotels')

    return {
        hotels: toCamelCase(data),
        pagination: getPaginationMeta(count ?? 0, page, limit),
    }
}

export async function updateHotelStatus(
    supabase,
    { hotelId, status, reason },
) {
    const { data, error } = await supabase.rpc(
        'admin_update_hotel_status',
        {
            p_hotel_id: hotelId,
            p_status: status,
            p_reason: reason ?? null,
        },
    )

    throwSupabaseError(error, 'Could not update hotel status')
    return toCamelCase(data)
}
