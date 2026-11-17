import { describe, expect, it } from "vitest";
import { dataForSeoApiUrl } from "./api-path";

describe("DataForSEO Maps API paths", () => {
  it("adds the v3 Maps path to task endpoints", () => {
    expect(dataForSeoApiUrl("/task_post")).toBe(
      "https://api.dataforseo.com/v3/serp/google/maps/task_post",
    );
    expect(dataForSeoApiUrl("/tasks_ready")).toBe(
      "https://api.dataforseo.com/v3/serp/google/maps/tasks_ready",
    );
  });

  it("keeps the full versioned task-get path intact", () => {
    expect(dataForSeoApiUrl("/v3/serp/google/maps/task_get/advanced/example")).toBe(
      "https://api.dataforseo.com/v3/serp/google/maps/task_get/advanced/example",
    );
  });
});
