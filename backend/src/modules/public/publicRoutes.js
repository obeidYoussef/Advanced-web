import { Router } from 'express'
import { z } from 'zod'
import { paginationFields } from '../../lib/pagination.js'
import { validate } from '../../middleware/validate.js'
import {
    getPublicHotel,
    getQuote,
    listHotelReviews,
    listLookups,
    searchHotels,
} from './publicService.js'

const uuid = z.uuid()
const date = z.iso.date()

const dateRange = z
    .object({
        checkIn: date.optional(),
        checkOut: date.optional(),
    })
    .refine(
        (value) => Boolean(value.checkIn) === Boolean(value.checkOut),
        { message: 'checkIn and checkOut must be supplied together' },
    )
    .refine(
        (value) => !value.checkIn || value.checkOut > value.checkIn,
        { message: 'checkOut must be after checkIn' },
    )

export const publicRouter = Router()

publicRouter.get('/lookups', async (_request, response) => {
    response.json(await listLookups())
})

publicRouter.get(
    '/hotels',
    validate(
        z.object({
            query: dateRange.and(
                z.object({
                    ...paginationFields,
                    search: z.string().trim().min(1).max(100).optional(),
                    country: z.string().trim().min(2).max(100).optional(),
                    city: z.string().trim().min(2).max(100).optional(),
                    guests: z.coerce.number().int().min(1).max(20).optional(),
                    roomType: z.string().trim().min(1).max(100).optional(),
                    minPrice: z.coerce.number().min(0).optional(),
                    maxPrice: z.coerce.number().min(0).optional(),
                    minRating: z.coerce.number().min(1).max(5).optional(),
                    facilityId: z.coerce.number().int().positive().optional(),
                    sort: z
                        .enum([
                            'name_asc',
                            'name_desc',
                            'newest',
                            'price_asc',
                            'price_desc',
                            'rating_desc',
                        ])
                        .default('name_asc'),
                }),
            ).refine(
                (value) =>
                    value.minPrice === undefined ||
                    value.maxPrice === undefined ||
                    value.maxPrice >= value.minPrice,
                { message: 'maxPrice must be greater than or equal to minPrice' },
            ),
        }),
    ),
    async (request, response) => {
        response.json(await searchHotels(request.validated.query))
    },
)

publicRouter.get(
    '/hotels/:hotelId',
    validate(z.object({ params: z.object({ hotelId: uuid }) })),
    async (request, response) => {
        const hotel = await getPublicHotel(request.validated.params.hotelId)
        response.json({ hotel })
    },
)

publicRouter.get(
    '/hotels/:hotelId/reviews',
    validate(
        z.object({
            params: z.object({ hotelId: uuid }),
            query: z.object(paginationFields),
        }),
    ),
    async (request, response) => {
        response.json(
            await listHotelReviews(
                request.validated.params.hotelId,
                request.validated.query,
            ),
        )
    },
)

publicRouter.get(
    '/room-types/:roomTypeId/quote',
    validate(
        z.object({
            params: z.object({ roomTypeId: uuid }),
            query: z
                .object({
                    checkIn: date,
                    checkOut: date,
                    guests: z.coerce.number().int().min(1).max(20),
                })
                .refine((value) => value.checkOut > value.checkIn, {
                    message: 'checkOut must be after checkIn',
                }),
        }),
    ),
    async (request, response) => {
        const quote = await getQuote({
            roomTypeId: request.validated.params.roomTypeId,
            ...request.validated.query,
        })
        response.json({ quote })
    },
)
