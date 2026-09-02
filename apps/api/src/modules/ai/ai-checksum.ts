import { createHash } from "node:crypto";

const stableSerialize = (value: unknown): string => {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  switch (typeof value) {
    case "boolean":
    case "number":
    case "string":
      return JSON.stringify(value);
    case "object": {
      const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
        left.localeCompare(right),
      );

      return `{${entries
        .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
        .join(",")}}`;
    }
    default:
      return JSON.stringify(String(value));
  }
};

export const createPayloadChecksum = (value: unknown): string =>
  createHash("sha256").update(stableSerialize(value)).digest("hex");
