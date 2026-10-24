import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { authRouter } from './modules/auth/authRoutes.js'

export const app = express()

app.disable('x-powered-by')

app.use(helmet())
app.use(
    cors({
        origin: env.FRONTEND_URL,
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

app.use((request, response) => {
    response.status(404).json({
        error: {
        message: `Route not found: ${request.method} ${request.originalUrl}`,
        },
    })
})

app.use(errorHandler)
