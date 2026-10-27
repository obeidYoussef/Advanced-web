import { Router } from 'express'
import { z } from 'zod'
import { throwSupabaseError } from '../../lib/supabaseError.js'
import { authenticate } from '../../middleware/authenticate.js'
import { validate } from '../../middleware/validate.js'

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
        },
    })
})

authRouter.patch(
    '/me',
    authenticate,
    validate(
        z.object({
            body: z
                .object({
                    fullName: z.string().trim().min(2).max(100).optional(),
                    phone: z
                        .string()
                        .trim()
                        .min(5)
                        .max(30)
                        .nullable()
                        .optional(),
                })
                .refine((value) => Object.keys(value).length > 0, {
                    message: 'At least one field is required',
                }),
        }),
    ),
    async (request, response) => {
        const fields = {
            full_name: request.validated.body.fullName,
            phone: request.validated.body.phone,
        }
        const changes = Object.fromEntries(
            Object.entries(fields).filter(([, value]) => value !== undefined),
        )
        const { data, error } = await request.auth.supabase
            .from('profiles')
            .update(changes)
            .eq('id', request.auth.user.id)
            .select()
            .single()

        throwSupabaseError(error, 'Could not update profile')
        response.json({
            profile: {
                id: data.id,
                fullName: data.full_name,
                phone: data.phone,
                role: data.role,
            },
        })
    },
)
