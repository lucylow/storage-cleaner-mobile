export type SearchOptions = {
  language?: string;
  country?: string;
  device?: "mobile" | "desktop";
  continuable?: boolean;
  subsequentRequestToken?: string;
  deviceId?: string;
  isPro?: boolean;
  noCache?: boolean;
};

export type WebReference = {
  title: string;
  url: string;
  source?: string;
  snippet?: string;
  index: number;
};

export type SearchResult = {
  query: string;
  markdown?: string;
  textBlocks: Array<{ type: string; snippet: string }>;
  references: WebReference[];
  relatedQuestions: string[];
  subsequentRequestToken?: string;
  fromCache?: boolean;
  quotaRemaining?: number;
};

export type SearchResultPayload = SearchResult & {
  disabled: boolean;
  fromCache?: boolean;
};

export interface SerpApiClient {
  search(query: string, options?: SearchOptions): Promise<SearchResult>;
}
