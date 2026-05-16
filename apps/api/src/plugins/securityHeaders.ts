import type { FastifyInstance } from "fastify";

export async function registerSecurityHeaders(
  server: FastifyInstance,
): Promise<void> {
  server.addHook("onRequest", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");
    reply.header(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
  });
}
