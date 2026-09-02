import { IntegrationType } from "@prisma/client";

import type {
  IntegrationAdapter,
  IntegrationAdapterLoadInput,
  IntegrationOutboundCommand,
  IntegrationOutboundCommandResult,
} from "./integration-adapter.types.js";
import { buildMockOutboundResult, loadManualRecords } from "./integration-adapter.helpers.js";
import type { ExternalIntegrationRecord } from "./integration.schemas.js";

export class ManualBridgeIntegrationAdapter implements IntegrationAdapter {
  public readonly supportedIntegrationType = IntegrationType.manual_bridge;

  public async loadInboundRecords(input: IntegrationAdapterLoadInput): Promise<ExternalIntegrationRecord[]> {
    return loadManualRecords(input);
  }

  public async dispatchOutboundCommand(
    input: IntegrationOutboundCommand,
  ): Promise<IntegrationOutboundCommandResult> {
    return buildMockOutboundResult(input);
  }
}
