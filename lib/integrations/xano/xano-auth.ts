import { xanoClient } from "./xano-client";

export type AnonymousSessionResponse = {
  sessionId: string;
  userId: string;
};

export async function createAnonymousSession(deviceFingerprint: string) {
  return xanoClient.post<AnonymousSessionResponse>("/v1/session/anonymous", {
    deviceFingerprint,
  });
}

