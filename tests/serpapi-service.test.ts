import { beforeEach, describe, expect, it, vi } from "vitest";

const search = vi.fn();

vi.mock("../lib/integrations/serpapi/serpapi-client", () => ({
  serpApiClient: { search: (...args: unknown[]) => search(...args) },
}));

vi.mock("../lib/integrations/serpapi/serpapi-config", () => ({
  getSerpApiConfig: () => ({ enabled: true }),
  isWebIntelligenceFlagEnabled: () => true,
}));

import { clearCachedSearches } from "../lib/integrations/serpapi/serpapi-cache";
import { buildStorageQueryContext } from "../lib/integrations/serpapi/query-builder";
import { searchStorageWebInsight } from "../lib/integrations/serpapi/serpapi-service";

describe("storage web insight fallback", () => {
  beforeEach(() => {
    search.mockReset();
    clearCachedSearches();
  });

  it("falls back to the second-largest category when the first result is empty", async () => {
    search
      .mockResolvedValueOnce({
        query: "How to review duplicate photos and large video files on iOS safely",
        markdown: "",
        textBlocks: [],
        references: [],
        relatedQuestions: [],
      })
      .mockResolvedValueOnce({
        query: "How to review duplicate photos on iOS and keep one original",
        markdown: "Offload unused movies after you review them.",
        textBlocks: [],
        references: [],
        relatedQuestions: [],
      });

    const payload = await searchStorageWebInsight(
      buildStorageQueryContext(
        [
          { category: "duplicates", size: 12000 },
          { category: "large", size: 4000 },
        ],
        "ios",
      ),
    );

    expect(payload.markdown).toContain("Offload unused movies");
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("coalesces in-flight searches for the same query", async () => {
    let resolveSearch: (value: unknown) => void = () => undefined;
    search.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
    );

    const context = buildStorageQueryContext([{ category: "temporary", size: 800 }], "android");
    const first = searchStorageWebInsight(context);
    const second = searchStorageWebInsight(context);
    resolveSearch({
      query: "Is it safe to remove temporary cache files on Android",
      markdown: "Clear app caches you no longer need.",
      textBlocks: [],
      references: [],
      relatedQuestions: [],
    });

    const [left, right] = await Promise.all([first, second]);
    expect(left.markdown).toBe(right.markdown);
    expect(search).toHaveBeenCalledTimes(1);
  });
});
