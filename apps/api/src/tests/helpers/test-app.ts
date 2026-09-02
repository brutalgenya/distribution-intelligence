import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../app.js";
import type { AppConfig } from "../../infrastructure/config/env.js";
import { buildTestConfig } from "./test-config.js";

export const createTestApp = (
  prisma: PrismaClient,
  configOverrides: Partial<AppConfig> = {},
): Promise<FastifyInstance> =>
  buildApp({
    config: buildTestConfig(configOverrides),
    prisma,
  });

export const buildAuthHeaders = (userId: string, organizationId?: string): Record<string, string> => ({
  "x-user-id": userId,
  ...(organizationId ? { "x-organization-id": organizationId } : {}),
});
