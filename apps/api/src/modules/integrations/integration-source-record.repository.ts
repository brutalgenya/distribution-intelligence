import type { IntegrationSourceRecord, IntegrationSyncType } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class IntegrationSourceRecordRepository {
  public findByExternalReference(
    db: DbClient,
    input: { organizationId: string; integrationConnectionId: string; recordType: string; externalReference: string },
  ): Promise<IntegrationSourceRecord | null> {
    return db.integrationSourceRecord.findUnique({
      where: {
        organizationId_integrationConnectionId_recordType_externalReference: {
          organizationId: input.organizationId,
          integrationConnectionId: input.integrationConnectionId,
          recordType: input.recordType,
          externalReference: input.externalReference,
        },
      },
    });
  }

  public upsert(
    db: DbClient,
    input: {
      organizationId: string;
      integrationConnectionId: string;
      syncRunId?: string | null;
      syncType: IntegrationSyncType;
      recordType: string;
      externalReference: string;
      payloadChecksum: string;
      canonicalEntityType?: string | null;
      canonicalEntityId?: string | null;
      processedAt: Date;
    },
  ): Promise<IntegrationSourceRecord> {
    return db.integrationSourceRecord.upsert({
      where: {
        organizationId_integrationConnectionId_recordType_externalReference: {
          organizationId: input.organizationId,
          integrationConnectionId: input.integrationConnectionId,
          recordType: input.recordType,
          externalReference: input.externalReference,
        },
      },
      create: {
        organizationId: input.organizationId,
        integrationConnectionId: input.integrationConnectionId,
        ...(input.syncRunId ? { syncRunId: input.syncRunId } : {}),
        syncType: input.syncType,
        recordType: input.recordType,
        externalReference: input.externalReference,
        payloadChecksum: input.payloadChecksum,
        ...(input.canonicalEntityType ? { canonicalEntityType: input.canonicalEntityType } : {}),
        ...(input.canonicalEntityId ? { canonicalEntityId: input.canonicalEntityId } : {}),
        firstProcessedAt: input.processedAt,
        lastProcessedAt: input.processedAt,
      },
      update: {
        ...(input.syncRunId ? { syncRunId: input.syncRunId } : { syncRunId: null }),
        payloadChecksum: input.payloadChecksum,
        ...(input.canonicalEntityType ? { canonicalEntityType: input.canonicalEntityType } : { canonicalEntityType: null }),
        ...(input.canonicalEntityId ? { canonicalEntityId: input.canonicalEntityId } : { canonicalEntityId: null }),
        lastProcessedAt: input.processedAt,
      },
    });
  }
}
