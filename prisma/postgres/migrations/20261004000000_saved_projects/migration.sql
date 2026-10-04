CREATE TABLE "StudioProject" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "scenes" TEXT NOT NULL,
  "sceneCount" INTEGER NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudioProject_workspaceId_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "StudioWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StudioProject_workspaceId_updatedAt_idx" ON "StudioProject"("workspaceId", "updatedAt");
ALTER TABLE "StudioProject" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "StudioProject" FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "StudioProject" FROM authenticated;
  END IF;
END $$;
