import { HttpError } from './httpError.js'

const errorMappings = {
    '22023': [400, 'INVALID_ARGUMENT'],
    '23505': [409, 'RESOURCE_CONFLICT'],
    '23503': [409, 'REFERENCE_CONFLICT'],
    '23514': [400, 'CONSTRAINT_VIOLATION'],
    '23P01': [409, 'AVAILABILITY_CONFLICT'],
    '42501': [403, 'FORBIDDEN'],
    P0001: [409, 'BUSINESS_RULE_VIOLATION'],
    P0002: [404, 'NOT_FOUND'],
    PGRST116: [404, 'NOT_FOUND'],
}

export function throwSupabaseError(
    error,
    fallbackMessage = 'Database request failed',
) {
    if (!error) {
        return
    }

    const [status, code] = errorMappings[error.code] ?? [
        500,
        'DATABASE_ERROR',
    ]

    const safeMessages = new Set([
        '22023',
        '42501',
        'P0001',
        'P0002',
    ])

    const message = safeMessages.has(error.code)
        ? error.message
        : fallbackMessage

    throw new HttpError(status, code, message)
}
