import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    FRONTEND_URL: z.url(),
    SUPABASE_URL: z.url(),
    SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
    const missingOrInvalid = result.error.issues
        .map((issue) => issue.path.join('.'))
        .join(', ')

    throw new Error(`Invalid environment variables: ${missingOrInvalid}`)
}

export const env = Object.freeze(result.data)