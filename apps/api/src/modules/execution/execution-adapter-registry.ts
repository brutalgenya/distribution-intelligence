import type { ExecutionTargetSystem, ExecutionTaskType } from "@prisma/client";

import { NotFoundError } from "../../shared/errors.js";
import type { ExecutionAdapter } from "./execution-adapter.js";

export class ExecutionAdapterRegistry {
  public constructor(private readonly adapters: ExecutionAdapter[]) {}

  public getAdapter(taskType: ExecutionTaskType, targetSystem: ExecutionTargetSystem): ExecutionAdapter {
    const adapter = this.adapters.find(
      (candidate) => candidate.taskType === taskType && candidate.targetSystem === targetSystem,
    );

    if (!adapter) {
      throw new NotFoundError(`No execution adapter is configured for ${taskType} on ${targetSystem}.`);
    }

    return adapter;
  }
}
