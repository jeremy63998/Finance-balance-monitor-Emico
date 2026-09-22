// Frontend HTTP client. ALL calls hit the same-origin backend (/api/*)
// with the Lovable Cloud (Google Workspace) access token attached.
import { supabase } from "@/integrations/supabase/client";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    throw new UnauthorizedError();
  }
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(parsed?.error || parsed?.message || `HTTP ${res.status}`);
  }
  return parsed as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>(p),
  post: <T = any>(p: string, body: any) => request<T>(p, { method: "POST", body: JSON.stringify(body) }),
  put: <T = any>(p: string, body: any) => request<T>(p, { method: "PUT", body: JSON.stringify(body) }),
  del: <T = any>(p: string) => request<T>(p, { method: "DELETE" }),
};
