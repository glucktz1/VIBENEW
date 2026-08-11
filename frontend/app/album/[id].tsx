import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { musicApi, libraryApi } from "@/src/services/api";
import { useAuth } from "@/src/context/AuthContext";
import { usePlayer, Track } from "@/src/context/PlayerContext";
import SongRow from "@/src/components/SongRow";
import AddToPlaylistSheet from "@/src/components/AddToPlaylistSheet";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function AlbumDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isGuest, user } = useAuth();
  const { playTrack, current, isPlaying, togglePlay } = usePlayer();
  const [album, setAlbum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [sheetSong, setSheetSong] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try {
      const a = await musicApi.album(String(id));
      setAlbum(a);
      if (!isGuest) {
        const liked = await libraryApi.liked();
        setLikedIds(liked.map((s: any) => s.song_id));
      }
    } catch {}
    setLoading(false);
  }, [id, isGuest]);

  useEffect(() => { load(); }, [load]);

  const toTrack = (s: any): Track => ({ song_id: s.song_id, title: s.title, audio_url: s.audio_url, thumbnail: s.thumbnail || album?.thumbnail, artist_name: album?.artist_name, album_title: album?.title, album_id: album?.album_id, duration: s.duration });

  const playAll = () => {
    if (!album?.songs?.length) return;
    const q = album.songs.map(toTrack);
    playTrack(q[0], q);
  };

  const playOne = (s: any) => {
    const q = album.songs.map(toTrack);
    playTrack(toTrack(s), q);
  };

  const toggleLike = async (songId: string) => {
    if (isGuest) { router.push("/(auth)/login"); return; }
    try {
      const res = await libraryApi.toggleLike(songId);
      setLikedIds((prev) => res.liked ? [...prev, songId] : prev.filter((i) => i !== songId));
    } catch {}
  };

  if (loading || !album) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  const albumPlaying = current && album.songs?.some((s: any) => s.song_id === current.song_id);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 180 }}>
          <View style={styles.heroWrap}>
            <Image source={{ uri: album.thumbnail }} style={styles.heroBg} contentFit="cover" blurRadius={30} />
            <LinearGradient colors={["transparent", COLORS.background]} style={StyleSheet.absoluteFill} />
            <Pressable testID="album-back" style={styles.back} onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </Pressable>
            <View style={styles.heroContent}>
              <Image source={{ uri: album.thumbnail }} style={styles.cover} contentFit="cover" transition={200} />
              <Text style={styles.title}>{album.title}</Text>
              <Text style={styles.artist}>{album.artist_name}</Text>
              <Text style={styles.meta}>{album.songs_count} nyimbo · {album.category_name || "Muziki"}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable testID="album-play-all" style={styles.playAll} onPress={albumPlaying ? togglePlay : playAll}>
              <Ionicons name={albumPlaying && isPlaying ? "pause" : "play"} size={24} color="#fff" />
              <Text style={styles.playAllText}>{albumPlaying && isPlaying ? "Simamisha" : "Cheza Zote"}</Text>
            </Pressable>
          </View>

          <View style={styles.list}>
            {album.songs.map((s: any, i: number) => (
              <View key={s.song_id} style={styles.songWrap}>
                <View style={{ flex: 1 }}>
                  <SongRow song={{ ...s, artist_name: album.artist_name }} index={i} onPress={() => playOne(s)} />
                </View>
                <Pressable testID={`album-like-${s.song_id}`} onPress={() => toggleLike(s.song_id)} hitSlop={8} style={styles.likeBtn}>
                  <Ionicons name={likedIds.includes(s.song_id) ? "heart" : "heart-outline"} size={20} color={likedIds.includes(s.song_id) ? COLORS.error : COLORS.textMuted} />
                </Pressable>
                <Pressable testID={`album-add-${s.song_id}`} onPress={() => { if (isGuest) { router.push("/(auth)/login"); } else { setSheetSong(s.song_id); } }} hitSlop={8} style={styles.likeBtn}>
                  <Ionicons name="add-circle-outline" size={20} color={COLORS.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>

      {toast ? (
        <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View>
      ) : null}

      <AddToPlaylistSheet
        songId={sheetSong}
        visible={!!sheetSong}
        onClose={() => setSheetSong(null)}
        onDone={(m) => { setToast(m); setTimeout(() => setToast(""), 2200); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  heroWrap: { height: 380 },
  heroBg: { ...StyleSheet.absoluteFillObject, opacity: 0.5 },
  back: { position: "absolute", top: SPACING.sm, left: SPACING.md, width: 40, height: 40, borderRadius: RADIUS.full, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", zIndex: 2 },
  heroContent: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: SPACING.md },
  cover: { width: 180, height: 180, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, marginBottom: SPACING.md },
  title: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800", textAlign: "center", paddingHorizontal: SPACING.lg },
  artist: { color: COLORS.textSecondary, fontSize: FONT.lg, marginTop: 4 },
  meta: { color: COLORS.textMuted, fontSize: FONT.sm, marginTop: 4 },
  actions: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.md, marginTop: SPACING.md },
  playAll: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: SPACING.lg, height: 50 },
  playAllText: { color: "#fff", fontSize: FONT.lg, fontWeight: "800", marginLeft: SPACING.sm },
  list: { paddingHorizontal: SPACING.md, marginTop: SPACING.md },
  songWrap: { flexDirection: "row", alignItems: "center" },
  likeBtn: { padding: SPACING.xs, marginLeft: 2 },
  toast: { position: "absolute", bottom: 190, left: SPACING.lg, right: SPACING.lg, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  toastText: { color: COLORS.text, textAlign: "center", fontWeight: "600" },
});
