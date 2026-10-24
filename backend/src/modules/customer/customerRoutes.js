import { Router } from 'express'
import { z } from 'zod'
import { paginationFields } from '../../lib/pagination.js'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { validate } from '../../middleware/validate.js'
import {
    cancelReservation,
    createReservation,
    createReview,
    getCustomerReservation,
    listCustomerReservations,
    modifyReservation,
} from './customerService.js'

const uuid = z.uuid()
const date = z.iso.date()
const reservationStatus = z.enum([
    'confirmed',
    'checked_in',
    'completed',
    'cancelled',
    'no_show',
])

const reservationBody = z
    .object({
        roomTypeId: uuid,
        checkIn: date,
        checkOut: date,
        guestCount: z.coerce.number().int().min(1).max(20),
        primaryGuestName: z.string().trim().min(2).max(100),
        primaryGuestEmail: z.email().max(320),
        primaryGuestPhone: z
            .string()
            .trim()
            .min(5)
            .max(30)
            .nullish(),
        specialRequests: z.string().trim().max(1000).default(''),
    })
    .refine((value) => value.checkOut > value.checkIn, {
        message: 'checkOut must be after checkIn',
    })

export const customerRouter = Router()

customerRouter.use(authenticate, authorize('customer'))

customerRouter.get(
    '/reservations',
    validate(
        z.object({
            query: z.object({
                ...paginationFields,
                status: reservationStatus.optional(),
            }),
        }),
    ),
    async (request, response) => {
        response.json(
            await listCustomerReservations(
                request.auth.supabase,
                request.auth.user.id,
                request.validated.query,
            ),
        )
    },
)

customerRouter.get(
    '/reservations/:reservationId',
    validate(z.object({ params: z.object({ reservationId: uuid }) })),
    async (request, response) => {
        const reservation = await getCustomerReservation(
            request.auth.supabase,
            request.validated.params.reservationId,
        )
        response.json({ reservation })
    },
)

customerRouter.post(
    '/reservations',
    validate(z.object({ body: reservationBody })),
    async (request, response) => {
        const reservation = await createReservation(
            request.auth.supabase,
            request.validated.body,
        )
        response.status(201).json({ reservation })
    },
)

customerRouter.put(
    '/reservations/:reservationId',
    validate(
        z.object({
            params: z.object({ reservationId: uuid }),
            body: reservationBody,
        }),
    ),
    async (request, response) => {
        const reservation = await modifyReservation(
            request.auth.supabase,
            request.validated.params.reservationId,
            request.validated.body,
        )
        response.json({ reservation })
    },
)

customerRouter.post(
    '/reservations/:reservationId/cancel',
    validate(z.object({ params: z.object({ reservationId: uuid }) })),
    async (request, response) => {
        const reservation = await cancelReservation(
            request.auth.supabase,
            request.validated.params.reservationId,
        )
        response.json({ reservation })
    },
)

customerRouter.post(
    '/reservations/:reservationId/review',
    validate(
        z.object({
            params: z.object({ reservationId: uuid }),
            body: z.object({
                rating: z.coerce.number().int().min(1).max(5),
                comment: z.string().trim().max(2000).default(''),
            }),
        }),
    ),
    async (request, response) => {
        const review = await createReview(
            request.auth.supabase,
            request.auth.user.id,
            request.validated.params.reservationId,
            request.validated.body,
        )
        response.status(201).json({ review })
    },
)
