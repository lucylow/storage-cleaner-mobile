import { describe, expect, it } from "vitest";
import { buildStorageQueryContext, buildStorageWebQueries } from "../lib/integrations/serpapi/query-builder";

const namedItems = [
  { category: "duplicates" as const, size: 12000, name: "IMG_4821.JPG", location: "/var/mobile/Containers/IMG_4821.JPG" },
  { category: "large" as const, size: 4000, name: "vacation-video.mp4", location: "C:\\Users\\me\\Videos" },
  { category: "temporary" as const, size: 800, name: "cache.tmp", location: "ph://album/secret" },
];

describe("privacy-safe storage query builder", () => {
  it("builds at most two template queries and never includes filenames or paths", () => {
    const context = buildStorageQueryContext(namedItems, "ios");
    const queries = buildStorageWebQueries(context);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toBe("How to review duplicate photos and large video files on iOS safely");
    expect(queries[1]).toBe("How to review duplicate photos on iOS and keep one original");
    const joined = queries.join(" ");
    expect(joined).not.toMatch(/IMG_4821|vacation-video|cache\.tmp|\/var|C:\\|ph:\/\//i);
    expect(joined).not.toContain(namedItems[0].name);
  });

  it("uses Android wording for the largest category and skips empty scans", () => {
    const androidQueries = buildStorageWebQueries(
      buildStorageQueryContext([{ category: "large", size: 2048 }], "android"),
    );
    expect(androidQueries).toEqual(["What large video files are safe to offload on Android"]);
    expect(buildStorageWebQueries(buildStorageQueryContext([], "web"))).toEqual([]);
    expect(buildStorageWebQueries(buildStorageQueryContext([{ category: "duplicates", size: 0 }], "web"))).toEqual([]);
  });

  it("uses localized templates without filenames or paths", () => {
    const context = buildStorageQueryContext([{ category: "duplicates", size: 12000 }], "ios");
    const french = buildStorageWebQueries(context, "fr");
    expect(french).toEqual(["Comment examiner les photos en double sur iOS et garder un original"]);
    expect(buildStorageWebQueries(context, "es")[0]).toContain("fotos duplicadas");
    expect(buildStorageWebQueries(context, "de")[0]).toContain("Fotos");
    expect(buildStorageWebQueries(context, "pt-BR")[0]).toContain("fotos duplicadas");
  });
});
