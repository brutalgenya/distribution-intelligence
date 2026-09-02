CREATE TYPE "WorkerType" AS ENUM ('forecast', 'execution', 'outcomes');
CREATE TYPE "WorkerRunStatus" AS ENUM ('running', 'succeeded', 'failed');

CREATE TABLE "worker_runs" (
  "id" UUID NOT NULL,
  "workerType" "WorkerType" NOT NULL,
  "status" "WorkerRunStatus" NOT NULL,
  "correlationId" UUID NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "processedCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "worker_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "worker_runs_workerType_startedAt_idx" ON "worker_runs"("workerType", "startedAt");
CREATE INDEX "worker_runs_workerType_status_createdAt_idx" ON "worker_runs"("workerType", "status", "createdAt");
