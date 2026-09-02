import { Prisma } from "@prisma/client";

import {
  ExecutionAdapter,
  ExecutionAdapterError,
  type ExecutionAdapterExecuteInput,
  type ExecutionAdapterSuccessResult,
} from "./execution-adapter.js";
import { PurchaseOrderExecutionBridge } from "./purchase-order-execution-bridge.js";

const toExecutionAdapterError = (error: unknown): ExecutionAdapterError => {
  if (error instanceof ExecutionAdapterError) {
    return error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return new ExecutionAdapterError("database_error", error.message, true);
  }

  if (error instanceof Error) {
    return new ExecutionAdapterError("supply_execution_failed", error.message, false);
  }

  return new ExecutionAdapterError("supply_execution_failed", "Supply execution failed.", false);
};

export class InternalSupplyExecutionAdapter implements ExecutionAdapter {
  public readonly taskType = "create_purchase_order" as const;
  public readonly targetSystem = "internal_supply" as const;

  public constructor(private readonly purchaseOrderExecutionBridge: PurchaseOrderExecutionBridge) {}

  public async execute(input: ExecutionAdapterExecuteInput): Promise<ExecutionAdapterSuccessResult> {
    try {
      return await this.purchaseOrderExecutionBridge.execute(input);
    } catch (error) {
      throw toExecutionAdapterError(error);
    }
  }
}
