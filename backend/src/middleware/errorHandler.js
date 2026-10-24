import { env } from '../config/env.js'
import { HttpError } from '../lib/httpError.js'

export function errorHandler(error, request, response, _next) {
    const invalidJson = error.type === 'entity.parse.failed'
    const payloadTooLarge = error.type === 'entity.too.large'
    const knownError = error instanceof HttpError
    const status = invalidJson
        ? 400
        : payloadTooLarge
          ? 413
        : knownError
          ? error.status
          : 500
    const code = invalidJson
        ? 'INVALID_JSON'
        : payloadTooLarge
          ? 'PAYLOAD_TOO_LARGE'
        : knownError
          ? error.code
          : 'INTERNAL_ERROR'
    const message = invalidJson
        ? 'Request body contains invalid JSON'
        : payloadTooLarge
          ? 'Request body is too large'
        : status === 500 && env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error.message

    console.error(
        JSON.stringify({
            level: 'error',
            requestId: request.id,
            method: request.method,
            path: request.originalUrl,
            status,
            code,
            message: error.message,
            ...(env.NODE_ENV === 'development' && {
                stack: error.stack,
            }),
        }),
    )

    response.status(status).json({
        error: {
            code,
            message,
            ...(knownError && error.details
                ? { details: error.details }
                : {}),
            requestId: request.id,
        },
    })
}
