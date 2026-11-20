export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api").replace(/\/+$/, "");
export const MOCKING_ENABLED = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_API_MOCKING === "enabled";
