import { AsyncLocalStorage } from "node:async_hooks";

export interface ExecutionContext {
  correlationId?: string;
  requestId?: string | null;
  traceId?: string | null;
  organizationId?: string | null;
  userId?: string | null;
  module?: string;
  operation?: string;
  decisionId?: string | null;
  executionTaskId?: string | null;
  forecastJobId?: string | null;
  aiRunId?: string | null;
  workerType?: string | null;
  supportAction?: string | null;
}

const executionContextStore = new AsyncLocalStorage<ExecutionContext>();

export const getExecutionContext = (): ExecutionContext => executionContextStore.getStore() ?? {};

export const setExecutionContext = (context: ExecutionContext): void => {
  executionContextStore.enterWith({
    ...getExecutionContext(),
    ...context,
  });
};

export const runWithExecutionContext = <T>(
  context: ExecutionContext,
  operation: () => T,
): T =>
  executionContextStore.run(
    {
      ...getExecutionContext(),
      ...context,
    },
    operation,
  );

export const mergeExecutionContext = (context: ExecutionContext): ExecutionContext => ({
  ...getExecutionContext(),
  ...context,
});
