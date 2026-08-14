import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/services/api";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;
export const ARTIST_TOKEN_KEY = "vibe_artist_token";

async function headers(): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(ARTIST_TOKEN_KEY, "");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const merged = { ...(await headers()), ...((init.headers as any) || {}) };
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers: merged });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = (data && data.detail) || `Request failed (${res.status})`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

export const artistApi = {
  BASE,
  setToken: (t: string) => storage.secureSet(ARTIST_TOKEN_KEY, t),
  getToken: () => storage.secureGet<string>(ARTIST_TOKEN_KEY, ""),
  clearToken: () => storage.secureSet(ARTIST_TOKEN_KEY, ""),

  register: (b: { email: string; password: string; name: string; phone?: string; bio?: string; genre?: string }) =>
    request<any>("/artists/register", { method: "POST", body: JSON.stringify(b) }),
  login: (email: string, password: string) =>
    request<any>("/artists/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<any>("/artists/me"),
  updateMe: (b: any) => request<any>("/artists/me", { method: "PUT", body: JSON.stringify(b) }),

  albums: () => request<any[]>("/artists/albums"),
  createAlbum: (b: any) => request<any>("/artists/albums", { method: "POST", body: JSON.stringify(b) }),
  songs: () => request<any[]>("/artists/songs"),
  createSong: (b: any) => request<any>("/artists/songs", { method: "POST", body: JSON.stringify(b) }),

  earnings: () => request<any>("/artists/earnings"),
  withdrawals: () => request<any[]>("/artists/withdrawals"),
  requestWithdrawal: (b: any) => request<any>("/artists/withdrawals", { method: "POST", body: JSON.stringify(b) }),

  // multipart audio upload — platform-aware body (per object-storage playbook)
  uploadAudio: async (uri: string, name: string, type: string): Promise<{ path: string; media_url: string }> => {
    const token = await storage.secureGet<string>(ARTIST_TOKEN_KEY, "");
    const form = new FormData();
    if (Platform.OS === "web") {
      const blob = await (await fetch(uri)).blob();
      form.append("file", blob, name);
    } else {
      form.append("file", { uri, name, type } as any);
    }
    const res = await fetch(`${BASE}/api/artists/upload-audio`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new Error((data && data.detail) || `Upload failed (${res.status})`);
    return data;
  },
};

// Admin management of artists/withdrawals (uses the admin token from api.ts)
export const adminArtistApi = {
  list: () => api.get<any[]>("/artists/admin/all"),
  setStatus: (id: string, s: string) => api.post(`/artists/admin/${id}/status`, { status: s }),
  withdrawals: () => api.get<any[]>("/artists/admin/withdrawals/all"),
  setWithdrawalStatus: (id: string, s: string) => api.post(`/artists/admin/withdrawals/${id}/status`, { status: s }),
};
