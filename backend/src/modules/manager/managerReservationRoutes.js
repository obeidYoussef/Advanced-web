import { Router } from 'express'
import { z } from 'zod'
import { paginationFields } from '../../lib/pagination.js'
import { listAuditLogs } from '../../lib/auditService.js'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { validate } from '../../middleware/validate.js'
import {
    getManagerReservation,
    getReportRows,
    listManagerReservations,
    managerCancelReservation,
    updatePaymentStatus,
    updateReservationStatus,
} from './reservationService.js'
import { buildReport, reservationsToCsv } from './reportService.js'

const uuid = z.uuid()
const date = z.iso.date()
const reservationStatus = z.enum([
    'confirmed',
    'checked_in',
    'completed',
    'cancelled',
    'no_show',
])
const paymentStatus = z.enum(['unpaid', 'paid', 'refunded'])
const reportRange = z
    .object({
        hotelId: uuid.optional(),
        from: date,
        to: date,
    })
    .refine((value) => value.to >= value.from, {
        message: 'to must be on or after from',
    })

export const managerReservationRouter = Router()

managerReservationRouter.use(authenticate, authorize('manager'))

managerReservationRouter.get(
    '/audit-logs',
    validate(
        z.object({
            query: z.object({
                ...paginationFields,
                hotelId: uuid.optional(),
                action: z.string().trim().min(1).max(100).optional(),
                from: date.optional(),
                to: date.optional(),
            }),
        }),
    ),
    async (request, response) => {
        response.json(
            await listAuditLogs(
                request.auth.supabase,
                request.validated.query,
            ),
        )
    },
)

managerReservationRouter.get(
    '/reservations',
    validate(
        z.object({
            query: z.object({
                ...paginationFields,
                hotelId: uuid.optional(),
                status: reservationStatus.optional(),
                paymentStatus: paymentStatus.optional(),
                from: date.optional(),
                to: date.optional(),
                search: z
                    .string()
                    .trim()
                    .min(1)
                    .max(100)
                    .regex(/^[\p{L}\p{N} .'-]+$/u)
                    .optional(),
            }),
        }),
    ),
    async (request, response) => {
        response.json(
            await listManagerReservations(
                request.auth.supabase,
                request.validated.query,
            ),
        )
    },
)

managerReservationRouter.get(
    '/reservations/:reservationId',
    validate(z.object({ params: z.object({ reservationId: uuid }) })),
    async (request, response) => {
        const reservation = await getManagerReservation(
            request.auth.supabase,
            request.validated.params.reservationId,
        )
        response.json({ reservation })
    },
)

managerReservationRouter.post(
    '/reservations/:reservationId/cancel',
    validate(
        z.object({
            params: z.object({ reservationId: uuid }),
            body: z.object({
                reason: z.string().trim().min(2).max(500),
            }),
        }),
    ),
    async (request, response) => {
        const reservation = await managerCancelReservation(
            request.auth.supabase,
            request.validated.params.reservationId,
            request.validated.body.reason,
        )
        response.json({ reservation })
    },
)

managerReservationRouter.patch(
    '/reservations/:reservationId/status',
    validate(
        z.object({
            params: z.object({ reservationId: uuid }),
            body: z.object({ status: reservationStatus }),
        }),
    ),
    async (request, response) => {
        const reservation = await updateReservationStatus(
            request.auth.supabase,
            request.validated.params.reservationId,
            request.validated.body.status,
        )
        response.json({ reservation })
    },
)

managerReservationRouter.patch(
    '/reservations/:reservationId/payment-status',
    validate(
        z.object({
            params: z.object({ reservationId: uuid }),
            body: z.object({ paymentStatus }),
        }),
    ),
    async (request, response) => {
        const reservation = await updatePaymentStatus(
            request.auth.supabase,
            request.validated.params.reservationId,
            request.validated.body.paymentStatus,
        )
        response.json({ reservation })
    },
)

managerReservationRouter.get(
    '/reports/summary',
    validate(z.object({ query: reportRange })),
    async (request, response) => {
        const rows = await getReportRows(
            request.auth.supabase,
            request.validated.query,
        )
        const report = await buildReport(
            request.auth.supabase,
            rows,
            request.validated.query,
        )
        response.json({ report })
    },
)

managerReservationRouter.get(
    '/reports/reservations.csv',
    validate(z.object({ query: reportRange })),
    async (request, response) => {
        const rows = await getReportRows(
            request.auth.supabase,
            request.validated.query,
        )
        response
            .type('text/csv')
            .attachment('reservations.csv')
            .send(reservationsToCsv(rows))
    },
)
