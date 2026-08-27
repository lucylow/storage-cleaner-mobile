import { xanoClient } from "./xano-client";
import type { FeatureFlag, PrivacyPreference, Recommendation, ScanSession, Subscription } from "./xano-types";

export const xanoService = {
  getFeatureFlags() {
    return xanoClient.get<FeatureFlag[]>("/v1/feature-flags");
  },
  getPrivacyPreferences() {
    return xanoClient.get<PrivacyPreference>("/v1/privacy/preferences");
  },
  updatePrivacyPreferences(payload: Partial<PrivacyPreference>) {
    return xanoClient.post<PrivacyPreference>("/v1/privacy/preferences", payload);
  },
  submitScanSession(payload: ScanSession) {
    return xanoClient.post<{ accepted: boolean }>("/v1/scan-sessions", payload);
  },
  getRecommendations(scanSessionId: string) {
    return xanoClient.get<Recommendation[]>(`/v1/recommendations?scanSessionId=${encodeURIComponent(scanSessionId)}`);
  },
  getSubscription() {
    return xanoClient.get<Subscription>("/v1/subscription");
  },
};

