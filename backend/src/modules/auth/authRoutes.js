import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'

export const authRouter = Router()

authRouter.get('/me', authenticate, (request, response) => {
    const { user, profile } = request.auth

    response.status(200).json({
        user: {
        id: user.id,
        email: user.email,
        fullName: profile.full_name,
        phone: profile.phone,
        role: profile.role,
        managerStatus: profile.manager_status,
        },
    })
})
