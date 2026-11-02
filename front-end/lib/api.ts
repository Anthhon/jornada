import axios, { type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "./api-config";
import { tokenStorage, type TokenStorage } from "./token-storage";

interface RetryConfig extends InternalAxiosRequestConfig { _retried?: boolean }
export const UNAUTHORIZED_EVENT = "jornada:unauthorized";

export function createApiClient(storage: TokenStorage = tokenStorage, onUnauthorized = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}) {
  const client = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
  const authClient = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
  let refreshRequest: Promise<string> | null = null;
  client.interceptors.request.use((config) => {
    const tokens = storage.read();
    if (tokens) config.headers.Authorization = `Bearer ${tokens.access}`;
    return config;
  });
  client.interceptors.response.use((response) => response, async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) throw error;
    const config = error.config as RetryConfig;
    const tokens = storage.read();
    if (config._retried || !tokens) {
      storage.clear(); onUnauthorized(); throw error;
    }
    config._retried = true;
    try {
      if (!refreshRequest) {
        refreshRequest = authClient.post<{ access: string; refresh?: string }>("/token/refresh/", { refresh: tokens.refresh })
          .then(({ data }) => {
            if (storage.read()?.refresh !== tokens.refresh) throw new Error("Session changed during refresh");
            if (typeof data.access !== "string" || !data.access || (data.refresh !== undefined && typeof data.refresh !== "string")) {
              throw new Error("Invalid token refresh response");
            }
            storage.write({ access: data.access, refresh: data.refresh ?? tokens.refresh });
            return data.access;
          }).finally(() => { refreshRequest = null; });
      }
      const access = await refreshRequest;
      config.headers.Authorization = `Bearer ${access}`;
      return client(config);
    } catch (refreshError) {
      if (storage.read()?.refresh === tokens.refresh) {
        storage.clear();
        onUnauthorized();
      }
      throw refreshError;
    }
  });
  return { client, authClient };
}
export const { client: api, authClient } = createApiClient();

