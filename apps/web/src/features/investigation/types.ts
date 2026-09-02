import type { Decision } from "../decisions/types";
import type {
  AnomalyScore,
  DecisionOutcome,
  FillRateMeasurement,
  ForecastErrorMeasurement,
  InventoryPosition,
  Location,
  Sku,
  StockoutIncident,
} from "../outcomes/types";
import type { SupportExecutionTask } from "../workflow/types";

export interface InvestigationParams {
  skuId: string;
  locationId: string;
}

export type InvestigationRiskLevel = "critical" | "high" | "watch" | "stable";

export interface InvestigationRiskSummary {
  level: InvestigationRiskLevel;
  label: string;
  reasons: string[];
  freshnessAt: string | null;
}

export type CustomerOrderStatus = "open" | "cancelled";

export interface CustomerOrderLine {
  id: string;
  skuId: string;
  locationId: string;
  quantity: number;
  unitPrice: number | null;
  createdAt: string;
}

export interface CustomerOrder {
  id: string;
  organizationId: string;
  orderNumber: string;
  status: CustomerOrderStatus;
  customerReference: string | null;
  orderedAt: string;
  createdByUserId: string;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  lines: CustomerOrderLine[];
}

export interface MatchedCustomerOrder {
  order: CustomerOrder;
  matchingLines: CustomerOrderLine[];
  matchedQuantity: number;
}

export type ForecastJobStatus = "pending" | "running" | "completed" | "failed";
export type ForecastScopeType = "sku" | "sku_location" | "organization";
export type ForecastModelType = "baseline_recent_average";

export interface ForecastJob {
  id: string;
  organizationId: string;
  status: ForecastJobStatus;
  requestedByUserId: string;
  scopeType: ForecastScopeType;
  scopeReference: unknown;
  horizonDays: number;
  modelType: ForecastModelType;
  inputSnapshot: unknown;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ForecastResult {
  id: string;
  organizationId: string;
  forecastJobId: string;
  skuId: string;
  locationId: string | null;
  forecastDate: string;
  forecastQty: number;
  confidenceLow: number | null;
  confidenceHigh: number | null;
  modelType: ForecastModelType;
  createdAt: string;
}

export interface ForecastSnapshot {
  job: ForecastJob;
  results: ForecastResult[];
}

export type SupplierStatus = "active" | "inactive";

export interface Supplier {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  status: SupplierStatus;
  contactEmail: string | null;
  contactPhone: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierSku {
  id: string;
  organizationId: string;
  supplierId: string;
  skuId: string;
  supplierSkuCode: string | null;
  isPrimary: boolean;
  minOrderQty: number;
  casePackQty: number | null;
  unitCost: number | null;
  leadTimeDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierLeadTimeStat {
  id: string;
  organizationId: string;
  supplierId: string;
  skuId: string;
  sampleCount: number;
  averageLeadTimeDays: number;
  minLeadTimeDays: number;
  maxLeadTimeDays: number;
  lastObservedLeadTimeDays: number;
  lastObservedAt: string;
  updatedAt: string;
}

export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "partially_received"
  | "received"
  | "delayed"
  | "cancelled";

export interface PurchaseOrderLine {
  id: string;
  skuId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number | null;
  expectedLocationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  organizationId: string;
  supplierId: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  orderedAt: string | null;
  expectedDeliveryAt: string | null;
  receivedAt: string | null;
  currency: string | null;
  notes: string | null;
  wasEverDelayed: boolean;
  delayedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseOrderLine[];
}

export interface MatchedPurchaseOrder {
  purchaseOrder: PurchaseOrder;
  matchingLines: PurchaseOrderLine[];
  openQuantity: number;
}

export interface InvestigationContextData {
  sku: Sku;
  location: Location | null;
  position: InventoryPosition | null;
}

export interface InvestigationSignalsData {
  stockouts: StockoutIncident[];
  anomalies: AnomalyScore[];
  fillRates: FillRateMeasurement[];
  forecastErrors: ForecastErrorMeasurement[];
}

export interface InvestigationForecastDemandData {
  recentOrders: MatchedCustomerOrder[];
  forecastSnapshots: ForecastSnapshot[];
}

export interface InvestigationSupplyData {
  mappings: SupplierSku[];
  suppliers: Supplier[];
  leadTimeStats: SupplierLeadTimeStat[];
  openPurchaseOrders: MatchedPurchaseOrder[];
}

export interface InvestigationDecisionBundle {
  decision: Decision;
  executions: SupportExecutionTask[];
  outcomes: DecisionOutcome[];
}

export interface InvestigationDecisionData {
  decisions: InvestigationDecisionBundle[];
}
