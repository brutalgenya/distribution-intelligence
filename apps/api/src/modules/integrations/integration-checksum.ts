import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

const stableStringify = (value: Prisma.JsonValue | Prisma.InputJsonValue | unknown): string => {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`).join(",")}}`;
  }

  return JSON.stringify(String(value));
};

export const buildPayloadChecksum = (value: Prisma.JsonValue | Prisma.InputJsonValue | unknown): string =>
  createHash("sha256").update(stableStringify(value)).digest("hex");
