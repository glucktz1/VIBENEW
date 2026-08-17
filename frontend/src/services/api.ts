import { storage } from "@/src/utils/storage";
import { Platform } from "react-native";

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
  put: <T>(p: string, body?: any) =>
    request<T>(p, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: any) =>
    request<T>(p, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(p: string) => request<T>(p, { method: "DELETE" }),
};

// -------- Typed helpers --------
export const authApi = {
  login: (email: string, password: string) =>
    api.post<any>("/auth/login", { email, password }),
  register: (email: string, password: string, name: string, device?: any) =>
    api.post<any>("/auth/register", { email, password, name, ...(device || {}) }),
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
  artistCatalog: (id: string) => api.get<any>(`/artists/public/${id}`),
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

export const meApi = {
  freeHours: () => api.get<any>("/me/free-hours"),
  consume: (seconds: number) => api.post<any>("/me/free-hours/consume", { seconds }),
};

export const adminApi = {
  stats: () => api.get<any>("/admin/stats"),
  users: (qs = "") => api.get<any[]>(`/admin/users${qs}`),
  userStats: () => api.get<any>("/admin/users/stats/summary"),
  userCountries: () => api.get<string[]>("/admin/users/countries"),
  usersBulkAction: (user_ids: string[], action: string) => api.post<any>("/admin/users/bulk-action", { user_ids, action }),
  homeLayout: () => api.get<any>("/admin/home-layout"),
  setHomeLayout: (rows: any[]) => api.put<any>("/admin/home-layout", { rows }),
  userDetail: (id: string) => api.get<any>(`/admin/users/${id}`),
  userHistory: (id: string) => api.get<any>(`/admin/users/${id}/listening-history`),
  userDownloads: (id: string) => api.get<any>(`/admin/users/${id}/downloads`),
  userTransactions: (id: string) => api.get<any>(`/admin/users/${id}/transactions`),
  updateUser: (id: string, b: any) => api.put<any>(`/admin/users/${id}`, b),
  userStatus: (id: string, status: string) => api.patch<any>(`/admin/users/${id}/status`, { status }),
  resetUser: (id: string) => api.post<any>(`/admin/users/${id}/reset`, {}),
  enroll: (b: any) => api.post<any>("/admin/enroll", b),
  enrollments: () => api.get<any[]>("/admin/enrollments"),
  revokeEnrollment: (id: string) => api.post<any>(`/admin/enrollments/${id}/revoke`, {}),
  albums: () => api.get<any[]>("/admin/albums"),
  createAlbum: (b: any) => api.post<any>("/admin/albums", b),
  updateAlbum: (id: string, b: any) => api.put<any>(`/admin/albums/${id}`, b),
  albumStatus: (id: string, status: string) => api.patch<any>(`/admin/albums/${id}/status`, { status }),
  deleteAlbum: (id: string) => api.del(`/admin/albums/${id}`),
  albumSongs: (id: string) => api.get<any[]>(`/admin/albums/${id}/songs`),
  addAlbumSong: (id: string, b: any) => api.post<any>(`/admin/albums/${id}/songs`, b),
  addAlbumSongsBulk: (id: string, songs: any[]) => api.post<any>(`/admin/albums/${id}/songs/bulk`, { songs }),
  deleteSong: (id: string) => api.del(`/admin/songs/${id}`),
  updateSong: (id: string, b: any) => api.put<any>(`/admin/songs/${id}`, b),
  songStatus: (id: string, status: string) => api.patch<any>(`/admin/songs/${id}/status`, { status }),
  categories: () => api.get<any[]>("/admin/categories"),
  createCategory: (b: any) => api.post<any>("/admin/categories", b),
  deleteCategory: (id: string) => api.del(`/admin/categories/${id}`),
  playsAnalytics: () => api.get<any>("/admin/analytics/plays"),
  // Gracefy dashboard analytics
  overview: () => api.get<any>("/analytics/overview"),
  trends: () => api.get<any>("/analytics/trends"),
  demographics: () => api.get<any>("/analytics/user-demographics"),
  realtime: () => api.get<any>("/analytics/realtime"),
  downloadStats: () => api.get<any>("/analytics/download-stats"),
  liveListeners: () => api.get<any>("/analytics/live-listeners"),
  enhanced: (period = "30d") => api.get<any>(`/analytics/enhanced?period=${period}`),
  revenueOverview: () => api.get<any>("/analytics/revenue-overview"),
  transactions: (status = "all", q = "") => api.get<any>(`/analytics/transactions?status=${status}&q=${encodeURIComponent(q)}`),
  locationOverview: () => api.get<any>("/analytics/location-overview"),
  uploadAudio: async (uri: string, name: string, type: string, onProgress?: (p: number) => void): Promise<{ path: string; media_url: string }> => {
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    const form = new FormData();
    if (Platform.OS === "web") {
      const blob = await (await fetch(uri)).blob();
      form.append("file", blob, name);
    } else {
      form.append("file", { uri, name, type } as any);
    }
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE}/api/admin/upload-audio`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      if (xhr.upload) {
        xhr.upload.onprogress = (e: any) => {
          if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total);
        };
      }
      xhr.onload = () => {
        let data: any = null;
        try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { data = xhr.responseText; }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error((data && data.detail) || `Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
      xhr.send(form);
    });
  },
  dataUsage: (days = 30) => api.get<any>(`/analytics/data-usage?days=${days}`),
  breakdown: () => api.get<any>("/analytics/breakdown"),
  freeMinutes: () => api.get<any>("/analytics/free-minutes"),
  contentPerformance: () => api.get<any>("/analytics/content-performance"),
  replays: (period = "week") => api.get<any>(`/analytics/replays?period=${period}`),
  deviceDistribution: () => api.get<any>("/analytics/device-distribution"),
  settings: () => api.get<any>("/admin/settings"),
  updateSettings: (b: any) => api.put<any>("/admin/settings", b),
  campaigns: () => api.get<any>("/admin/campaigns"),
  createCampaign: (b: any) => api.post<any>("/admin/campaigns", b),
  updateCampaign: (id: string, b: any) => api.patch<any>(`/admin/campaigns/${id}`, b),
  deleteCampaign: (id: string) => api.del(`/admin/campaigns/${id}`),
  audiencePreview: (f: any) => api.post<any>("/admin/audience/preview", f),
  contentSearch: (q: string) => api.get<any>(`/admin/content-search?q=${encodeURIComponent(q)}`),
  marketingCampaigns: () => api.get<any>("/admin/marketing-campaigns"),
  createMarketingCampaign: (b: any) => api.post<any>("/admin/marketing-campaigns", b),
  deleteMarketingCampaign: (id: string) => api.del(`/admin/marketing-campaigns/${id}`),
  recommendations: () => api.get<any>("/admin/recommendations"),
  updateRecommendations: (b: any) => api.put<any>("/admin/recommendations", b),
  setUserRole: (email: string, role: string) => api.patch<any>(`/admin/users/${encodeURIComponent(email)}/role`, { role }),
  approvals: () => api.get<any>("/admin/approvals"),
  approveAlbum: (id: string, status: string) => api.post<any>(`/admin/approvals/album/${id}`, { status }),
  approveSong: (id: string, status: string) => api.post<any>(`/admin/approvals/song/${id}`, { status }),
  health: () => api.get<any>("/admin/health"),
};
