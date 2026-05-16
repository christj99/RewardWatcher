import { buildServer } from "./server.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

const server = await buildServer();

try {
  await server.listen({ port: env.PORT, host: env.HOST });
  logger.info(`API listening on ${env.HOST}:${env.PORT}`);
} catch (error) {
  logger.error("API failed to start", error);
  process.exit(1);
}
