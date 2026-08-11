import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, GestureResponderEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { usePlayer } from "@/src/context/PlayerContext";
import { useAuth } from "@/src/context/AuthContext";
import { libraryApi } from "@/src/services/api";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

function fmt(sec: number) {
  if (!sec || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Player() {
  const router = useRouter();
  const { current, isPlaying, isBuffering, position, duration, togglePlay, next, prev, seek, previewMode } = usePlayer();
  const { isGuest } = useAuth();
  const [barWidth, setBarWidth] = useState(1);
  const [liked, setLiked] = useState(false);

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

  const dur = duration || current.duration || 0;
  const progress = dur > 0 ? Math.min(1, position / dur) : 0;

  const onSeek = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / barWidth));
    seek(ratio * dur);
  };

  const toggleLike = async () => {
    if (isGuest) { router.push("/(auth)/login"); return; }
    try {
      const res = await libraryApi.toggleLike(current.song_id);
      setLiked(res.liked);
    } catch {}
  };

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
            <Text style={styles.artist} numberOfLines={1}>{current.artist_name || current.album_title || "Vibe"}</Text>
          </View>
          <Pressable testID="player-like" onPress={toggleLike} hitSlop={10}>
            <Ionicons name={liked ? "heart" : "heart-outline"} size={28} color={liked ? COLORS.error : COLORS.text} />
          </Pressable>
        </View>

        {/* Progress */}
        <View style={styles.progressWrap}>
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
  title: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800" },
  artist: { color: COLORS.textSecondary, fontSize: FONT.lg, marginTop: 4 },
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
