import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { listDownloads, removeDownload, isWeb, DownloadedTrack } from "@/src/services/downloads";
import { usePlayer, Track } from "@/src/context/PlayerContext";
import SongRow from "@/src/components/SongRow";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function Downloads() {
  const router = useRouter();
  const { playTrack } = usePlayer();
  const [items, setItems] = useState<DownloadedTrack[]>([]);

  const load = useCallback(async () => {
    if (isWeb) { setItems([]); return; }
    setItems(await listDownloads());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const play = (d: DownloadedTrack) => {
    const q: Track[] = items.map((x) => ({ song_id: x.song_id, title: x.title, audio_url: x.localUri, thumbnail: x.thumbnail, artist_name: x.artist_name, album_title: x.album_title, album_id: x.album_id, duration: x.duration }));
    playTrack(q.find((t) => t.song_id === d.song_id)!, q);
  };

  const del = async (id: string) => { await removeDownload(id); load(); };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="downloads-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </Pressable>
        <Text style={styles.h1}>Nyimbo Zilizopakuliwa</Text>
        <View style={{ width: 26 }} />
      </View>

      {isWeb ? (
        <View style={styles.center}>
          <Ionicons name="cloud-download-outline" size={56} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Pakua kwenye programu ya simu</Text>
          <Text style={styles.emptySub}>Nyimbo za nje ya mtandao zinapatikana kwenye programu ya Vibe ya Android/iOS.</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="download-outline" size={56} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Bado hujapakua nyimbo</Text>
          <Text style={styles.emptySub}>Bofya alama ya kupakua kwenye kicheza ili usikilize bila mtandao.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
          {items.map((d) => (
            <SongRow key={d.song_id} song={d} onPress={() => play(d)} onMore={() => del(d.song_id)} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md },
  h1: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  emptyTitle: { color: COLORS.text, fontSize: FONT.lg, fontWeight: "700", marginTop: SPACING.md },
  emptySub: { color: COLORS.textSecondary, fontSize: FONT.md, textAlign: "center", marginTop: SPACING.sm },
});
