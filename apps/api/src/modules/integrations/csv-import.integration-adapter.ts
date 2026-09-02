import { IntegrationType } from "@prisma/client";

import type {
  IntegrationAdapter,
  IntegrationAdapterLoadInput,
  IntegrationOutboundCommand,
  IntegrationOutboundCommandResult,
} from "./integration-adapter.types.js";
import { buildMockOutboundResult, loadCsvRecords } from "./integration-adapter.helpers.js";
import type { ExternalIntegrationRecord } from "./integration.schemas.js";

export class CsvImportIntegrationAdapter implements IntegrationAdapter {
  public readonly supportedIntegrationType = IntegrationType.csv_import;

  public async loadInboundRecords(input: IntegrationAdapterLoadInput): Promise<ExternalIntegrationRecord[]> {
    return loadCsvRecords(input);
  }

  public async dispatchOutboundCommand(
    input: IntegrationOutboundCommand,
  ): Promise<IntegrationOutboundCommandResult> {
    return buildMockOutboundResult(input);
  }
}
