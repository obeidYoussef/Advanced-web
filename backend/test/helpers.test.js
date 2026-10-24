import assert from 'node:assert/strict'
import test from 'node:test'
import { HttpError } from '../src/lib/httpError.js'
import {
    getPagination,
    getPaginationMeta,
} from '../src/lib/pagination.js'
import { throwSupabaseError } from '../src/lib/supabaseError.js'
import { toCamelCase } from '../src/lib/toCamelCase.js'
import { reservationsToCsv } from '../src/modules/manager/reportService.js'

test('pagination converts page and limit to an inclusive range', () => {
    assert.deepEqual(getPagination(3, 20), { from: 40, to: 59 })
})

test('pagination metadata calculates the final partial page', () => {
    assert.deepEqual(getPaginationMeta(21, 2, 10), {
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
    })
})

test('pagination metadata supports an empty result', () => {
    assert.equal(getPaginationMeta(0, 1, 20).totalPages, 0)
})

test('camel-case conversion handles nested arrays and objects', () => {
    assert.deepEqual(toCamelCase({ room_types: [{ base_price: 25 }] }), {
        roomTypes: [{ basePrice: 25 }],
    })
})

test('camel-case conversion preserves primitive values', () => {
    assert.equal(toCamelCase('unchanged'), 'unchanged')
})

test('HTTP errors preserve public error information', () => {
    const error = new HttpError(409, 'CONFLICT', 'Already exists')
    assert.equal(error.status, 409)
    assert.equal(error.code, 'CONFLICT')
})

test('known database conflicts become HTTP conflicts', () => {
    assert.throws(
        () => throwSupabaseError({ code: '23505', message: 'private' }),
        (error) =>
            error.status === 409 && error.code === 'RESOURCE_CONFLICT',
    )
})

test('safe business-rule messages are preserved', () => {
    assert.throws(
        () => throwSupabaseError({ code: 'P0001', message: 'Too late' }),
        (error) => error.message === 'Too late',
    )
})

test('unknown database details are hidden behind a fallback', () => {
    assert.throws(
        () =>
            throwSupabaseError(
                { code: 'XX000', message: 'database internals' },
                'Operation failed',
            ),
        (error) => error.status === 500 && error.message === 'Operation failed',
    )
})

test('CSV export escapes formulas, commas, and quotes', () => {
    const csv = reservationsToCsv([
        {
            confirmation_number: '=danger',
            hotel: { name: 'Hotel, "One"' },
            room_type: { name: 'Suite' },
        },
    ])
    assert.match(csv, /"'=danger"/)
    assert.match(csv, /"Hotel, ""One"""/)
})
