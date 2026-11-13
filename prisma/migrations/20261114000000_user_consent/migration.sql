-- Consent (#617): terms acceptance and the optional account link for umami.identify().
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "identifyConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "identifyConsentAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);
