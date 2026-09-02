import { WorkerRunStatus, WorkerType } from "@prisma/client";
import { z } from "zod";

export const workerTypeSchema = z.nativeEnum(WorkerType);
export const workerRunStatusSchema = z.nativeEnum(WorkerRunStatus);

export interface WorkerStatusDto {
  workerType: WorkerType;
  lastRunAt: string | null;
  lastStatus: WorkerRunStatus | null;
  currentlyRunning: boolean;
  recentFailureCount: number;
  recentProcessedCount: number;
  retryBacklog: number;
  deadLetterCount: number;
  lastError: string | null;
}

export interface HealthDto {
  status: "ok" | "degraded";
  checkedAt: string;
  environment: "local" | "test" | "staging" | "production";
  readiness: "ready" | "not_ready";
  database: {
    status: "up" | "down";
  };
}

export interface ReadinessDto {
  status: "ready" | "not_ready";
  checkedAt: string;
  environment: "local" | "test" | "staging" | "production";
  database: {
    status: "up" | "down";
  };
}

export interface LivenessDto {
  status: "ok";
  checkedAt: string;
  environment: "local" | "test" | "staging" | "production";
  uptimeSeconds: number;
}
