import { LocationStatus, Prisma, type Location } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { ConflictError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import type { CreateLocationInput, LocationDto } from "./inventory.schemas.js";
import { LocationRepository } from "./location.repository.js";

const toLocationDto = (location: Location): LocationDto => ({
  id: location.id,
  organizationId: location.organizationId,
  code: location.code,
  name: location.name,
  type: location.type,
  status: location.status,
  createdAt: location.createdAt.toISOString(),
  updatedAt: location.updatedAt.toISOString(),
});

export class LocationService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly locationRepository: LocationRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async createLocation(context: RequestContext, input: CreateLocationInput): Promise<LocationDto> {
    const organizationId = requireActiveOrganizationId(context);

    try {
      return await this.transactionRunner.run(async (db) => {
        await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "inventory.write");

        const location = await this.locationRepository.create(db, {
          organizationId,
          code: input.code,
          name: input.name,
          type: input.type,
          status: input.status,
        });

        await this.auditEventRepository.create(db, {
          organizationId,
          actorUserId: context.user.id,
          eventType: "inventory.location.created",
          entityType: "Location",
          entityId: location.id,
          payload: {
            code: location.code,
            name: location.name,
            type: location.type,
            status: location.status,
          },
          correlationId: context.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId,
          eventType: "inventory.location.created.v1",
          aggregateType: "Location",
          aggregateId: location.id,
          payload: {
            organizationId,
            locationId: location.id,
            code: location.code,
            status: location.status,
          },
        });

        return toLocationDto(location);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("Location code already exists in this organization.");
      }

      throw error;
    }
  }

  public async listLocations(
    context: RequestContext,
    filters: {
      status?: LocationStatus;
    },
  ): Promise<LocationDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "inventory.read");

    const locations = await this.locationRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
    });

    return locations.map(toLocationDto);
  }
}
