import { getXanoConfig } from "./xano-config";
import type { ApiErrorCode, XanoResponse } from "./xano-types";
import { XanoApiError } from "./xano-types";

function mapStatusToCode(status?: number): ApiErrorCode {
  if (!status) return "UNKNOWN";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 408) return "TIMEOUT";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER";
  return "UNKNOWN";
}

export class XanoClient {
  private readonly config = getXanoConfig();

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" }, true);
  }

  async post<T>(path: string, body: unknown, options?: { timeoutMs?: number }): Promise<T> {
    return this.request<T>(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      false,
      options?.timeoutMs,
    );
  }

  private async request<T>(path: string, init: RequestInit, retryable: boolean, timeoutMs = this.config.timeoutMs): Promise<T> {
    if (!this.config.baseUrl) {
      throw new XanoApiError("UNKNOWN", "Xano base URL is not configured.");
    }

    let attempt = 0;
    const maxAttempts = retryable ? this.config.retries + 1 : 1;
    while (attempt < maxAttempts) {
      attempt += 1;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${this.config.baseUrl}${path}`, {
          ...init,
          signal: controller.signal,
        });
        const requestId = response.headers.get("x-request-id") ?? undefined;
        const payload = (await response.json().catch(() => null)) as XanoResponse<T> | null;

        if (!response.ok) {
          const detailCode =
            payload && typeof payload === "object" && "code" in payload && typeof (payload as { code?: unknown }).code === "string"
              ? (payload as { code: string }).code
              : undefined;
          throw new XanoApiError(
            mapStatusToCode(response.status),
            "Cloud service is temporarily unavailable. Please try again.",
            requestId,
            response.status,
            detailCode,
          );
        }

        if (!payload || typeof payload !== "object" || !("data" in payload)) {
          throw new XanoApiError("INVALID_RESPONSE", "Received an invalid response from cloud services.", requestId, response.status);
        }

        return payload.data;
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === "AbortError";
        if (isAbort && attempt >= maxAttempts) {
          throw new XanoApiError("TIMEOUT", "Request timed out. Please try again.");
        }
        if (error instanceof XanoApiError && attempt >= maxAttempts) {
          throw error;
        }
        if (!(error instanceof XanoApiError) && attempt >= maxAttempts) {
          throw new XanoApiError("NETWORK", "Network unavailable. Check your connection and retry.");
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new XanoApiError("UNKNOWN", "Unexpected cloud request state.");
  }
}

export const xanoClient = new XanoClient();

