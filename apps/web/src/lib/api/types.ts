import type { SessionHeaders } from "../../features/session/SessionProvider";

export interface ApiClient {
  get: <T>(path: string, options?: { signal?: AbortSignal }) => Promise<T>;
  post: <T>(path: string, body?: unknown, options?: { signal?: AbortSignal }) => Promise<T>;
  patch: <T>(path: string, body?: unknown, options?: { signal?: AbortSignal }) => Promise<T>;
}

export interface ApiClientContext {
  session: SessionHeaders;
}
