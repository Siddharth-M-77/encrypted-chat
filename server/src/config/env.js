import { z } from 'zod';

// Validate environment variables once at startup so misconfiguration fails fast.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url(),
  SIWE_DOMAIN: z.string().min(1),
  ALLOWED_CHAIN_IDS: z.string().default('97,56'),
  MONGO_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
  TURN_SECRET: z.string().optional(),
  TURN_URL: z.string().optional(),
  STUN_URL: z.string().optional(),
  UPLOAD_DIR: z.string().default('./uploads'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(` - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const e = parsed.data;

export const env = {
  ...e,
  isProd: e.NODE_ENV === 'production',
  allowedChainIds: e.ALLOWED_CHAIN_IDS.split(',').map((n) => Number(n.trim())).filter(Boolean),
};
