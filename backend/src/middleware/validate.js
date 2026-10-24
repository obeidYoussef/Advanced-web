import { HttpError } from '../lib/httpError.js'

export function validate(schema) {
    return (request, _response, next) => {
        const result = schema.safeParse({
            params: request.params,
            query: request.query,
            body: request.body,
        })

        if (!result.success) {
            return next(
                new HttpError(
                    400,
                    'VALIDATION_ERROR',
                    'Request validation failed',
                    result.error.issues.map((issue) => ({
                        path: issue.path.join('.'),
                        message: issue.message,
                    })),
                ),
            )
        }

        request.validated = result.data
        return next()
    }
}
