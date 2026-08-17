import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";
import { usePlayer } from "@/src/context/PlayerContext";
import AnimatedEqualizer from "@/src/components/AnimatedEqualizer";
import { formatCount } from "@/src/utils/format";

export default function SongRow({
  song,
  onPress,
  onMore,
  index,
}: {
  song: any;
  onPress: () => void;
  onMore?: () => void;
  index?: number;
}) {
  const { current, isPlaying } = usePlayer();
  const isActive = current?.song_id === song.song_id;

  return (
    <Pressable testID={`song-row-${song.song_id}`} style={styles.row} onPress={onPress}>
      {typeof index === "number" ? (
        <Text style={[styles.index, isActive && styles.activeText]}>{index + 1}</Text>
      ) : (
        <Image source={{ uri: song.thumbnail }} style={styles.art} contentFit="cover" transition={150} />
      )}
      <View style={styles.meta}>
        <Text style={[styles.title, isActive && styles.activeText]} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {song.artist_name || song.album_title || "Vibe"}
          {song.plays > 0 ? (
            <Text style={styles.plays}>{"  ·  "}<Ionicons name="play" size={10} color={COLORS.textMuted} /> {formatCount(song.plays)}</Text>
          ) : null}
        </Text>
      </View>
      {isActive ? (
        <View style={{ marginRight: SPACING.sm }}>
          <AnimatedEqualizer playing={isPlaying} color={COLORS.primary} size={16} />
        </View>
      ) : null}
      {onMore ? (
        <Pressable testID={`song-more-${song.song_id}`} onPress={onMore} hitSlop={10} style={styles.more}>
          <Ionicons name="ellipsis-vertical" size={18} color={COLORS.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.sm },
  index: { width: 28, textAlign: "center", color: COLORS.textMuted, fontSize: FONT.md, fontWeight: "600" },
  art: { width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.surface },
  meta: { flex: 1, marginLeft: SPACING.md },
  title: { color: COLORS.text, fontSize: FONT.md, fontWeight: "600" },
  activeText: { color: COLORS.primary },
  sub: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 2 },
  plays: { color: COLORS.textMuted, fontSize: FONT.sm },
  more: { paddingHorizontal: SPACING.xs },
});
