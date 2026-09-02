import type { Role, RoleCode } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";

export class RoleRepository {
  public findByCode(db: DbClient, code: RoleCode): Promise<Role | null> {
    return db.role.findUnique({
      where: { code },
    });
  }
}
