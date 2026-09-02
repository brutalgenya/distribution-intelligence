import type { Prisma } from "@prisma/client";

export interface TransactionRunner {
  run<T>(operation: (db: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}
