import { z } from 'zod'

export const paginationFields = {
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
}

export function getPagination(page, limit) {
    const from = (page - 1) * limit

    return {
        from,
        to: from + limit - 1,
    }
}

export function getPaginationMeta(total, page, limit) {
    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    }
}
