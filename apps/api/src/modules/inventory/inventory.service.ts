import {
  InventoryReservationStatus,
  InventoryTransferStatus,
  LocationStatus,
  SkuStatus,
  type InventoryMovement,
  type InventoryPosition,
  type InventoryReservation,
  type InventoryTransfer,
  type Location,
  type Sku,
} from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { SkuRepository } from "../catalog/sku.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import {
  type CreateAdjustmentInput,
  type CreateReceiptInput,
  type CreateReservationInput,
  type CreateTransferInput,
  type InventoryMovementDto,
  type InventoryMutationResultDto,
  type InventoryPositionDto,
  type InventoryReservationDto,
  type InventoryReservationResultDto,
  type InventoryTransferDto,
  type InventoryTransferResultDto,
} from "./inventory.schemas.js";
import {
  InventoryPositionRepository,
  type InventoryPositionScope,
} from "./inventory-position.repository.js";
import { InventoryMovementRepository } from "./inventory-movement.repository.js";
import { InventoryRecomputationService } from "./inventory-recomputation.service.js";
import { InventoryReservationRepository } from "./inventory-reservation.repository.js";
import { InventoryTransferRepository } from "./inventory-transfer.repository.js";
import { LocationRepository } from "./location.repository.js";

const toInventoryPositionDto = (position: InventoryPosition): InventoryPositionDto => ({
  id: position.id,
  organizationId: position.organizationId,
  skuId: position.skuId,
  locationId: position.locationId,
  onHandQty: position.onHandQty,
  reservedQty: position.reservedQty,
  inTransitQty: position.inTransitQty,
  availableToPromiseQty: position.availableToPromiseQty,
  safetyStockQty: position.safetyStockQty,
  reorderPointQty: position.reorderPointQty,
  createdAt: position.createdAt.toISOString(),
  updatedAt: position.updatedAt.toISOString(),
});

const toInventoryMovementDto = (movement: InventoryMovement): InventoryMovementDto => ({
  id: movement.id,
  organizationId: movement.organizationId,
  skuId: movement.skuId,
  locationId: movement.locationId,
  movementType: movement.movementType,
  quantity: movement.quantity,
  referenceType: movement.referenceType,
  referenceId: movement.referenceId,
  notes: movement.notes,
  createdByUserId: movement.createdByUserId,
  createdAt: movement.createdAt.toISOString(),
});

const toInventoryReservationDto = (reservation: InventoryReservation): InventoryReservationDto => ({
  id: reservation.id,
  organizationId: reservation.organizationId,
  skuId: reservation.skuId,
  locationId: reservation.locationId,
  quantity: reservation.quantity,
  status: reservation.status,
  referenceType: reservation.referenceType,
  referenceId: reservation.referenceId,
  notes: reservation.notes,
  createdByUserId: reservation.createdByUserId,
  createdAt: reservation.createdAt.toISOString(),
  releasedAt: reservation.releasedAt?.toISOString() ?? null,
});

const toInventoryTransferDto = (transfer: InventoryTransfer): InventoryTransferDto => ({
  id: transfer.id,
  organizationId: transfer.organizationId,
  skuId: transfer.skuId,
  sourceLocationId: transfer.sourceLocationId,
  destinationLocationId: transfer.destinationLocationId,
  quantity: transfer.quantity,
  status: transfer.status,
  referenceType: transfer.referenceType ?? null,
  referenceId: transfer.referenceId ?? null,
  notes: transfer.notes ?? null,
  requestedByUserId: transfer.requestedByUserId,
  completedByUserId: transfer.completedByUserId ?? null,
  createdAt: transfer.createdAt.toISOString(),
  completedAt: transfer.completedAt?.toISOString() ?? null,
});

