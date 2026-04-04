-- Fix Account schema: BetterAuth uses accessTokenExpiresAt/refreshTokenExpiresAt, not expiresAt
-- Also clear stale user data from NextAuth era

-- Clear user-related tables (order matters for FK constraints)
DELETE FROM "ApiKey";
DELETE FROM "Settings";
DELETE FROM "Review";
DELETE FROM "Account";
DELETE FROM "Session";
DELETE FROM "User";

-- Fix Account columns
ALTER TABLE "Account" DROP COLUMN IF EXISTS "expiresAt";
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "accessTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" TIMESTAMP(3);
