import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { AppState, Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import { storage } from "@/src/utils/storage";
import { musicApi, billingApi, meApi } from "@/src/services/api";
import { useAuth } from "@/src/context/AuthContext";

export type Track = {
  song_id: string;
  title: string;
  audio_url: string;
  thumbnail?: string;
  artist_name?: string;
  album_title?: string;
  album_id?: string;
  duration?: number;
  isLive?: boolean;
};

type BlockReason = "guest" | "subscribe" | "download-app" | null;

type PlayerCtx = {
  current: Track | null;
  isPlaying: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
  queue: Track[];
  currentIndex: number;
  previewMode: boolean;
  freeHoursLeftMin: number | null;
  promptRingtonePct: number;
  blockReason: BlockReason;
  clearBlock: () => void;
  promptDownloadApp: () => void;
  gatePremium: () => boolean;
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  togglePlay: () => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (sec: number) => void;
  stop: () => void;
  playAt: (i: number) => void;
  reorderQueue: (from: number, to: number) => void;
  removeFromQueue: (i: number) => void;
};

const Ctx = createContext<PlayerCtx>({} as PlayerCtx);
export const usePlayer = () => useContext(Ctx);

const GUEST_PLAY_KEY = "vibe_guest_plays";
const GUEST_SKIP_KEY = "vibe_guest_skips";
const SESSION_KEY = "vibe_last_session";

// Preview pattern for non-premium after skips exhausted: 15s,15s,15s,FULL...
const PREVIEW_PATTERN = [15, 15, 15, 0];

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { isGuest, isPremium } = useAuth();

  const [current, setCurrent] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [blockReason, setBlockReason] = useState<BlockReason>(null);
  const [billing, setBilling] = useState<any>({
    billing_enabled: true,
    guest_play_limit: 5,
    guest_skip_limit: 5,
    skip_tiers: [6, 3, 3],
  });

  const playerRef = useRef<AudioPlayer | null>(null);
  const queueRef = useRef<Track[]>([]);
  const currentRef = useRef<Track | null>(null);
  const positionRef = useRef(0);
  const resumePosRef = useRef(0);
  const lastSaveRef = useRef(0);
  const indexRef = useRef(0);
  const previewRef = useRef(false);
  const previewCountRef = useRef(0);
  const guestPlaysRef = useRef(0);
  const guestSkipsRef = useRef(0);
  const loggedSkipsRef = useRef(0);
  const skipsDisabledRef = useRef(false);

  // free listening-hours grant enforcement
  const freeGrantRef = useRef(false);
  const freeRemainingRef = useRef(0);
  const freeAccumRef = useRef(0);
  const freeLastCtRef = useRef(0);
  const freeFlushingRef = useRef(false);
  const [freeHoursLeftMin, setFreeHoursLeftMin] = useState<number | null>(null);

  const refreshFreeHours = useCallback(async () => {
    try {
      const st = await meApi.freeHours();
      freeGrantRef.current = !!st.has_grant;
      freeRemainingRef.current = st.remaining_seconds || 0;
      setFreeHoursLeftMin(st.has_grant ? Math.max(0, Math.round((st.remaining_seconds || 0) / 60)) : null);
    } catch {
      freeGrantRef.current = false;
      freeRemainingRef.current = 0;
      setFreeHoursLeftMin(null);
    }
  }, []);

  const stopForFreeHours = useCallback(() => {
    try { playerRef.current?.pause(); } catch {}
    setIsPlaying(false);
    freeRemainingRef.current = 0;
    setFreeHoursLeftMin(0);
    setBlockReason("subscribe");
  }, []);

  const flushFreeHours = useCallback(async () => {
    if (freeFlushingRef.current) return;
    const secs = Math.round(freeAccumRef.current);
    if (secs <= 0) return;
    freeAccumRef.current = 0;
    freeFlushingRef.current = true;
    try {
      const st = await meApi.consume(secs);
      freeGrantRef.current = !!st.has_grant;
      freeRemainingRef.current = st.remaining_seconds || 0;
      setFreeHoursLeftMin(st.has_grant ? Math.max(0, Math.round((st.remaining_seconds || 0) / 60)) : null);
      if (st.exhausted) stopForFreeHours();
    } catch {} finally {
      freeFlushingRef.current = false;
    }
  }, [stopForFreeHours]);

  // keep refs in sync with auth-dependent flags
  const isGuestRef = useRef(isGuest);
  const isPremiumRef = useRef(isPremium);
  useEffect(() => {
    isGuestRef.current = isGuest;
    isPremiumRef.current = isPremium;
    void refreshFreeHours();
  }, [isGuest, isPremium, refreshFreeHours]);

  useEffect(() => {
    (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true });
      } catch {}
      try {
        const b = await billingApi.status();
        setBilling(b);
      } catch {}
      guestPlaysRef.current = (await storage.getItem<number>(GUEST_PLAY_KEY, 0)) || 0;
      guestSkipsRef.current = (await storage.getItem<number>(GUEST_SKIP_KEY, 0)) || 0;
      // Continue Listening: restore last session (paused, ready to resume)
      try {
        const snap = await storage.getItem<any>(SESSION_KEY, null);
        if (snap && snap.track && snap.track.audio_url) {
          queueRef.current = snap.queue?.length ? snap.queue : [snap.track];
          indexRef.current = snap.index || 0;
          currentRef.current = snap.track;
          resumePosRef.current = snap.position || 0;
          positionRef.current = snap.position || 0;
          setQueue(queueRef.current);
          setCurrentIndex(indexRef.current);
          setCurrent(snap.track);
          setDuration(snap.track.duration || 0);
          setPosition(snap.position || 0);
        }
      } catch {}
    })();
    return () => {
      try {
        playerRef.current?.remove();
      } catch {}
    };
  }, []);

  const restrictionsActive = useCallback(() => {
    // Premium users and billing OFF => no restrictions (for logged-in).
    // Guest limits are INDEPENDENT of billing (faithful to Gracefy).
    return !isPremiumRef.current;
  }, []);

  // Gate a premium-only feature (like, download, playlist). Returns true if allowed.
  const gatePremium = useCallback(() => {
    if (isGuestRef.current) {
      setBlockReason("guest");
      return false;
    }
    if (!isPremiumRef.current && billing.billing_enabled) {
      setBlockReason("subscribe");
      return false;
    }
    return true;
  }, [billing]);

  const promptDownloadApp = useCallback(() => setBlockReason("download-app"), []);

  // Lock-screen / background enforcement for non-premium users (native only).
  // When the app is backgrounded (screen lock, home), pause playback and prompt.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") return;
      const p = playerRef.current;
      const live = currentRef.current?.isLive;
      if (p && !isPremiumRef.current && billing.billing_enabled && Platform.OS !== "web" && !live) {
        try {
          p.pause();
        } catch {}
        setIsPlaying(false);
        setBlockReason("subscribe");
      }
    });
    return () => sub.remove();
  }, [billing]);

  const saveSession = useCallback(async () => {
    const t = currentRef.current;
    if (!t) return;
    try {
      await storage.setItem(SESSION_KEY, {
        track: t,
        queue: queueRef.current,
        index: indexRef.current,
        position: positionRef.current,
      });
    } catch {}
  }, []);

  const attachListener = useCallback((player: AudioPlayer) => {
    player.addListener("playbackStatusUpdate", (status: any) => {
      if (!status) return;
      if (typeof status.isLoaded === "boolean") setIsBuffering(!status.isLoaded);
      if (typeof status.currentTime === "number") {
        setPosition(status.currentTime);
        positionRef.current = status.currentTime;
        const nowSec = Math.floor(status.currentTime);
        if (nowSec - lastSaveRef.current >= 5) {
          lastSaveRef.current = nowSec;
          void saveSession();
        }
        // free listening-hours metering (only for free_hours grantees)
        if (freeGrantRef.current && status.playing) {
          const ct = status.currentTime;
          const delta = ct - freeLastCtRef.current;
          freeLastCtRef.current = ct;
          if (delta > 0 && delta < 2) {
            freeAccumRef.current += delta;
            if (freeRemainingRef.current - freeAccumRef.current <= 0) {
              void flushFreeHours();
              stopForFreeHours();
            } else if (freeAccumRef.current >= 15) {
              void flushFreeHours();
            }
          }
        }
      }
      if (typeof status.duration === "number" && status.duration > 0) setDuration(status.duration);
      if (typeof status.playing === "boolean") setIsPlaying(status.playing);

      // Preview mode cutoff (non-premium, skips exhausted) — never for live radio
      if (previewRef.current && !currentRef.current?.isLive && typeof status.currentTime === "number") {
        const cut = PREVIEW_PATTERN[previewCountRef.current % PREVIEW_PATTERN.length];
        if (cut > 0 && status.currentTime >= cut) {
          void handleNext(true);
          return;
        }
      }

      if (status.didJustFinish) {
        void handleNext(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAndPlay = useCallback(
    (track: Track) => {
      try {
        if (playerRef.current) {
          playerRef.current.remove();
          playerRef.current = null;
        }
      } catch {}
      const player = createAudioPlayer({ uri: track.audio_url }, { updateInterval: 500 });
      playerRef.current = player;
      attachListener(player);
      setCurrent(track);
      currentRef.current = track;
      setCurrentIndex(indexRef.current);
      setPosition(0);
      positionRef.current = 0;
      lastSaveRef.current = 0;
      freeLastCtRef.current = 0;
      freeAccumRef.current = 0;
      setDuration(track.duration || 0);
      player.play();
      setIsPlaying(true);
      // Resume from saved position (Continue Listening)
      if (resumePosRef.current > 2) {
        const pos = resumePosRef.current;
        resumePosRef.current = 0;
        setTimeout(() => { try { player.seekTo(pos); } catch {} }, 300);
      }
      // track play for analytics + recommendations
      musicApi.trackPlay(track.song_id).catch(() => {});
      void saveSession();

      // preview counting
      if (previewRef.current) {
        previewCountRef.current += 1;
      }
    },
    [attachListener, saveSession]
  );

  // core "advance" used by next() and auto-advance on finish
  const handleNext = useCallback(
    async (auto: boolean) => {
      // Manual skip gating
      if (!auto) {
        if (isGuestRef.current) {
          guestSkipsRef.current += 1;
          await storage.setItem(GUEST_SKIP_KEY, guestSkipsRef.current);
          if (guestSkipsRef.current > (billing.guest_skip_limit || 5)) {
            setBlockReason("guest");
            return;
          }
        } else if (restrictionsActive() && billing.billing_enabled) {
          if (skipsDisabledRef.current) {
            setBlockReason("subscribe");
            return;
          }
          loggedSkipsRef.current += 1;
          const [t1, t2, t3] = billing.skip_tiers || [6, 3, 3];
          const total = t1 + t2 + t3;
          if (loggedSkipsRef.current === t1 + 1 || loggedSkipsRef.current === t1 + t2 + 1) {
            setBlockReason("subscribe");
            return;
          }
          if (loggedSkipsRef.current > total) {
            skipsDisabledRef.current = true;
            previewRef.current = true;
            previewCountRef.current = 0;
            setPreviewMode(true);
            setBlockReason("subscribe");
            return;
          }
        }
      }

      const q = queueRef.current;
      // Guest play limit also applies when auto-advancing to the next song
      if (auto && isGuestRef.current) {
        guestPlaysRef.current += 1;
        await storage.setItem(GUEST_PLAY_KEY, guestPlaysRef.current);
        if (guestPlaysRef.current > (billing.guest_play_limit || 5)) {
          setBlockReason("guest");
          setIsPlaying(false);
          return;
        }
      }
      let nextIdx = indexRef.current + 1;
      if (nextIdx < q.length) {
        indexRef.current = nextIdx;
        loadAndPlay(q[nextIdx]);
        return;
      }
      // Queue ended: fetch recommendations (diversity-aware)
      const cur = q[indexRef.current] || current;
      if (cur) {
        try {
          const rec = await musicApi.nextRecs(cur.song_id);
          const songs: Track[] = rec.songs || [];
          if (songs.length) {
            queueRef.current = [...q, ...songs];
            setQueue(queueRef.current);
            indexRef.current = nextIdx;
            loadAndPlay(queueRef.current[nextIdx]);
            return;
          }
        } catch {}
      }
      // nothing to play
      setIsPlaying(false);
    },
    [billing, current, loadAndPlay, restrictionsActive]
  );

  const canStartPlayback = useCallback(async (): Promise<boolean> => {
    if (isGuestRef.current) {
      guestPlaysRef.current += 1;
      await storage.setItem(GUEST_PLAY_KEY, guestPlaysRef.current);
      if (guestPlaysRef.current > (billing.guest_play_limit || 5)) {
        setBlockReason("guest");
        return false;
      }
    }
    return true;
  }, [billing]);

  const playTrack = useCallback(
    async (track: Track, q?: Track[]) => {
      const ok = await canStartPlayback();
      if (!ok) return;
      if (freeGrantRef.current && freeRemainingRef.current <= 0) {
        setBlockReason("subscribe");
        return;
      }
      const newQueue = q && q.length ? q : [track];
      queueRef.current = newQueue;
      indexRef.current = Math.max(0, newQueue.findIndex((t) => t.song_id === track.song_id));
      setQueue(newQueue);
      loadAndPlay(newQueue[indexRef.current]);
    },
    [canStartPlayback, loadAndPlay]
  );

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) {
      // Resume a restored "Continue Listening" session
      if (currentRef.current) loadAndPlay(currentRef.current);
      return;
    }
    if (isPlaying) {
      p.pause();
      setIsPlaying(false);
      void saveSession();
    } else {
      p.play();
      setIsPlaying(true);
    }
  }, [isPlaying, loadAndPlay, saveSession]);

  const next = useCallback(() => handleNext(false), [handleNext]);

  const prev = useCallback(async () => {
    if (position > 3) {
      playerRef.current?.seekTo(0);
      setPosition(0);
      return;
    }
    const idx = indexRef.current - 1;
    if (idx >= 0) {
      indexRef.current = idx;
      loadAndPlay(queueRef.current[idx]);
    } else {
      playerRef.current?.seekTo(0);
      setPosition(0);
    }
  }, [position, loadAndPlay]);

  const seek = useCallback(
    (sec: number) => {
      if (previewRef.current) return; // seeking blocked in preview mode
      playerRef.current?.seekTo(sec);
      setPosition(sec);
    },
    []
  );

  const stop = useCallback(() => {
    try {
      playerRef.current?.remove();
    } catch {}
    playerRef.current = null;
    setCurrent(null);
    currentRef.current = null;
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
  }, []);

  const playAt = useCallback(
    (i: number) => {
      const q = queueRef.current;
      if (i < 0 || i >= q.length) return;
      indexRef.current = i;
      loadAndPlay(q[i]);
    },
    [loadAndPlay]
  );

  const reorderQueue = useCallback((from: number, to: number) => {
    const q = [...queueRef.current];
    if (from < 0 || to < 0 || from >= q.length || to >= q.length || from === to) return;
    const [moved] = q.splice(from, 1);
    q.splice(to, 0, moved);
    queueRef.current = q;
    setQueue(q);
    let idx = indexRef.current;
    if (from === idx) idx = to;
    else {
      if (from < idx) idx -= 1;
      if (to <= idx) idx += 1;
    }
    indexRef.current = idx;
    setCurrentIndex(idx);
  }, []);

  const removeFromQueue = useCallback((i: number) => {
    const q = [...queueRef.current];
    if (i < 0 || i >= q.length || i === indexRef.current) return;
    q.splice(i, 1);
    queueRef.current = q;
    setQueue(q);
    if (i < indexRef.current) {
      indexRef.current -= 1;
      setCurrentIndex(indexRef.current);
    }
  }, []);

  // ---- Web lock-screen / media-key controls (MediaSession API) ----
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const ms: any = (typeof navigator !== "undefined" && (navigator as any).mediaSession) || null;
    if (!ms || typeof (window as any).MediaMetadata === "undefined") return;
    if (!current) return;
    try {
      ms.metadata = new (window as any).MediaMetadata({
        title: current.title,
        artist: current.artist_name || "Vibe",
        album: current.album_title || "Vibe",
        artwork: current.thumbnail
          ? [{ src: current.thumbnail, sizes: "512x512", type: "image/jpeg" }]
          : [],
      });
    } catch {}
  }, [current]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const ms: any = (typeof navigator !== "undefined" && (navigator as any).mediaSession) || null;
    if (!ms) return;
    try {
      ms.setActionHandler("play", () => togglePlay());
      ms.setActionHandler("pause", () => togglePlay());
      ms.setActionHandler("nexttrack", () => next());
      ms.setActionHandler("previoustrack", () => prev());
    } catch {}
  }, [togglePlay, next, prev]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const ms: any = (typeof navigator !== "undefined" && (navigator as any).mediaSession) || null;
    if (ms) ms.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  return (
    <Ctx.Provider
      value={{
        current,
        isPlaying,
        isBuffering,
        position,
        duration,
        queue,
        currentIndex,
        previewMode,
        freeHoursLeftMin,
        promptRingtonePct: billing?.free_prompt_ringtone_pct ?? 50,
        blockReason,
        clearBlock: () => setBlockReason(null),
        promptDownloadApp,
        gatePremium,
        playTrack,
        togglePlay,
        next,
        prev,
        seek,
        stop,
        playAt,
        reorderQueue,
        removeFromQueue,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
