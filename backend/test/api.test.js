import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { app } from '../src/app.js'

let server
let baseUrl

before(async () => {
    server = app.listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(() => new Promise((resolve) => server.close(resolve)))

async function request(path, options) {
    return fetch(`${baseUrl}${path}`, options)
}

test('health endpoint reports an operational service', async () => {
    const response = await request('/api/health')
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
        status: 'ok',
        service: 'hotel-api',
    })
})

test('responses include security headers', async () => {
    const response = await request('/api/health')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
})

test('responses include a request identifier', async () => {
    const response = await request('/api/health')
    assert.ok(response.headers.get('x-request-id'))
})

test('safe incoming request identifiers are retained', async () => {
    const response = await request('/api/health', {
        headers: { 'x-request-id': 'integration-test-1' },
    })
    assert.equal(response.headers.get('x-request-id'), 'integration-test-1')
})

test('unknown routes return the standard error shape', async () => {
    const response = await request('/api/not-real')
    const body = await response.json()
    assert.equal(response.status, 404)
    assert.equal(body.error.code, 'ROUTE_NOT_FOUND')
})

test('protected customer routes require authentication', async () => {
    const response = await request('/api/customer/reservations')
    assert.equal(response.status, 401)
})

test('protected manager routes require authentication', async () => {
    const response = await request('/api/manager/hotels')
    assert.equal(response.status, 401)
})

test('protected admin routes require authentication', async () => {
    const response = await request('/api/admin/users')
    assert.equal(response.status, 401)
})

test('invalid public identifiers are rejected before database access', async () => {
    const response = await request('/api/public/hotels/not-a-uuid')
    assert.equal(response.status, 400)
})

test('quote dates must form a valid range', async () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const response = await request(
        `/api/public/room-types/${id}/quote?checkIn=2027-01-10&checkOut=2027-01-09&guests=2`,
    )
    assert.equal(response.status, 400)
})

test('invalid JSON receives a stable client error', async () => {
    const response = await request('/api/customer/reservations', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer invalid',
            'Content-Type': 'application/json',
        },
        body: '{',
    })
    const body = await response.json()
    assert.equal(response.status, 400)
    assert.equal(body.error.code, 'INVALID_JSON')
})
