import { HttpError } from '../lib/httpError.js'

export function authorize(...roles) {
    return (request, _response, next) => {
        const profile = request.auth?.profile

        if (!profile) {
            return next(
                new HttpError(
                    500,
                    'AUTH_CONTEXT_MISSING',
                    'Authentication context is missing',
                ),
            )
        }

        if (!roles.includes(profile.role)) {
            return next(
                new HttpError(
                    403,
                    'FORBIDDEN',
                    'You do not have permission to access this resource',
                ),
            )
        }

        if (
            profile.role === 'manager' &&
            profile.manager_status !== 'approved'
        ) {
            return next(
                new HttpError(
                    403,
                    'MANAGER_NOT_APPROVED',
                    'Manager approval is required',
                ),
            )
        }

        return next()
    }
}
