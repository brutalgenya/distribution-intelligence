import type { FastifyInstance } from "fastify";

import {
  approvalTaskIdParamsSchema,
  createApprovalTaskBodySchema,
  createOperatorOverrideBodySchema,
  decideApprovalTaskBodySchema,
  decisionWorkflowParamsSchema,
  listApprovalTasksQuerySchema,
  listOperatorOverridesQuerySchema,
  requestDecisionApprovalBodySchema,
} from "../../../modules/workflow/workflow.schemas.js";
import {
  cancelExecutionTaskBodySchema,
  createExecutionTaskBodySchema,
  executionTaskIdParamsSchema,
  listExecutionTasksQuerySchema,
  retryExecutionTaskBodySchema,
} from "../../../modules/execution/execution.schemas.js";
import { activeOrganizationMiddleware } from "../middleware/active-organization.js";

export const registerWorkflowRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(async (workflowApp) => {
    workflowApp.addHook("preHandler", activeOrganizationMiddleware);

    workflowApp.post("/workflow/approvals", async (request, reply) => {
      const body = createApprovalTaskBodySchema.parse(request.body);
      const result = await request.server.container.services.decisionWorkflowService.createApprovalTask(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    workflowApp.post("/workflow/approvals/:id/approve", async (request) => {
      const params = approvalTaskIdParamsSchema.parse(request.params);
      const body = decideApprovalTaskBodySchema.parse(request.body ?? {});
      return request.server.container.services.decisionWorkflowService.approveApprovalTask(
        request.requestContext,
        params.id,
        body,
      );
    });

    workflowApp.post("/workflow/approvals/:id/reject", async (request) => {
      const params = approvalTaskIdParamsSchema.parse(request.params);
      const body = decideApprovalTaskBodySchema.parse(request.body ?? {});
      return request.server.container.services.decisionWorkflowService.rejectApprovalTask(
        request.requestContext,
        params.id,
        body,
      );
    });

    workflowApp.get("/workflow/approvals", async (request) => {
      const query = listApprovalTasksQuerySchema.parse(request.query);
      return request.server.container.services.approvalTaskService.listApprovalTasks(
        request.requestContext,
        {
          ...(query.status ? { status: query.status } : {}),
          ...(query.decisionId ? { decisionId: query.decisionId } : {}),
        },
      );
    });

    workflowApp.get("/workflow/approvals/:id", async (request) => {
      const params = approvalTaskIdParamsSchema.parse(request.params);
      return request.server.container.services.approvalTaskService.getApprovalTask(
        request.requestContext,
        params.id,
      );
    });

    workflowApp.post("/workflow/executions", async (request, reply) => {
      const body = createExecutionTaskBodySchema.parse(request.body);
      const result = await request.server.container.services.decisionWorkflowService.requestExecutionForDecision(
        request.requestContext,
        body.decisionId,
      );

      reply.status(201).send(result);
    });

    workflowApp.post("/workflow/executions/:id/process", async (request) => {
      const params = executionTaskIdParamsSchema.parse(request.params);
      return request.server.container.services.executionProcessorService.processExecutionTask(
        request.requestContext,
        params.id,
      );
    });

    workflowApp.post("/workflow/executions/:id/retry", async (request) => {
      const params = executionTaskIdParamsSchema.parse(request.params);
      const body = retryExecutionTaskBodySchema.parse(request.body ?? {});
      return request.server.container.services.executionTaskService.retryExecutionTask(
        request.requestContext,
        params.id,
        body,
      );
    });

    workflowApp.post("/workflow/executions/:id/cancel", async (request) => {
      const params = executionTaskIdParamsSchema.parse(request.params);
      const body = cancelExecutionTaskBodySchema.parse(request.body ?? {});
      return request.server.container.services.executionTaskService.cancelExecutionTask(
        request.requestContext,
        params.id,
        body,
      );
    });

    workflowApp.get("/workflow/executions", async (request) => {
      const query = listExecutionTasksQuerySchema.parse(request.query);
      return request.server.container.services.executionTaskService.listExecutionTasks(
        request.requestContext,
        {
          ...(query.status ? { status: query.status } : {}),
          ...(query.decisionId ? { decisionId: query.decisionId } : {}),
        },
      );
    });

    workflowApp.get("/workflow/executions/:id", async (request) => {
      const params = executionTaskIdParamsSchema.parse(request.params);
      return request.server.container.services.executionTaskService.getExecutionTask(
        request.requestContext,
        params.id,
      );
    });

    workflowApp.post("/workflow/overrides", async (request, reply) => {
      const body = createOperatorOverrideBodySchema.parse(request.body);
      const result = await request.server.container.services.operatorOverrideService.createOverride(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    workflowApp.get("/workflow/overrides", async (request) => {
      const query = listOperatorOverridesQuerySchema.parse(request.query);
      return request.server.container.services.operatorOverrideService.listOverrides(
        request.requestContext,
        {
          ...(query.decisionId ? { decisionId: query.decisionId } : {}),
          ...(query.executionTaskId ? { executionTaskId: query.executionTaskId } : {}),
          ...(query.overrideType ? { overrideType: query.overrideType } : {}),
        },
      );
    });

    workflowApp.post("/workflow/decisions/:id/request-approval", async (request, reply) => {
      const params = decisionWorkflowParamsSchema.parse(request.params);
      const body = requestDecisionApprovalBodySchema.parse(request.body ?? {});
      const result = await request.server.container.services.decisionWorkflowService.requestApprovalForDecision(
        request.requestContext,
        params.id,
        body,
      );

      reply.status(201).send(result);
    });

    workflowApp.post("/workflow/decisions/:id/request-execution", async (request, reply) => {
      const params = decisionWorkflowParamsSchema.parse(request.params);
      const result = await request.server.container.services.decisionWorkflowService.requestExecutionForDecision(
        request.requestContext,
        params.id,
      );

      reply.status(201).send(result);
    });
  });
};
