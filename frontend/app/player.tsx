import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, GestureResponderEvent, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { usePlayer } from "@/src/context/PlayerContext";
import { useAuth } from "@/src/context/AuthContext";
import { libraryApi } from "@/src/services/api";
import { isDownloaded, downloadTrack, removeDownload, isWeb } from "@/src/services/downloads";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

function fmt(sec: number) {
  if (!sec || sec < 0 || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Player() {
  const router = useRouter();
  const { current, isPlaying, isBuffering, position, duration, togglePlay, next, prev, seek, previewMode, gatePremium, promptDownloadApp } = usePlayer();
  const { isGuest, isPremium } = useAuth();
  const [barWidth, setBarWidth] = useState(1);
  const [liked, setLiked] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (current && !isWeb) isDownloaded(current.song_id).then(setDownloaded);
    else setDownloaded(false);
  }, [current?.song_id]);

  if (!current) {
    return (
      <View style={styles.center}>
        <Text style={{ color: COLORS.textSecondary }}>Hakuna wimbo unaochezwa</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: COLORS.primary }}>Rudi</Text>
        </Pressable>
      </View>
    );
  }

  // Live radio (or unknown/broken duration) => no seek bar, show LIVE.
  const rawDur = duration || current.duration || 0;
  const isLive = !!current.isLive || !isFinite(rawDur) || rawDur > 86400 || rawDur <= 0;
  const dur = isLive ? 0 : rawDur;
  const progress = dur > 0 ? Math.min(1, position / dur) : 0;

  const onSeek = (e: GestureResponderEvent) => {
    if (isLive) return;
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / barWidth));
    seek(ratio * dur);
  };

  const toggleLike = async () => {
    if (!gatePremium()) return;
    try {
      const res = await libraryApi.toggleLike(current.song_id);
      setLiked(res.liked);
    } catch {}
  };

  const onDownload = async () => {
    if (isWeb) { promptDownloadApp(); return; }
    if (downloaded) { await removeDownload(current.song_id); setDownloaded(false); return; }
    if (!gatePremium()) return;
    setDownloading(true);
    try {
      await downloadTrack(current);
      setDownloaded(true);
    } catch {}
    setDownloading(false);
  };

  const showChangiaBanner = !isGuest && !isPremium;

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.primaryDark, COLORS.background, COLORS.background]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable testID="player-close" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-down" size={30} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>INACHEZA SASA</Text>
          <View style={{ width: 30 }} />
        </View>

        <View style={styles.artWrap}>
          <Image source={{ uri: current.thumbnail }} style={styles.art} contentFit="cover" transition={300} />
        </View>

        {previewMode ? (
          <View testID="preview-banner" style={styles.previewBanner}>
            <Ionicons name="time" size={16} color="#000" />
            <Text style={styles.previewText}>Hali ya Onjo (sekunde 15) · Changia usikilize kamili</Text>
          </View>
        ) : null}

        <View style={styles.meta}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{current.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>{isLive ? "LIVE · Redio" : current.artist_name || current.album_title || "Vibe"}</Text>
          </View>
          <Pressable testID="player-like" onPress={toggleLike} hitSlop={10} style={styles.metaBtn}>
            <Ionicons name={liked ? "heart" : "heart-outline"} size={26} color={liked ? COLORS.error : COLORS.text} />
          </Pressable>
          {!isLive ? (
            <Pressable testID="player-download" onPress={onDownload} hitSlop={10} style={styles.metaBtn}>
              {downloading ? (
                <ActivityIndicator color={COLORS.text} size="small" />
              ) : (
                <Ionicons name={downloaded ? "checkmark-circle" : "download-outline"} size={26} color={downloaded ? COLORS.success : COLORS.text} />
              )}
            </Pressable>
          ) : null}
        </View>

        {/* Non-premium payment prompt banner (faithful to Gracefy) */}
        {showChangiaBanner ? (
          <Pressable testID="changia-banner" style={styles.changiaBanner} onPress={() => router.push("/plans")}>
            <Ionicons name="star" size={16} color="#fff" />
            <Text style={styles.changiaText} numberOfLines={1}>Changia kidogo kusikiliza kwa uhuru</Text>
            <View style={styles.changiaBtn}><Text style={styles.changiaBtnText}>Changia</Text></View>
          </Pressable>
        ) : null}

        {/* Progress */}
        <View style={styles.progressWrap}>
          {isLive ? (
            <View style={styles.liveWrap}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>LIVE</Text>
            </View>
          ) : (
            <>
              <Pressable
                testID="player-seek"
                style={styles.barTouch}
                onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                onPress={onSeek}
              >
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
                  <View style={[styles.knob, { left: `${progress * 100}%` }]} />
                </View>
              </Pressable>
              <View style={styles.times}>
                <Text style={styles.time}>{fmt(position)}</Text>
                <Text style={styles.time}>{fmt(dur)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <Pressable testID="player-prev" onPress={prev} hitSlop={10}>
            <Ionicons name="play-skip-back" size={34} color={COLORS.text} />
          </Pressable>
          <Pressable testID="player-toggle" onPress={togglePlay} style={styles.playBtn}>
            {isBuffering ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <Ionicons name={isPlaying ? "pause" : "play"} size={40} color="#fff" />
            )}
          </Pressable>
          <Pressable testID="player-next" onPress={() => next()} hitSlop={10}>
            <Ionicons name="play-skip-forward" size={34} color={COLORS.text} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  headerTitle: { color: COLORS.textSecondary, fontSize: FONT.xs, fontWeight: "800", letterSpacing: 1 },
  artWrap: { alignItems: "center", marginTop: SPACING.xl, paddingHorizontal: SPACING.lg },
  art: { width: "100%", aspectRatio: 1, maxWidth: 360, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface },
  previewBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.warning, marginHorizontal: SPACING.lg, marginTop: SPACING.lg, borderRadius: RADIUS.md, padding: SPACING.sm },
  previewText: { color: "#000", fontSize: FONT.sm, fontWeight: "700", marginLeft: SPACING.xs },
  meta: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, marginTop: SPACING.xl },
  metaBtn: { paddingHorizontal: SPACING.sm },
  title: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800" },
  artist: { color: COLORS.textSecondary, fontSize: FONT.lg, marginTop: 4 },
  changiaBanner: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.primary, marginHorizontal: SPACING.lg, marginTop: SPACING.md, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 46 },
  changiaText: { flex: 1, color: "#fff", fontSize: FONT.sm, fontWeight: "700", marginLeft: SPACING.sm },
  changiaBtn: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  changiaBtnText: { color: "#fff", fontWeight: "800", fontSize: FONT.sm },
  liveWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: SPACING.md },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.error, marginRight: 6 },
  liveLabel: { color: COLORS.error, fontWeight: "800", fontSize: FONT.md, letterSpacing: 1 },
  progressWrap: { paddingHorizontal: SPACING.lg, marginTop: SPACING.lg },
  barTouch: { paddingVertical: SPACING.sm },
  barTrack: { height: 5, borderRadius: 3, backgroundColor: COLORS.progressBar },
  barFill: { height: 5, borderRadius: 3, backgroundColor: COLORS.primary },
  knob: { position: "absolute", top: -4, width: 13, height: 13, borderRadius: 7, backgroundColor: "#fff", marginLeft: -6 },
  times: { flexDirection: "row", justifyContent: "space-between", marginTop: SPACING.xs },
  time: { color: COLORS.textMuted, fontSize: FONT.sm },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-evenly", marginTop: SPACING.xl, paddingHorizontal: SPACING.xl },
  playBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
});
