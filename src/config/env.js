import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('127.0.0.1'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SESSION_SECRET: z.string().min(16).default('dev-session-secret-change-in-production-min-32-chars'),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(5),

  // AWS DynamoDB (₹0 Always-Free Tier)
  USE_DYNAMODB: z.coerce.boolean().default(false),
  DYNAMODB_TABLE_NAME: z.string().default('PrivateChatAppTable'),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  DYNAMODB_ENDPOINT: z.string().optional(),

  // Cloudflare R2 Storage (10 GB permanently free, ₹0 egress fee)
  USE_R2: z.coerce.boolean().default(false),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('private-chat-media')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
