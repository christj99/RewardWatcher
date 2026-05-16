import { describe, expect, it } from "vitest";

import { combineConfidence, downgradeConfidence } from "../confidence.js";

describe("confidence helpers", () => {
  it("combines HIGH + HIGH as HIGH", () => {
    expect(combineConfidence(["HIGH", "HIGH"])).toBe("HIGH");
  });

  it("combines HIGH + MEDIUM as MEDIUM", () => {
    expect(combineConfidence(["HIGH", "MEDIUM"])).toBe("MEDIUM");
  });

  it("combines HIGH + LOW as LOW", () => {
    expect(combineConfidence(["HIGH", "LOW"])).toBe("LOW");
  });

  it("preserves UNKNOWN as conservative material confidence", () => {
    expect(combineConfidence(["HIGH", "UNKNOWN"])).toBe("UNKNOWN");
  });

  it("activation-style downgrade lowers confidence one step", () => {
    expect(downgradeConfidence("HIGH")).toBe("MEDIUM");
    expect(downgradeConfidence("LOW")).toBe("UNKNOWN");
  });
});
