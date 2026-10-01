ALTER TABLE "StudioWorkspace" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "StudioWorkspace_userId_key" ON "StudioWorkspace"("userId");
ALTER TABLE "VideoGeneration" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'fal';
ALTER TABLE "VideoGeneration" ADD COLUMN "seed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VideoGeneration" ADD COLUMN "storagePath" TEXT;
ALTER TABLE "VideoGeneration" ADD COLUMN "quotaReserved" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "VideoGeneration_status_createdAt_idx" ON "VideoGeneration"("status", "createdAt");
CREATE TABLE "StudioQuota" ("id" TEXT NOT NULL PRIMARY KEY, "used" INTEGER NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "StudioAsset" (
  "id" TEXT NOT NULL PRIMARY KEY, "workspaceId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "path" TEXT NOT NULL, "width" INTEGER NOT NULL, "height" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "StudioWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StudioAsset_path_key" ON "StudioAsset"("path");
CREATE INDEX "StudioAsset_workspaceId_createdAt_idx" ON "StudioAsset"("workspaceId", "createdAt");
-- No studio table is accessible through Supabase's public REST API. Prisma uses
-- the database owner connection; account authorization is checked by the app.
ALTER TABLE "StudioWorkspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VideoGeneration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudioQuota" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudioAsset" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "StudioWorkspace", "VideoGeneration", "StudioQuota", "StudioAsset" FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "StudioWorkspace", "VideoGeneration", "StudioQuota", "StudioAsset" FROM authenticated;
  END IF;
END $$;
