import { useMemo } from "react";

import { useSession } from "../../features/session/SessionProvider";
import { ApiError } from "./errors";
import type { ApiClient } from "./types";

const createCorrelationId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `cid-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
};

const buildUrl = (baseUrl: string, path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (/^https?:\/\//i.test(baseUrl)) {
    return new URL(normalizedPath.replace(/^\//, ""), `${baseUrl.replace(/\/$/, "")}/`).toString();
  }

  return `${baseUrl.replace(/\/$/, "")}${normalizedPath}`;
};

const tryParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const createApiClient = (session: { userId: string; organizationId: string }): ApiClient => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

  const request = async <T>(
    path: string,
    options: {
      method?: "GET" | "POST" | "PATCH";
      body?: unknown;
      signal?: AbortSignal;
    } = {},
  ): Promise<T> => {
    const correlationId = createCorrelationId();

    if (!session.userId || !session.organizationId) {
      throw new ApiError({
        status: 0,
        code: "missing_session_headers",
        message: "Set x-user-id and x-organization-id values in the session panel before querying the API.",
        correlationId,
      });
    }

    const response = await fetch(buildUrl(baseUrl, path), {
      method: options.method ?? "GET",
      signal: options.signal,
      headers: {
        "content-type": "application/json",
        "x-user-id": session.userId,
        "x-organization-id": session.organizationId,
        "x-correlation-id": correlationId,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }).catch((error: unknown) => {
      throw new ApiError({
        status: 0,
        code: "network_error",
        message: error instanceof Error ? error.message : "Network request failed.",
        correlationId,
      });
    });

    const responseText = await response.text();
    const payload = responseText.length > 0 ? tryParseJson(responseText) : null;

    if (!response.ok) {
      const errorPayload =
        typeof payload === "object" && payload !== null && "error" in payload
          ? (payload as { error?: { code?: string; message?: string; details?: unknown } }).error
          : undefined;

      throw new ApiError({
        status: response.status,
        code: errorPayload?.code ?? "request_failed",
        message: errorPayload?.message ?? `Request failed with status ${response.status}.`,
        details: errorPayload?.details,
        correlationId,
      });
    }

    return payload as T;
  };

  return {
    get: (path, options) => request(path, { method: "GET", signal: options?.signal }),
    post: (path, body, options) => request(path, { method: "POST", body, signal: options?.signal }),
    patch: (path, body, options) => request(path, { method: "PATCH", body, signal: options?.signal }),
  };
};

export const useApiClient = (): ApiClient => {
  const session = useSession();

  return useMemo(
    () =>
      createApiClient({
        userId: session.userId,
        organizationId: session.organizationId,
      }),
    [session.organizationId, session.userId],
  );
};
