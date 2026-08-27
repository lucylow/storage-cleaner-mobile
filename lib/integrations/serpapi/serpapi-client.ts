import { xanoClient } from "@/lib/integrations/xano/xano-client";
import { getXanoConfig } from "@/lib/integrations/xano/xano-config";
import type { SearchOptions, SearchResult, SerpApiClient } from "./serpapi-types";

/**
 * Privacy-safe client: mobile calls the backend, the backend calls SerpAPI with secrets.
 * No SerpAPI key is ever bundled in the app.
 */
export class XanoSerpApiClient implements SerpApiClient {
  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    return xanoClient.post<SearchResult>(
      "/v1/web-intelligence/search",
      {
        query,
        options,
        deviceId: options?.deviceId,
      },
      { timeoutMs: getXanoConfig().webIntelligenceTimeoutMs },
    );
  }
}

export const serpApiClient = new XanoSerpApiClient();
