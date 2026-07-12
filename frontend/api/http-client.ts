import axios from "axios";

const DEFAULT_API_BASE_URL = "http://localhost:3000";

function getBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!baseUrl) {
    return DEFAULT_API_BASE_URL;
  }

  return baseUrl.replace(/\/$/, "");
}

export const apiBaseUrl = getBaseUrl();

export const httpClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30_000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});
