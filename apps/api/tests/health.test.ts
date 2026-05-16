import { describe, expect, it } from "vitest";

import { buildServer } from "../src/server.js";
import { buildSeededServer } from "./testUtils.js";

describe("health and readiness", () => {
  it("returns a healthy response", async () => {
    const server = await buildServer();

    const response = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });

    await server.close();
  });

  it("returns readiness with database, version, and uptime", async () => {
    const server = await buildSeededServer();

    const response = await server.inject({
      method: "GET",
      url: "/ready",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("ready");
    expect(response.json().checks.database).toBe("ok");
    expect(response.json().uptimeSeconds).toEqual(expect.any(Number));

    await server.close();
  });
});
