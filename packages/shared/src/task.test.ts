import { describe, it, expect } from "vitest";
import {
  createTaskBodySchema,
  updateTaskBodySchema,
  taskSchema,
} from "./task.ts";

describe("createTaskBodySchema", () => {
  it("accepts a valid title", () => {
    expect(createTaskBodySchema.parse({ title: "Buy milk" })).toEqual({
      title: "Buy milk",
    });
  });
  it("rejects an empty title", () => {
    expect(() => createTaskBodySchema.parse({ title: "" })).toThrow();
  });
});

describe("updateTaskBodySchema", () => {
  it("rejects an empty patch (neither field present)", () => {
    expect(() => updateTaskBodySchema.parse({})).toThrow();
  });
});

describe("taskSchema", () => {
  it("parses a complete task", () => {
    const t = { id: "1", title: "x", isCompleted: false };
    expect(taskSchema.parse(t)).toEqual(t);
  });
});
