import React from "react";
import { Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function AlbumCard({ album, width, full }: { album: any; width?: number; full?: boolean }) {
  const router = useRouter();
  const w = width ?? 150;
  return (
    <Pressable
      testID={`album-card-${album.album_id}`}
      style={full ? styles.wrapFull : [styles.wrap, { width: w }]}
      onPress={() => router.push(`/album/${album.album_id}`)}
    >
      <Image
        source={{ uri: album.thumbnail }}
        style={full ? styles.artFull : [styles.art, { width: w, height: w }]}
        contentFit="cover"
        transition={200}
      />
      <Text style={styles.title} numberOfLines={1}>
        {album.title}
      </Text>
      <Text style={styles.sub} numberOfLines={1}>
        {album.artist_name || `${album.songs_count || 0} nyimbo`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginRight: SPACING.md },
  wrapFull: { width: "100%" },
  art: { borderRadius: RADIUS.lg, backgroundColor: COLORS.surface },
  artFull: { width: "100%", aspectRatio: 1, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface },
  title: { color: COLORS.text, fontSize: FONT.md, fontWeight: "700", marginTop: SPACING.sm },
  sub: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 2 },
});
