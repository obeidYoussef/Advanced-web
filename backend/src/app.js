import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import { env } from './config/env.js'
import { HttpError } from './lib/httpError.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requestContext } from './middleware/requestContext.js'
import { adminRouter } from './modules/admin/adminRoutes.js'
import { authRouter } from './modules/auth/authRoutes.js'
import { customerRouter } from './modules/customer/customerRoutes.js'
import { managerRouter } from './modules/manager/managerRoutes.js'
import { managerReservationRouter } from './modules/manager/managerReservationRoutes.js'
import { publicRouter } from './modules/public/publicRoutes.js'

export const app = express()

app.disable('x-powered-by')

app.use(requestContext)
app.use(helmet())
app.use(
    cors({
        origin: env.FRONTEND_URL,
    }),
)
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 300,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (request, response) => {
            response.status(429).json({
                error: {
                    code: 'RATE_LIMITED',
                    message: 'Too many requests. Please try again later.',
                    requestId: request.id,
                },
            })
        },
    }),
)
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_request, response) => {
    response.status(200).json({
        status: 'ok',
        service: 'hotel-api',
    })
})

app.use('/api/auth', authRouter)
app.use('/api/public', publicRouter)
app.use('/api/customer', customerRouter)
app.use('/api/admin', adminRouter)
app.use('/api/manager', managerRouter)
app.use('/api/manager', managerReservationRouter)

app.use((request, _response, next) => {
    next(
        new HttpError(
            404,
            'ROUTE_NOT_FOUND',
            `Route not found: ${request.method} ${request.originalUrl}`,
        ),
    )
})

app.use(errorHandler)
