// Offline downloads — PREMIUM + NATIVE only.
// On web, downloads are not supported → callers should prompt "download the app".
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { storage } from "@/src/utils/storage";

const DL_KEY = "vibe_downloads";
const DIR = (FileSystem.documentDirectory || "") + "downloads/";

export type DownloadedTrack = {
  song_id: string;
  title: string;
  artist_name?: string;
  thumbnail?: string;
  album_id?: string;
  album_title?: string;
  duration?: number;
  localUri: string;
  size?: number;
};

export const isWeb = Platform.OS === "web";

export async function getDownloads(): Promise<Record<string, DownloadedTrack>> {
  return (await storage.getItem<Record<string, DownloadedTrack>>(DL_KEY, {})) || {};
}

export async function isDownloaded(songId: string): Promise<boolean> {
  const d = await getDownloads();
  return !!d[songId];
}

export async function downloadTrack(track: any): Promise<DownloadedTrack> {
  if (isWeb) throw new Error("Downloads zinapatikana kwenye programu ya simu tu");
  try {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  } catch {}
  const path = `${DIR}${track.song_id}.mp3`;
  await FileSystem.downloadAsync(track.audio_url, path);
  let size = 0;
  try {
    const info = await FileSystem.getInfoAsync(path, { size: true });
    size = (info as any).size || 0;
  } catch {}
  const map = await getDownloads();
  const entry: DownloadedTrack = {
    song_id: track.song_id,
    title: track.title,
    artist_name: track.artist_name,
    thumbnail: track.thumbnail,
    album_id: track.album_id,
    album_title: track.album_title,
    duration: track.duration,
    localUri: path,
    size,
  };
  map[track.song_id] = entry;
  await storage.setItem(DL_KEY, map);
  return entry;
}

export async function downloadMany(tracks: any[]): Promise<number> {
  let count = 0;
  for (const t of tracks) {
    try {
      await downloadTrack(t);
      count += 1;
    } catch {}
  }
  return count;
}

export async function removeDownload(songId: string): Promise<void> {
  const map = await getDownloads();
  const entry = map[songId];
  if (entry?.localUri && !isWeb) {
    try {
      await FileSystem.deleteAsync(entry.localUri, { idempotent: true });
    } catch {}
  }
  delete map[songId];
  await storage.setItem(DL_KEY, map);
}

export async function listDownloads(): Promise<DownloadedTrack[]> {
  const map = await getDownloads();
  return Object.values(map);
}

export async function getDownloadsSize(): Promise<number> {
  const map = await getDownloads();
  return Object.values(map).reduce((sum, e) => sum + (e.size || 0), 0);
}

export async function clearAllDownloads(): Promise<void> {
  if (!isWeb) {
    try {
      await FileSystem.deleteAsync(DIR, { idempotent: true });
    } catch {}
  }
  await storage.setItem(DL_KEY, {});
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}