export class InventoryService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly skuRepository: SkuRepository,
    private readonly locationRepository: LocationRepository,
    private readonly inventoryPositionRepository: InventoryPositionRepository,
    private readonly inventoryMovementRepository: InventoryMovementRepository,
    private readonly inventoryReservationRepository: InventoryReservationRepository,
    private readonly inventoryTransferRepository: InventoryTransferRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly inventoryRecomputationService: InventoryRecomputationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async listPositions(
    context: RequestContext,
    filters: {
      skuId?: string;
      locationId?: string;
    },
  ): Promise<InventoryPositionDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "inventory.read");

    const positions = await this.inventoryPositionRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.skuId ? { skuId: filters.skuId } : {}),
      ...(filters.locationId ? { locationId: filters.locationId } : {}),
    });

    return positions.map(toInventoryPositionDto);
  }

  public async getPosition(context: RequestContext, positionId: string): Promise<InventoryPositionDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "inventory.read");

    const position = await this.inventoryPositionRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: positionId,
    });
    if (!position) {
      throw new NotFoundError("Inventory position was not found.");
    }

    return toInventoryPositionDto(position);
  }

  public async receiveInventory(
    context: RequestContext,
    input: CreateReceiptInput,
  ): Promise<InventoryMutationResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "inventory.write");
      return this.receiveInventoryInTransaction(db, context, input);
    });
  }

  public async receiveInventoryInTransaction(
    db: DbClient,
    context: RequestContext,
    input: CreateReceiptInput,
  ): Promise<InventoryMutationResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    await this.requireUsableSku(db, organizationId, input.skuId);
    await this.requireUsableLocation(db, organizationId, input.locationId);

    const movement = await this.inventoryMovementRepository.create(db, {
      organizationId,
      skuId: input.skuId,
      locationId: input.locationId,
      movementType: "receipt",
      quantity: input.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      ...(input.notes ? { notes: input.notes } : {}),
      createdByUserId: context.user.id,
    });

    const position = await this.inventoryRecomputationService.recomputePosition(
      db,
      {
        organizationId,
        skuId: input.skuId,
        locationId: input.locationId,
      },
      { emitOutboxEvent: true },
    );

    await this.auditEventRepository.create(db, {
      organizationId,
      actorUserId: context.user.id,
      eventType: "inventory.received",
      entityType: "InventoryMovement",
      entityId: movement.id,
      payload: {
        skuId: input.skuId,
        locationId: input.locationId,
        quantity: input.quantity,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      },
      correlationId: context.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId,
      eventType: "inventory.received.v1",
      aggregateType: "InventoryMovement",
      aggregateId: movement.id,
      payload: {
        organizationId,
        skuId: input.skuId,
        locationId: input.locationId,
        quantity: input.quantity,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        positionId: position.id,
      },
    });

    return {
      movement: toInventoryMovementDto(movement),
      position: toInventoryPositionDto(position),
    };
  }

  public async adjustInventory(
    context: RequestContext,
    input: CreateAdjustmentInput,
  ): Promise<InventoryMutationResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "inventory.write");
      return this.adjustInventoryInTransaction(db, {
        organizationId,
        actorUserId: context.user.id,
        correlationId: context.correlationId,
        input,
      });
    });
  }

  public async adjustInventoryInTransaction(
    db: DbClient,
    input: {
      organizationId: string;
      actorUserId: string;
      correlationId: string;
      input: CreateAdjustmentInput;
    },
  ): Promise<InventoryMutationResultDto> {
    await this.requireUsableSku(db, input.organizationId, input.input.skuId);
    await this.requireUsableLocation(db, input.organizationId, input.input.locationId);

    const positionScope: InventoryPositionScope = {
      organizationId: input.organizationId,
      skuId: input.input.skuId,
      locationId: input.input.locationId,
    };

    if (input.input.quantity < 0) {
      const currentQuantities = await this.inventoryRecomputationService.calculatePositionQuantities(db, positionScope);
      if (Math.abs(input.input.quantity) > currentQuantities.availableToPromiseQty) {
        throw new ConflictError("Negative adjustment exceeds available stock.");
      }
    }

    const movement = await this.inventoryMovementRepository.create(db, {
      organizationId: input.organizationId,
      skuId: input.input.skuId,
      locationId: input.input.locationId,
      movementType: "adjustment",
      quantity: input.input.quantity,
      referenceType: input.input.referenceType,
      referenceId: input.input.referenceId,
      ...(input.input.reason ? { notes: input.input.reason } : {}),
      createdByUserId: input.actorUserId,
    });

    const position = await this.inventoryRecomputationService.recomputePosition(db, positionScope, {
      emitOutboxEvent: true,
    });

    await this.auditEventRepository.create(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: "inventory.adjusted",
      entityType: "InventoryMovement",
      entityId: movement.id,
      payload: {
        skuId: input.input.skuId,
        locationId: input.input.locationId,
        quantity: input.input.quantity,
        referenceType: input.input.referenceType,
        referenceId: input.input.referenceId,
        reason: input.input.reason ?? null,
      },
      correlationId: input.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: input.organizationId,
      eventType: "inventory.adjusted.v1",
      aggregateType: "InventoryMovement",
      aggregateId: movement.id,
      payload: {
        organizationId: input.organizationId,
        skuId: input.input.skuId,
        locationId: input.input.locationId,
        quantity: input.input.quantity,
        reason: input.input.reason ?? null,
        positionId: position.id,
      },
    });

    return {
      movement: toInventoryMovementDto(movement),
      position: toInventoryPositionDto(position),
    };
  }

  public async createReservation(
    context: RequestContext,
    input: CreateReservationInput,
  ): Promise<InventoryReservationResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "inventory.write");

      await this.requireUsableSku(db, organizationId, input.skuId);
      await this.requireUsableLocation(db, organizationId, input.locationId);

      const positionScope: InventoryPositionScope = {
        organizationId,
        skuId: input.skuId,
        locationId: input.locationId,
      };

      const currentQuantities = await this.inventoryRecomputationService.calculatePositionQuantities(db, positionScope);
      if (input.quantity > currentQuantities.availableToPromiseQty) {
        throw new ConflictError("Reservation quantity exceeds available stock.");
      }

      const reservation = await this.inventoryReservationRepository.create(db, {
        organizationId,
        skuId: input.skuId,
        locationId: input.locationId,
        quantity: input.quantity,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        ...(input.notes ? { notes: input.notes } : {}),
        createdByUserId: context.user.id,
      });

      await this.inventoryMovementRepository.create(db, {
        organizationId,
        skuId: input.skuId,
        locationId: input.locationId,
        movementType: "reservation",
        quantity: input.quantity,
        referenceType: "inventory_reservation",
        referenceId: reservation.id,
        ...(input.notes ? { notes: input.notes } : {}),
        createdByUserId: context.user.id,
      });

      const position = await this.inventoryRecomputationService.recomputePosition(db, positionScope, {
        emitOutboxEvent: true,
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "inventory.reserved",
        entityType: "InventoryReservation",
        entityId: reservation.id,
        payload: {
          skuId: input.skuId,
          locationId: input.locationId,
          quantity: input.quantity,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "inventory.reserved.v1",
        aggregateType: "InventoryReservation",
        aggregateId: reservation.id,
        payload: {
          organizationId,
          reservationId: reservation.id,
          skuId: input.skuId,
          locationId: input.locationId,
          quantity: input.quantity,
          positionId: position.id,
        },
      });

      return {
        reservation: toInventoryReservationDto(reservation),
        position: toInventoryPositionDto(position),
      };
    });
  }

  public async releaseReservation(
    context: RequestContext,
    reservationId: string,
  ): Promise<InventoryReservationResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "inventory.write");

      const reservation = await this.inventoryReservationRepository.findByIdForOrganization(db, {
        organizationId,
        id: reservationId,
      });
      if (!reservation) {
        throw new NotFoundError("Inventory reservation was not found.");
      }

      const positionScope: InventoryPositionScope = {
        organizationId,
        skuId: reservation.skuId,
        locationId: reservation.locationId,
      };

      if (reservation.status === InventoryReservationStatus.released) {
        const position = await this.inventoryRecomputationService.recomputePosition(db, positionScope);
        return {
          reservation: toInventoryReservationDto(reservation),
          position: toInventoryPositionDto(position),
        };
      }

      const releasedReservation = await this.inventoryReservationRepository.markReleased(db, {
        id: reservation.id,
        releasedAt: new Date(),
      });

      await this.inventoryMovementRepository.create(db, {
        organizationId,
        skuId: reservation.skuId,
        locationId: reservation.locationId,
        movementType: "reservation_release",
        quantity: reservation.quantity,
        referenceType: "inventory_reservation",
        referenceId: reservation.id,
        ...(reservation.notes ? { notes: reservation.notes } : {}),
        createdByUserId: context.user.id,
      });

      const position = await this.inventoryRecomputationService.recomputePosition(db, positionScope, {
        emitOutboxEvent: true,
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "inventory.released",
        entityType: "InventoryReservation",
        entityId: reservation.id,
        payload: {
          skuId: reservation.skuId,
          locationId: reservation.locationId,
          quantity: reservation.quantity,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "inventory.released.v1",
        aggregateType: "InventoryReservation",
        aggregateId: reservation.id,
        payload: {
          organizationId,
          reservationId: reservation.id,
          skuId: reservation.skuId,
          locationId: reservation.locationId,
          quantity: reservation.quantity,
          positionId: position.id,
        },
      });

      return {
        reservation: toInventoryReservationDto(releasedReservation),
        position: toInventoryPositionDto(position),
      };
    });
  }

  public async requestTransfer(
    context: RequestContext,
    input: CreateTransferInput,
  ): Promise<InventoryTransferResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "inventory.write");

      if (input.sourceLocationId === input.destinationLocationId) {
        throw new ConflictError("Source and destination locations must be different.");
      }

      await this.requireUsableSku(db, organizationId, input.skuId);
      await this.requireUsableLocation(db, organizationId, input.sourceLocationId);
      await this.requireUsableLocation(db, organizationId, input.destinationLocationId);

      const sourceScope: InventoryPositionScope = {
        organizationId,
        skuId: input.skuId,
        locationId: input.sourceLocationId,
      };
      const destinationScope: InventoryPositionScope = {
        organizationId,
        skuId: input.skuId,
        locationId: input.destinationLocationId,
      };

      const currentSourceQuantities = await this.inventoryRecomputationService.calculatePositionQuantities(
        db,
        sourceScope,
      );
      if (input.quantity > currentSourceQuantities.availableToPromiseQty) {
        throw new ConflictError("Transfer quantity exceeds available stock at the source location.");
      }

      const transfer = await this.inventoryTransferRepository.create(db, {
        organizationId,
        skuId: input.skuId,
        sourceLocationId: input.sourceLocationId,
        destinationLocationId: input.destinationLocationId,
        quantity: input.quantity,
        ...(input.referenceType ? { referenceType: input.referenceType } : {}),
        ...(input.referenceId ? { referenceId: input.referenceId } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        requestedByUserId: context.user.id,
      });

      await this.inventoryMovementRepository.create(db, {
        organizationId,
        skuId: input.skuId,
        locationId: input.sourceLocationId,
        movementType: "transfer_out",
        quantity: input.quantity,
        referenceType: "inventory_transfer",
        referenceId: transfer.id,
        ...(input.notes ? { notes: input.notes } : {}),
        createdByUserId: context.user.id,
      });

      const sourcePosition = await this.inventoryRecomputationService.recomputePosition(db, sourceScope, {
        emitOutboxEvent: true,
      });
      const destinationPosition = await this.inventoryRecomputationService.recomputePosition(
        db,
        destinationScope,
        { emitOutboxEvent: true },
      );

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "inventory.transfer.requested",
        entityType: "InventoryTransfer",
        entityId: transfer.id,
        payload: {
          skuId: input.skuId,
          sourceLocationId: input.sourceLocationId,
          destinationLocationId: input.destinationLocationId,
          quantity: input.quantity,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "inventory.transfer.requested.v1",
        aggregateType: "InventoryTransfer",
        aggregateId: transfer.id,
        payload: {
          organizationId,
          transferId: transfer.id,
          skuId: input.skuId,
          sourceLocationId: input.sourceLocationId,
          destinationLocationId: input.destinationLocationId,
          quantity: input.quantity,
          sourcePositionId: sourcePosition.id,
          destinationPositionId: destinationPosition.id,
        },
      });

      return {
        transfer: toInventoryTransferDto(transfer),
        sourcePosition: toInventoryPositionDto(sourcePosition),
        destinationPosition: toInventoryPositionDto(destinationPosition),
      };
    });
  }

  public async completeTransfer(
    context: RequestContext,
    transferId: string,
  ): Promise<InventoryTransferResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "inventory.write");

      const transfer = await this.inventoryTransferRepository.findByIdForOrganization(db, {
        organizationId,
        id: transferId,
      });
      if (!transfer) {
        throw new NotFoundError("Inventory transfer was not found.");
      }

      const sourcePosition = await this.inventoryRecomputationService.recomputePosition(
        db,
        {
          organizationId,
          skuId: transfer.skuId,
          locationId: transfer.sourceLocationId,
        },
        { emitOutboxEvent: false },
      );

      if (transfer.status === InventoryTransferStatus.completed) {
        const destinationPosition = await this.inventoryRecomputationService.recomputePosition(
          db,
          {
            organizationId,
            skuId: transfer.skuId,
            locationId: transfer.destinationLocationId,
          },
          { emitOutboxEvent: false },
        );

        return {
          transfer: toInventoryTransferDto(transfer),
          sourcePosition: toInventoryPositionDto(sourcePosition),
          destinationPosition: toInventoryPositionDto(destinationPosition),
        };
      }

      await this.inventoryMovementRepository.create(db, {
        organizationId,
        skuId: transfer.skuId,
        locationId: transfer.destinationLocationId,
        movementType: "transfer_in",
        quantity: transfer.quantity,
        referenceType: "inventory_transfer",
        referenceId: transfer.id,
        ...(transfer.notes ? { notes: transfer.notes } : {}),
        createdByUserId: context.user.id,
      });

      const completedTransfer = await this.inventoryTransferRepository.markCompleted(db, {
        id: transfer.id,
        completedByUserId: context.user.id,
        completedAt: new Date(),
      });

      const destinationPosition = await this.inventoryRecomputationService.recomputePosition(
        db,
        {
          organizationId,
          skuId: transfer.skuId,
          locationId: transfer.destinationLocationId,
        },
        { emitOutboxEvent: true },
      );

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "inventory.transfer.completed",
        entityType: "InventoryTransfer",
        entityId: transfer.id,
        payload: {
          skuId: transfer.skuId,
          sourceLocationId: transfer.sourceLocationId,
          destinationLocationId: transfer.destinationLocationId,
          quantity: transfer.quantity,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "inventory.transfer.completed.v1",
        aggregateType: "InventoryTransfer",
        aggregateId: transfer.id,
        payload: {
          organizationId,
          transferId: transfer.id,
          skuId: transfer.skuId,
          sourceLocationId: transfer.sourceLocationId,
          destinationLocationId: transfer.destinationLocationId,
          quantity: transfer.quantity,
          destinationPositionId: destinationPosition.id,
        },
      });

      return {
        transfer: toInventoryTransferDto(completedTransfer),
        sourcePosition: toInventoryPositionDto(sourcePosition),
        destinationPosition: toInventoryPositionDto(destinationPosition),
      };
    });
  }

  private async requireUsableSku(db: DbClient, organizationId: string, skuId: string): Promise<Sku> {
    const sku = await this.skuRepository.findByIdForOrganization(db, {
      organizationId,
      id: skuId,
    });
    if (!sku) {
      throw new NotFoundError("SKU was not found.");
    }
    if (sku.status !== SkuStatus.active) {
      throw new ForbiddenError("Inventory mutations require an active SKU.");
    }

    return sku;
  }

  private async requireUsableLocation(
    db: DbClient,
    organizationId: string,
    locationId: string,
  ): Promise<Location> {
    const location = await this.locationRepository.findByIdForOrganization(db, {
      organizationId,
      id: locationId,
    });
    if (!location) {
      throw new NotFoundError("Location was not found.");
    }
    if (location.status !== LocationStatus.active) {
      throw new ForbiddenError("Inventory mutations require an active location.");
    }

    return location;
  }
}
