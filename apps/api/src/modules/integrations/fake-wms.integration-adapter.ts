import { IntegrationType } from "@prisma/client";

import type {
  IntegrationAdapter,
  IntegrationAdapterLoadInput,
  IntegrationOutboundCommand,
  IntegrationOutboundCommandResult,
} from "./integration-adapter.types.js";
import { buildMockOutboundResult, loadManualRecords } from "./integration-adapter.helpers.js";
import type { ExternalIntegrationRecord } from "./integration.schemas.js";

export class FakeWmsIntegrationAdapter implements IntegrationAdapter {
  public readonly supportedIntegrationType = IntegrationType.wms;

  public async loadInboundRecords(input: IntegrationAdapterLoadInput): Promise<ExternalIntegrationRecord[]> {
    return loadManualRecords(input);
  }

  public async dispatchOutboundCommand(
    input: IntegrationOutboundCommand,
  ): Promise<IntegrationOutboundCommandResult> {
    return {
      ...buildMockOutboundResult(input),
      externalReference: `fake-wms:${input.commandType}:${input.correlationId}`,
    };
  }
}
