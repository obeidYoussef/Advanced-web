import { env } from '../config/env.js'

export function errorHandler(error, request, response, _next) {
    const status = Number.isInteger(error.status) ? error.status : 500

    console.error({
        method: request.method,
        path: request.originalUrl,
        status,
        message: error.message,
    })

    response.status(status).json({
        error: {
        message:
            status === 500 && env.NODE_ENV === 'production'
            ? 'Internal server error'
            : error.message,
        },
    })
}
