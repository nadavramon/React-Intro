import { describe, it, expect } from "vitest";
import { errorResponseSchema } from "./error.ts";

describe("errorResponseSchema", () => {
  it("accepts a string error", () => {
    expect(errorResponseSchema.parse({ error: "boom" })).toEqual({
      error: "boom",
    });
  });
  it("rejects a missing or non-string error", () => {
    expect(() => errorResponseSchema.parse({})).toThrow();
    expect(() => errorResponseSchema.parse({ error: 123 })).toThrow();
  });
});
