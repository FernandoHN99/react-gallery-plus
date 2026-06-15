import 'dotenv/config'
import { z } from 'zod'

// process.env: { NODE_ENV: 'dev', ... }

const envSchema = z.object({
   JWT_ACCESS_SECRET: z.string(),
   JWT_REFRESH_SECRET: z.string(),
   FRONTEND_URL: z.string().url().optional(),
})

const _env = envSchema.safeParse(process.env)

if (_env.success === false) {
   console.error('❌ Invalid environment variables', _env.error.format())
   throw new Error('Invalid environment variables.')
}

export const env = _env.data
