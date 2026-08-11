import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { libraryApi } from "@/src/services/api";
import { usePlayer, Track } from "@/src/context/PlayerContext";
import SongRow from "@/src/components/SongRow";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function PlaylistDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { playTrack } = usePlayer();
  const [pl, setPl] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const pls = await libraryApi.playlists();
      setPl(pls.find((p: any) => p.playlist_id === id));
    } catch {}
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toTrack = (s: any): Track => ({ song_id: s.song_id, title: s.title, audio_url: s.audio_url, thumbnail: s.thumbnail, artist_name: s.artist_name, album_title: s.album_title, album_id: s.album_id, duration: s.duration });

  const playAll = () => {
    if (!pl?.songs?.length) return;
    const q = pl.songs.map(toTrack);
    playTrack(q[0], q);
  };

  const remove = async (songId: string) => {
    await libraryApi.removeFromPlaylist(String(id), songId);
    load();
  };

  const del = async () => {
    await libraryApi.deletePlaylist(String(id));
    router.back();
  };

  if (loading || !pl) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.primaryDark, COLORS.background]} style={styles.grad} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <Pressable testID="pl-back" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={COLORS.text} />
          </Pressable>
          <Pressable testID="pl-delete" onPress={del} hitSlop={10}>
            <Ionicons name="trash-outline" size={22} color={COLORS.error} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 180 }}>
          <View style={styles.top}>
            <View style={styles.cover}>
              {pl.songs?.[0]?.thumbnail ? (
                <Image source={{ uri: pl.songs[0].thumbnail }} style={styles.coverImg} contentFit="cover" />
              ) : (
                <Ionicons name="musical-notes" size={50} color={COLORS.textSecondary} />
              )}
            </View>
            <Text style={styles.name}>{pl.name}</Text>
            <Text style={styles.count}>{pl.songs_count || 0} nyimbo</Text>
            {pl.songs?.length ? (
              <Pressable testID="pl-play-all" style={styles.playAll} onPress={playAll}>
                <Ionicons name="play" size={22} color="#fff" />
                <Text style={styles.playAllText}>Cheza</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ paddingHorizontal: SPACING.md }}>
            {pl.songs?.length ? (
              pl.songs.map((s: any) => (
                <SongRow key={s.song_id} song={s} onPress={() => playTrack(toTrack(s), pl.songs.map(toTrack))} onMore={() => remove(s.song_id)} />
              ))
            ) : (
              <Text style={styles.empty}>Playlist hii haina nyimbo bado.</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  grad: { position: "absolute", top: 0, left: 0, right: 0, height: 300 },
  header: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  top: { alignItems: "center", paddingVertical: SPACING.md },
  cover: { width: 160, height: 160, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  coverImg: { width: 160, height: 160 },
  name: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800", marginTop: SPACING.md },
  count: { color: COLORS.textSecondary, fontSize: FONT.md, marginTop: 4 },
  playAll: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: SPACING.xl, height: 48, marginTop: SPACING.md },
  playAllText: { color: "#fff", fontSize: FONT.lg, fontWeight: "800", marginLeft: SPACING.sm },
  empty: { color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.xl },
});
