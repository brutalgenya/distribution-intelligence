import { IntegrationDirection, IntegrationSyncType, IntegrationType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { CsvImportIntegrationAdapter } from "../../modules/integrations/csv-import.integration-adapter.js";
import { ManualBridgeIntegrationAdapter } from "../../modules/integrations/manual-bridge.integration-adapter.js";

describe("integration adapters", () => {
  it("loads manual bridge records deterministically", async () => {
    const adapter = new ManualBridgeIntegrationAdapter();

    const records = await adapter.loadInboundRecords({
      connection: {
        id: "connection-id",
        organizationId: "organization-id",
        integrationType: IntegrationType.manual_bridge,
        name: "Manual",
        status: "active",
        configJson: {},
        credentialsRef: null,
        lastSyncAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      syncType: IntegrationSyncType.catalog_import,
      direction: IntegrationDirection.inbound,
      inputPayload: {
        records: [
          {
            kind: "catalog_sku",
            sourceReference: "ext-1",
            payload: {
              skuCode: "SKU-001",
              name: "Widget",
              baseUom: "each",
              packSize: 1,
              status: "active",
            },
          },
        ],
      },
    });

    expect(records).toHaveLength(1);
    expect(records[0]?.kind).toBe("catalog_sku");
  });

  it("parses CSV demand records into structured external records", async () => {
    const adapter = new CsvImportIntegrationAdapter();

    const records = await adapter.loadInboundRecords({
      connection: {
        id: "connection-id",
        organizationId: "organization-id",
        integrationType: IntegrationType.csv_import,
        name: "CSV",
        status: "active",
        configJson: {},
        credentialsRef: null,
        lastSyncAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      syncType: IntegrationSyncType.demand_import,
      direction: IntegrationDirection.inbound,
      inputPayload: {
        csvContent:
          'kind,sourceReference,orderNumber,orderedAt,linesJson\ncustomer_order,erp-order-1,ORD-1,2026-03-28T08:30:00.000Z,"[{""skuCode"":""SKU-001"",""locationCode"":""WH-1"",""quantity"":3}]"',
      },
    });

    expect(records).toHaveLength(1);
    expect(records[0]?.kind).toBe("customer_order");
  });
});
