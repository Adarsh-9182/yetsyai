-- Additive only: legacy renders remain readable with unknown request identity.
ALTER TABLE "VideoGeneration" ADD COLUMN "requestFingerprint" TEXT;
ALTER TABLE "VideoGeneration" ADD COLUMN "failureCode" TEXT;
