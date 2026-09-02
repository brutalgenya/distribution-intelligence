import type {
  IntegrationConnection,
  IntegrationDirection,
  IntegrationSyncRun,
  IntegrationSyncType,
  IntegrationType,
  Prisma,
} from "@prisma/client";

import type { ExternalIntegrationRecord } from "./integration.schemas.js";

export interface IntegrationAdapterLoadInput {
  connection: IntegrationConnection;
  syncType: IntegrationSyncType;
  direction: IntegrationDirection;
  inputPayload: Prisma.JsonValue | Prisma.InputJsonValue | null;
}

export interface IntegrationOutboundCommand {
  connection: IntegrationConnection;
  commandType: "create_purchase_order" | "publish_inventory_update" | "export_decision";
  payload: Prisma.InputJsonValue;
  correlationId: string;
}

export interface IntegrationOutboundCommandResult {
  acknowledged: boolean;
  externalReference: string;
  responsePayload: Prisma.InputJsonValue;
}

export interface IntegrationAdapter {
  readonly supportedIntegrationType: IntegrationType;
  loadInboundRecords(input: IntegrationAdapterLoadInput): Promise<ExternalIntegrationRecord[]>;
  dispatchOutboundCommand(input: IntegrationOutboundCommand): Promise<IntegrationOutboundCommandResult>;
}

export interface IntegrationRunEnvelope {
  connection: IntegrationConnection;
  syncRun: IntegrationSyncRun;
}
