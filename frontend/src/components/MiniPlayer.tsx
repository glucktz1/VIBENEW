import React from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePlayer } from "@/src/context/PlayerContext";
import AnimatedEqualizer from "@/src/components/AnimatedEqualizer";
import PlayerPromptBanner from "@/src/components/PlayerPromptBanner";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function MiniPlayer({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const { current, isPlaying, togglePlay, next, prev, isBuffering, position, duration } = usePlayer();
  const router = useRouter();
  if (!current) return null;

  const progress = !current.isLive && duration > 0 && isFinite(duration) ? Math.min(1, position / duration) : 0;

  return (
    <View testID="mini-player" style={[styles.wrap, { bottom: bottomOffset }]}>
      <PlayerPromptBanner variant="mini" />
      <View style={[styles.progressTrack]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Pressable testID="mini-open" onPress={() => router.push("/player")} style={styles.row}>
        <View>
          <Image source={{ uri: current.thumbnail }} style={styles.art} contentFit="cover" transition={200} />
          {isPlaying ? (
            <View style={styles.eqOverlay}>
              <AnimatedEqualizer playing={isPlaying} color="#fff" size={16} />
            </View>
          ) : null}
        </View>
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            {current.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {current.artist_name || current.album_title || "Vibe"}
          </Text>
        </View>
        <Pressable testID="mini-prev" onPress={() => prev()} hitSlop={8} style={styles.btn}>
          <Ionicons name="play-skip-back" size={20} color={COLORS.text} />
        </Pressable>
        <Pressable testID="mini-play-toggle" onPress={togglePlay} hitSlop={10} style={styles.btn}>
          {isBuffering ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Ionicons name={isPlaying ? "pause" : "play"} size={26} color={COLORS.text} />
          )}
        </Pressable>
        <Pressable testID="mini-next" onPress={() => next()} hitSlop={10} style={styles.btn}>
          <Ionicons name="play-skip-forward" size={20} color={COLORS.text} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  progressTrack: { height: 2, backgroundColor: COLORS.progressBar },
  progressFill: { height: 2, backgroundColor: COLORS.primary },
  row: { flexDirection: "row", alignItems: "center", padding: SPACING.sm },
  art: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.surface },
  eqOverlay: { position: "absolute", top: 0, left: 0, width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  meta: { flex: 1, marginLeft: SPACING.sm },
  title: { color: COLORS.text, fontSize: FONT.md, fontWeight: "700" },
  artist: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 2 },
  btn: { paddingHorizontal: SPACING.xs },
});
