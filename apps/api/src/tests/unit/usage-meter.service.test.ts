import { UsageMeterType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "../../infrastructure/db/types.js";
import { UsageMeterService } from "../../modules/billing/usage-meter.service.js";
import type { UsageMeterRepository } from "../../modules/billing/usage-meter.repository.js";

describe("UsageMeterService", () => {
  it("records a usage snapshot for the requested meter types", async () => {
    const usageMeterRepository = {
      upsert: vi.fn().mockImplementation(async (_db, input) => ({
        id: `${input.meterType}-meter-id`,
        organizationId: input.organizationId,
        meterType: input.meterType,
        usageValue: input.create.usageValue,
        measurementWindowStart: input.measurementWindowStart,
        measurementWindowEnd: input.measurementWindowEnd,
        sourceType: input.create.sourceType,
        sourceReference: input.create.sourceReference ?? null,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      })),
    } as unknown as UsageMeterRepository;

    const service = new UsageMeterService(
      {} as DbClient,
      {
        countByOrganization: vi.fn().mockResolvedValue(3),
      } as never,
      {
        countByOrganization: vi.fn().mockResolvedValue(10),
      } as never,
      {
        countByOrganizationCreatedAtRange: vi.fn().mockResolvedValue(2),
      } as never,
      {
        countByOrganizationCreatedAtRange: vi.fn().mockResolvedValue(1),
      } as never,
      {
        countSucceededByOrganizationAndRequestedAtRange: vi.fn().mockResolvedValue(0),
      } as never,
      usageMeterRepository,
      {
        requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
      } as never,
      {
        create: vi.fn().mockResolvedValue(undefined),
      } as never,
      {
        create: vi.fn().mockResolvedValue(undefined),
      } as never,
    );

    const usageMeters = await service.recordUsageMetersInTransaction({} as DbClient, {
      organizationId: "organization-id",
      actorUserId: "owner-id",
      correlationId: "corr-id",
      usageWindow: {
        start: new Date("2026-03-01T00:00:00.000Z"),
        end: new Date("2026-04-01T00:00:00.000Z"),
      },
      meterTypes: [UsageMeterType.users, UsageMeterType.forecast_jobs],
      sourceType: "test",
      sourceReference: "reference-id",
    });

    expect(usageMeters).toHaveLength(2);
    expect(usageMeters[0]?.organizationId).toBe("organization-id");
  });
});
