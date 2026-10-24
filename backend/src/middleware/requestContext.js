import { randomUUID } from 'node:crypto'

const validRequestId = /^[A-Za-z0-9._-]{1,100}$/

export function requestContext(request, response, next) {
    const incomingRequestId = request.get('x-request-id')

    request.id = validRequestId.test(incomingRequestId ?? '')
        ? incomingRequestId
        : randomUUID()

    response.set('x-request-id', request.id)

    const startedAt = Date.now()

    response.on('finish', () => {
        console.info(
            JSON.stringify({
                level: 'info',
                requestId: request.id,
                method: request.method,
                path: request.originalUrl,
                status: response.statusCode,
                durationMs: Date.now() - startedAt,
            }),
        )
    })

    next()
}
