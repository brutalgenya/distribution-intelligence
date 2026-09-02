import "dotenv/config";

import { buildApp } from "./app.js";
import { loadConfig } from "./infrastructure/config/env.js";

const start = async (): Promise<void> => {
  const config = loadConfig(process.env);
  const app = await buildApp({ config });

  try {
    await app.listen({
      host: "0.0.0.0",
      port: config.PORT,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
