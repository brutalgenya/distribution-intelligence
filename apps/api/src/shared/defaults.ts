import type { Prisma } from "@prisma/client";

export interface DefaultEntitlement {
  key: string;
  value: Prisma.InputJsonValue;
}

export const DEFAULT_ORGANIZATION_ENTITLEMENTS: DefaultEntitlement[] = [
  { key: "foundation.identity", value: { enabled: true } },
  { key: "foundation.audit", value: { enabled: true } },
  { key: "foundation.outbox", value: { enabled: true } },
];
