import { Router } from 'express'
import { z } from 'zod'
import { paginationFields } from '../../lib/pagination.js'
import { listAuditLogs } from '../../lib/auditService.js'
import { authenticate } from '../../middleware/authenticate.js'
import { authorize } from '../../middleware/authorize.js'
import { validate } from '../../middleware/validate.js'
import {
    listHotels,
    listManagers,
    listUsers,
    updateHotelStatus,
    updateManagerStatus,
    updateUserRole,
} from './adminService.js'
import {
    getReportRows,
    listManagerReservations,
    managerCancelReservation,
    updatePaymentStatus,
    updateReservationStatus,
} from '../manager/reservationService.js'
import {
    buildReport,
    reservationsToCsv,
} from '../manager/reportService.js'

const idParams = z.object({
    managerId: z.uuid().optional(),
    userId: z.uuid().optional(),
    hotelId: z.uuid().optional(),
})

const managerListSchema = z.object({
    query: z.object({
        ...paginationFields,
        status: z
            .enum(['pending', 'approved', 'rejected', 'suspended'])
            .optional(),
    }),
})

const managerStatusSchema = z.object({
    params: idParams.required({ managerId: true }),
    body: z.object({
        status: z.enum([
            'pending',
            'approved',
            'rejected',
            'suspended',
        ]),
        reason: z.string().trim().min(2).max(500).nullish(),
    }),
})

const userRoleSchema = z.object({
    params: idParams.required({ userId: true }),
    body: z.object({
        role: z.enum(['customer', 'manager', 'admin']),
    }),
})

const hotelListSchema = z.object({
    query: z.object({
        ...paginationFields,
        status: z
            .enum([
                'draft',
                'submitted',
                'approved',
                'rejected',
                'suspended',
            ])
            .optional(),
    }),
})

const hotelStatusSchema = z.object({
    params: idParams.required({ hotelId: true }),
    body: z.object({
        status: z.enum(['approved', 'rejected', 'suspended']),
        reason: z.string().trim().min(2).max(500).nullish(),
    }),
})

const reportRange = z
    .object({
        hotelId: z.uuid().optional(),
        from: z.iso.date(),
        to: z.iso.date(),
    })
    .refine((value) => value.to >= value.from, {
        message: 'to must be on or after from',
    })

export const adminRouter = Router()

adminRouter.use(authenticate, authorize('admin'))

adminRouter.get(
    '/users',
    validate(
        z.object({
            query: z.object({
                ...paginationFields,
                role: z.enum(['customer', 'manager', 'admin']).optional(),
            }),
        }),
    ),
    async (request, response) => {
        response.json(
            await listUsers(
                request.auth.supabase,
                request.validated.query,
            ),
        )
    },
)

adminRouter.get(
    '/reservations',
    validate(
        z.object({
            query: z.object({
                ...paginationFields,
                hotelId: z.uuid().optional(),
                status: z
                    .enum([
                        'confirmed',
                        'checked_in',
                        'completed',
                        'cancelled',
                        'no_show',
                    ])
                    .optional(),
                paymentStatus: z
                    .enum(['unpaid', 'paid', 'refunded'])
                    .optional(),
                from: z.iso.date().optional(),
                to: z.iso.date().optional(),
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

adminRouter.post(
    '/reservations/:reservationId/cancel',
    validate(
        z.object({
            params: z.object({ reservationId: z.uuid() }),
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

adminRouter.patch(
    '/reservations/:reservationId/status',
    validate(
        z.object({
            params: z.object({ reservationId: z.uuid() }),
            body: z.object({
                status: z.enum([
                    'confirmed',
                    'checked_in',
                    'completed',
                    'cancelled',
                    'no_show',
                ]),
            }),
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

adminRouter.patch(
    '/reservations/:reservationId/payment-status',
    validate(
        z.object({
            params: z.object({ reservationId: z.uuid() }),
            body: z.object({
                paymentStatus: z.enum(['unpaid', 'paid', 'refunded']),
            }),
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

adminRouter.get(
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

adminRouter.get(
    '/reports/reservations.csv',
    validate(z.object({ query: reportRange })),
    async (request, response) => {
        const rows = await getReportRows(
            request.auth.supabase,
            request.validated.query,
        )
        response
            .type('text/csv')
            .attachment('platform-reservations.csv')
            .send(reservationsToCsv(rows))
    },
)

adminRouter.get(
    '/audit-logs',
    validate(
        z.object({
            query: z.object({
                ...paginationFields,
                hotelId: z.uuid().optional(),
                action: z.string().trim().min(1).max(100).optional(),
                from: z.iso.date().optional(),
                to: z.iso.date().optional(),
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

adminRouter.get(
    '/managers',
    validate(managerListSchema),
    async (request, response) => {
        const result = await listManagers(
            request.auth.supabase,
            request.validated.query,
        )

        response.status(200).json(result)
    },
)

adminRouter.patch(
    '/managers/:managerId/status',
    validate(managerStatusSchema),
    async (request, response) => {
        const manager = await updateManagerStatus(
            request.auth.supabase,
            {
                managerId: request.validated.params.managerId,
                ...request.validated.body,
            },
        )

        response.status(200).json({ manager })
    },
)

adminRouter.patch(
    '/users/:userId/role',
    validate(userRoleSchema),
    async (request, response) => {
        const user = await updateUserRole(request.auth.supabase, {
            userId: request.validated.params.userId,
            ...request.validated.body,
        })

        response.status(200).json({ user })
    },
)

adminRouter.get(
    '/hotels',
    validate(hotelListSchema),
    async (request, response) => {
        const result = await listHotels(
            request.auth.supabase,
            request.validated.query,
        )

        response.status(200).json(result)
    },
)

adminRouter.patch(
    '/hotels/:hotelId/status',
    validate(hotelStatusSchema),
    async (request, response) => {
        const hotel = await updateHotelStatus(
            request.auth.supabase,
            {
                hotelId: request.validated.params.hotelId,
                ...request.validated.body,
            },
        )

        response.status(200).json({ hotel })
    },
)
