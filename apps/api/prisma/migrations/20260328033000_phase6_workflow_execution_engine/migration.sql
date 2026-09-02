ALTER TYPE "DecisionStatus" ADD VALUE IF NOT EXISTS 'awaiting_approval';
ALTER TYPE "DecisionStatus" ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE "DecisionStatus" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE "DecisionStatus" ADD VALUE IF NOT EXISTS 'execution_requested';
ALTER TYPE "DecisionStatus" ADD VALUE IF NOT EXISTS 'executing';
ALTER TYPE "DecisionStatus" ADD VALUE IF NOT EXISTS 'executed';
ALTER TYPE "DecisionStatus" ADD VALUE IF NOT EXISTS 'execution_failed';

CREATE TYPE "ApprovalTaskStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE "ApprovalTaskPurpose" AS ENUM ('decision_review', 'execution_gate');
CREATE TYPE "ExecutionTaskType" AS ENUM ('create_purchase_order', 'create_transfer_order', 'notify_operator');
CREATE TYPE "ExecutionTargetSystem" AS ENUM ('internal_supply', 'internal_notification');
CREATE TYPE "ExecutionTaskStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'dead_lettered', 'cancelled');
CREATE TYPE "ExecutionAttemptStatus" AS ENUM ('running', 'succeeded', 'failed');
CREATE TYPE "IdempotencyScopeType" AS ENUM ('execution_task');
CREATE TYPE "IdempotencyKeyStatus" AS ENUM ('pending', 'succeeded', 'failed');
CREATE TYPE "OperatorOverrideType" AS ENUM (
  'manual_approve',
  'manual_reject',
  'manual_cancel_execution',
  'manual_retry',
  'manual_close_exception',
  'manual_request_execution',
  'manual_request_approval'
);

CREATE TABLE "approval_tasks" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "decisionId" UUID NOT NULL,
  "purpose" "ApprovalTaskPurpose" NOT NULL DEFAULT 'decision_review',
  "status" "ApprovalTaskStatus" NOT NULL DEFAULT 'pending',
  "requestedByUserId" UUID,
  "assignedToUserId" UUID,
  "requestedAt" TIMESTAMP(3) NOT NULL,
  "decidedAt" TIMESTAMP(3),
  "decidedByUserId" UUID,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "execution_tasks" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "decisionId" UUID NOT NULL,
  "taskType" "ExecutionTaskType" NOT NULL,
  "status" "ExecutionTaskStatus" NOT NULL DEFAULT 'pending',
  "targetSystem" "ExecutionTargetSystem" NOT NULL,
  "payload" JSONB NOT NULL,
  "requestedByUserId" UUID,
  "requestedAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "execution_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "execution_attempts" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "executionTaskId" UUID NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "status" "ExecutionAttemptStatus" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "responsePayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "execution_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "idempotency_keys" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "scopeType" "IdempotencyScopeType" NOT NULL,
  "scopeReference" JSONB NOT NULL,
  "key" TEXT NOT NULL,
  "status" "IdempotencyKeyStatus" NOT NULL DEFAULT 'pending',
  "responseHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operator_overrides" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "decisionId" UUID,
  "executionTaskId" UUID,
  "overrideType" "OperatorOverrideType" NOT NULL,
  "reason" TEXT NOT NULL,
  "payload" JSONB,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operator_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "execution_tasks_decisionId_taskType_targetSystem_key"
  ON "execution_tasks"("decisionId", "taskType", "targetSystem");
CREATE UNIQUE INDEX "execution_attempts_executionTaskId_attemptNumber_key"
  ON "execution_attempts"("executionTaskId", "attemptNumber");
CREATE UNIQUE INDEX "idempotency_keys_organizationId_key_key"
  ON "idempotency_keys"("organizationId", "key");

CREATE INDEX "approval_tasks_organizationId_decisionId_idx"
  ON "approval_tasks"("organizationId", "decisionId");
CREATE INDEX "approval_tasks_organizationId_status_createdAt_idx"
  ON "approval_tasks"("organizationId", "status", "createdAt");

CREATE INDEX "execution_tasks_organizationId_decisionId_idx"
  ON "execution_tasks"("organizationId", "decisionId");
CREATE INDEX "execution_tasks_organizationId_status_createdAt_idx"
  ON "execution_tasks"("organizationId", "status", "createdAt");
CREATE INDEX "execution_tasks_organizationId_nextRetryAt_status_idx"
  ON "execution_tasks"("organizationId", "nextRetryAt", "status");

CREATE INDEX "execution_attempts_organizationId_executionTaskId_createdAt_idx"
  ON "execution_attempts"("organizationId", "executionTaskId", "createdAt");

CREATE INDEX "idempotency_keys_organizationId_updatedAt_idx"
  ON "idempotency_keys"("organizationId", "updatedAt");

CREATE INDEX "operator_overrides_organizationId_createdAt_idx"
  ON "operator_overrides"("organizationId", "createdAt");
CREATE INDEX "operator_overrides_organizationId_decisionId_idx"
  ON "operator_overrides"("organizationId", "decisionId");
CREATE INDEX "operator_overrides_organizationId_executionTaskId_idx"
  ON "operator_overrides"("organizationId", "executionTaskId");

ALTER TABLE "approval_tasks"
  ADD CONSTRAINT "approval_tasks_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_tasks"
  ADD CONSTRAINT "approval_tasks_decisionId_fkey"
  FOREIGN KEY ("decisionId") REFERENCES "decisions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_tasks"
  ADD CONSTRAINT "approval_tasks_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approval_tasks"
  ADD CONSTRAINT "approval_tasks_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approval_tasks"
  ADD CONSTRAINT "approval_tasks_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "execution_tasks"
  ADD CONSTRAINT "execution_tasks_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_tasks"
  ADD CONSTRAINT "execution_tasks_decisionId_fkey"
  FOREIGN KEY ("decisionId") REFERENCES "decisions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_tasks"
  ADD CONSTRAINT "execution_tasks_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "execution_attempts"
  ADD CONSTRAINT "execution_attempts_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_attempts"
  ADD CONSTRAINT "execution_attempts_executionTaskId_fkey"
  FOREIGN KEY ("executionTaskId") REFERENCES "execution_tasks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operator_overrides"
  ADD CONSTRAINT "operator_overrides_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operator_overrides"
  ADD CONSTRAINT "operator_overrides_decisionId_fkey"
  FOREIGN KEY ("decisionId") REFERENCES "decisions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operator_overrides"
  ADD CONSTRAINT "operator_overrides_executionTaskId_fkey"
  FOREIGN KEY ("executionTaskId") REFERENCES "execution_tasks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operator_overrides"
  ADD CONSTRAINT "operator_overrides_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
