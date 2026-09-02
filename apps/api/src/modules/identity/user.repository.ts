import type { Prisma, User } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class UserRepository {
  public findById(db: DbClient, id: string): Promise<User | null> {
    return db.user.findUnique({
      where: { id },
    });
  }

  public findByEmail(db: DbClient, email: string): Promise<User | null> {
    return db.user.findUnique({
      where: { email },
    });
  }

  public create(db: DbClient, data: Prisma.UserUncheckedCreateInput): Promise<User> {
    return db.user.create({ data });
  }
}
