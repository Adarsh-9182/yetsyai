CREATE TABLE "StudioWorkspace" (
    "id" TEXT NOT NULL,
    "activeJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudioWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoGeneration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitting',
    "providerRequestId" TEXT,
    "statusUrl" TEXT,
    "responseUrl" TEXT,
    "videoUrl" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VideoGeneration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VideoGeneration_workspaceId_createdAt_idx" ON "VideoGeneration"("workspaceId", "createdAt");
ALTER TABLE "VideoGeneration" ADD CONSTRAINT "VideoGeneration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "StudioWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
