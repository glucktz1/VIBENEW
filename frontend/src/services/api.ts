import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;
export const TOKEN_KEY = "vibe_access_token";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = { ...(await authHeaders()), ...((init.headers as any) || {}) };
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = (data && data.detail) || `Request failed (${res.status})`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: any) =>
    request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(p: string) => request<T>(p, { method: "DELETE" }),
};

// -------- Typed helpers --------
export const authApi = {
  login: (email: string, password: string) =>
    api.post<any>("/auth/login", { email, password }),
  register: (email: string, password: string, name: string) =>
    api.post<any>("/auth/register", { email, password, name }),
  me: () => api.get<any>("/auth/me"),
  deleteAccount: () => api.del<any>("/auth/me"),
};

export const musicApi = {
  home: () => api.get<any>("/home"),
  albums: (params = "") => api.get<any[]>(`/albums${params}`),
  album: (id: string) => api.get<any>(`/albums/${id}`),
  songs: (params = "") => api.get<any[]>(`/songs${params}`),
  categories: () => api.get<any[]>("/categories"),
  search: (q: string) => api.get<any>(`/search?q=${encodeURIComponent(q)}`),
  trackPlay: (id: string) => api.post(`/songs/${id}/play`),
  nextRecs: (songId: string) => api.get<any>(`/recommendations/next?song_id=${songId}`),
};

export const libraryApi = {
  playlists: () => api.get<any[]>("/playlists"),
  createPlaylist: (name: string, description?: string) =>
    api.post<any>("/playlists", { name, description }),
  deletePlaylist: (id: string) => api.del(`/playlists/${id}`),
  addToPlaylist: (id: string, song_id: string) => api.post(`/playlists/${id}/songs`, { song_id }),
  removeFromPlaylist: (id: string, songId: string) => api.del(`/playlists/${id}/songs/${songId}`),
  liked: () => api.get<any[]>("/library/liked"),
  toggleLike: (songId: string) => api.post<any>(`/library/like/${songId}`),
};

export const contentApi = {
  radio: () => api.get<any[]>("/radio"),
  bibleBooks: () => api.get<any[]>("/bible/books"),
  bibleChapter: (bookId: string, ch: number) => api.get<any>(`/bible/books/${bookId}/chapters/${ch}`),
  neno: () => api.get<any[]>("/neno-la-leo/active"),
  churches: () => api.get<any[]>("/churches"),
  church: (id: string) => api.get<any>(`/churches/${id}`),
};

export const billingApi = {
  status: () => api.get<any>("/billing-status"),
  plans: () => api.get<any[]>("/subscription-plans"),
  subscribe: (plan_id: string, phone: string) => api.post<any>("/payment/azampay/initiate", { plan_id, phone }),
};

export const adminApi = {
  stats: () => api.get<any>("/admin/stats"),
  users: () => api.get<any[]>("/admin/users"),
  createAlbum: (b: any) => api.post<any>("/admin/albums", b),
  createSong: (b: any) => api.post<any>("/admin/songs", b),
  deleteSong: (id: string) => api.del(`/admin/songs/${id}`),
  playsAnalytics: () => api.get<any>("/admin/analytics/plays"),
  // Gracefy dashboard analytics
  overview: () => api.get<any>("/analytics/overview"),
  trends: () => api.get<any>("/analytics/trends"),
  demographics: () => api.get<any>("/analytics/user-demographics"),
  realtime: () => api.get<any>("/analytics/realtime"),
  downloadStats: () => api.get<any>("/analytics/download-stats"),
  liveListeners: () => api.get<any>("/analytics/live-listeners"),
  enhanced: () => api.get<any>("/analytics/enhanced"),
  revenueOverview: () => api.get<any>("/analytics/revenue-overview"),
  transactions: (status = "all", q = "") => api.get<any>(`/analytics/transactions?status=${status}&q=${encodeURIComponent(q)}`),
  locationOverview: () => api.get<any>("/analytics/location-overview"),
};
