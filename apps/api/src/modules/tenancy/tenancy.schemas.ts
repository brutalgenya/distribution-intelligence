import { InvitationStatus, RoleCode } from "@prisma/client";
import { z } from "zod";

export const organizationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createOrganizationBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(3).max(63).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationBodySchema>;

export const inviteMemberBodySchema = z.object({
  email: z.string().trim().email(),
  role: z.nativeEnum(RoleCode),
});

export type InviteMemberInput = z.infer<typeof inviteMemberBodySchema>;

export const acceptInvitationBodySchema = z.object({
  token: z.string().uuid(),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationBodySchema>;

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface MembershipDto {
  id: string;
  organizationId: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  role: RoleCode;
}

export interface EntitlementDto {
  id: string;
  key: string;
  value: unknown;
  createdAt: string;
}

export interface InvitationDto {
  id: string;
  organizationId: string;
  email: string;
  role: RoleCode;
  token: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface CreateOrganizationResultDto {
  organization: OrganizationDto;
  ownerMembership: MembershipDto;
}

export interface AcceptInvitationResultDto {
  membership: MembershipDto;
  invitationId: string;
  organization: OrganizationDto;
}
