import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { musicApi } from "@/src/services/api";
import { usePlayer, Track } from "@/src/context/PlayerContext";
import AlbumCard from "@/src/components/AlbumCard";
import SongRow from "@/src/components/SongRow";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function ArtistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { playTrack } = usePlayer();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await musicApi.artistCatalog(String(id)).catch(() => null);
    setData(d); setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const toTrack = (s: any): Track => ({ song_id: s.song_id, title: s.title, audio_url: s.audio_url, thumbnail: s.thumbnail, artist_name: data?.artist?.name, album_title: s.album_title, album_id: s.album_id, duration: s.duration });

  const playAll = () => {
    if (!data?.songs?.length) return;
    const q = data.songs.map(toTrack);
    playTrack(q[0], q);
  };
  const playOne = (s: any) => {
    const q = data.songs.map(toTrack);
    playTrack(toTrack(s), q);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>;
  if (!data) return <View style={styles.center}><Text style={styles.muted}>Msanii hakupatikana</Text></View>;

  const { artist, albums, songs } = data;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="artist-back" onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={28} color={COLORS.text} /></Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{artist.name}</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.hero}>
          {artist.thumbnail ? (
            <Image source={{ uri: artist.thumbnail }} style={styles.avatar} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.avatar, styles.fallback]}><Ionicons name="person" size={48} color="#fff" /></View>
          )}
          <Text style={styles.name}>{artist.name}</Text>
          <Text style={styles.sub}>{albums.length} albamu · {songs.length} nyimbo</Text>
          {artist.bio ? <Text style={styles.bio} numberOfLines={3}>{artist.bio}</Text> : null}
          <Pressable testID="artist-play-all" style={styles.playAll} onPress={playAll} disabled={!songs.length}>
            <Ionicons name="play" size={20} color="#fff" />
            <Text style={styles.playAllText}>Cheza Zote</Text>
          </Pressable>
        </View>

        {albums.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Albamu</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.md }}>
              {albums.map((a: any) => <AlbumCard key={a.album_id} album={a} />)}
            </ScrollView>
          </View>
        ) : null}

        {songs.length ? (
          <View style={[styles.section, { paddingHorizontal: SPACING.md }]}>
            <Text style={styles.sectionTitle}>Nyimbo Maarufu</Text>
            {songs.map((s: any) => (
              <SongRow key={s.song_id} song={{ ...s, artist_name: artist.name }} onPress={() => playOne(s)} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background },
  muted: { color: COLORS.textMuted },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  headerTitle: { color: COLORS.text, fontSize: FONT.lg, fontWeight: "800", flex: 1, textAlign: "center" },
  hero: { alignItems: "center", paddingVertical: SPACING.lg, paddingHorizontal: SPACING.lg },
  avatar: { width: 140, height: 140, borderRadius: 70, backgroundColor: COLORS.surface },
  fallback: { alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary },
  name: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800", marginTop: SPACING.md },
  sub: { color: COLORS.textMuted, fontSize: FONT.sm, marginTop: 4 },
  bio: { color: COLORS.textMuted, fontSize: FONT.sm, marginTop: SPACING.sm, textAlign: "center" },
  playAll: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.primary, borderRadius: 9999, paddingHorizontal: SPACING.xl, paddingVertical: 12, marginTop: SPACING.md },
  playAllText: { color: "#fff", fontWeight: "800", fontSize: FONT.md },
  section: { marginTop: SPACING.lg },
  sectionTitle: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800", marginBottom: SPACING.md, paddingHorizontal: SPACING.md },
});
