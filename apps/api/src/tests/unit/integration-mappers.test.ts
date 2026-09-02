import { describe, expect, it } from "vitest";

import {
  mapCatalogRecord,
  mapDemandRecord,
  mapInventoryRecord,
} from "../../modules/integrations/integration.mappers.js";

describe("integration mappers", () => {
  it("maps external catalog and inventory records into canonical DTOs", () => {
    const catalogRecord = mapCatalogRecord({
      kind: "catalog_sku",
      sourceReference: "erp-sku-1",
      payload: {
        skuCode: "SKU-001",
        name: "Widget",
        baseUom: "each",
        packSize: 1,
        status: "active",
      },
    });

    const inventoryRecord = mapInventoryRecord({
      kind: "inventory_snapshot",
      sourceReference: "wms-snapshot-1",
      payload: {
        skuCode: "SKU-001",
        locationCode: "WH-1",
        onHandQty: 25,
      },
    });

    expect(catalogRecord).toEqual(
      expect.objectContaining({
        kind: "catalog_sku",
        externalReference: "erp-sku-1",
        skuCode: "SKU-001",
      }),
    );
    expect(inventoryRecord).toEqual(
      expect.objectContaining({
        kind: "inventory_snapshot",
        externalReference: "wms-snapshot-1",
        onHandQty: 25,
      }),
    );
  });

  it("maps external demand records into canonical DTOs", () => {
    const demandRecord = mapDemandRecord({
      kind: "customer_order",
      sourceReference: "erp-order-1",
      payload: {
        orderNumber: "ORD-1001",
        orderedAt: "2026-03-28T08:30:00.000Z",
        lines: [
          {
            skuCode: "SKU-001",
            locationCode: "WH-1",
            quantity: 5,
          },
        ],
      },
    });

    expect(demandRecord).toEqual(
      expect.objectContaining({
        kind: "customer_order",
        externalReference: "erp-order-1",
        orderNumber: "ORD-1001",
      }),
    );
  });
});
