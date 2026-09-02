import { describe, expect, it, vi } from "vitest";

import { AppLogger } from "../../infrastructure/logging/app-logger.js";
import { getExecutionContext, runWithExecutionContext } from "../../infrastructure/telemetry/execution-context.js";

describe("execution context propagation", () => {
  it("merges async context into logger payloads", async () => {
    const info = vi.fn();
    const logger = new AppLogger({
      debug: vi.fn(),
      info,
      warn: vi.fn(),
      error: vi.fn(),
    } as never);

    await runWithExecutionContext(
      {
        correlationId: "corr-id",
        requestId: "request-id",
        organizationId: "org-id",
      },
      async () => {
        logger.child({ module: "support", operation: "inspect" }).info("hello", {
          decisionId: "decision-id",
        });
        expect(getExecutionContext().correlationId).toBe("corr-id");
      },
    );

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "corr-id",
        requestId: "request-id",
        organizationId: "org-id",
        module: "support",
        operation: "inspect",
        metadata: {
          decisionId: "decision-id",
        },
      }),
      "hello",
    );
  });
});
