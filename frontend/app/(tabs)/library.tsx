import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { libraryApi } from "@/src/services/api";
import { useAuth } from "@/src/context/AuthContext";
import { usePlayer, Track } from "@/src/context/PlayerContext";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function Library() {
  const router = useRouter();
  const { isGuest } = useAuth();
  const { playTrack, gatePremium } = usePlayer();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [liked, setLiked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    if (isGuest) { setLoading(false); return; }
    try {
      const [pls, lk] = await Promise.all([libraryApi.playlists(), libraryApi.liked()]);
      setPlaylists(pls);
      setLiked(lk);
    } catch {}
    setLoading(false);
  }, [isGuest]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const createPl = async () => {
    if (!name.trim()) return;
    try {
      await libraryApi.createPlaylist(name.trim());
      setName("");
      setShowCreate(false);
      load();
    } catch {}
  };

  const playLiked = () => {
    if (!liked.length) return;
    const q: Track[] = liked.map((s) => ({ song_id: s.song_id, title: s.title, audio_url: s.audio_url, thumbnail: s.thumbnail, artist_name: s.artist_name, album_title: s.album_title, album_id: s.album_id, duration: s.duration }));
    playTrack(q[0], q);
  };

  if (isGuest) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <Text style={styles.h1}>Maktaba</Text>
        <View style={styles.center}>
          <Ionicons name="library-outline" size={56} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Ingia kuona maktaba yako</Text>
          <Text style={styles.emptySub}>Hifadhi nyimbo pendwa na tengeneza playlist zako.</Text>
          <Pressable testID="library-login" style={styles.primary} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.primaryText}>Ingia</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.h1}>Maktaba</Text>
        <Pressable testID="library-create" onPress={() => { if (gatePremium()) setShowCreate(true); }} hitSlop={10}>
          <Ionicons name="add" size={28} color={COLORS.text} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Liked songs pinned */}
          <Pressable testID="liked-songs" style={styles.likedRow} onPress={playLiked}>
            <View style={styles.likedIcon}>
              <Ionicons name="heart" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={styles.likedTitle}>Nyimbo Pendwa</Text>
              <Text style={styles.likedSub}>{liked.length} nyimbo</Text>
            </View>
            <Ionicons name="play-circle" size={30} color={COLORS.success} />
          </Pressable>

          <Text style={styles.sectionTitle}>Playlist Zangu</Text>
          {playlists.length === 0 ? (
            <Text style={styles.emptySub}>Huna playlist bado. Bofya + kutengeneza.</Text>
          ) : (
            playlists.map((pl) => (
              <Pressable key={pl.playlist_id} testID={`playlist-${pl.playlist_id}`} style={styles.plRow} onPress={() => router.push(`/playlist/${pl.playlist_id}`)}>
                <View style={styles.plArt}>
                  {pl.songs?.[0]?.thumbnail ? (
                    <Image source={{ uri: pl.songs[0].thumbnail }} style={styles.plImg} contentFit="cover" />
                  ) : (
                    <Ionicons name="musical-notes" size={24} color={COLORS.textSecondary} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.plName} numberOfLines={1}>{pl.name}</Text>
                  <Text style={styles.plSub}>{pl.songs_count || 0} nyimbo</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
              </Pressable>
            ))
          )}
          <View style={{ height: 160 }} />
        </ScrollView>
      )}

      <Modal transparent visible={showCreate} animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowCreate(false)}>
          <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Playlist Mpya</Text>
            <TextInput testID="create-pl-input" value={name} onChangeText={setName} placeholder="Jina la playlist" placeholderTextColor={COLORS.textMuted} style={styles.modalInput} autoFocus />
            <Pressable testID="create-pl-save" style={styles.primary} onPress={createPl}>
              <Text style={styles.primaryText}>Tengeneza</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: SPACING.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: SPACING.sm },
  h1: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800", paddingTop: SPACING.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.lg },
  emptyTitle: { color: COLORS.text, fontSize: FONT.lg, fontWeight: "700", marginTop: SPACING.md },
  emptySub: { color: COLORS.textSecondary, fontSize: FONT.md, textAlign: "center", marginTop: SPACING.sm },
  primary: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: SPACING.xl, height: 48, alignItems: "center", justifyContent: "center", marginTop: SPACING.lg },
  primaryText: { color: "#fff", fontSize: FONT.md, fontWeight: "800" },
  scroll: { paddingTop: SPACING.md },
  likedRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.lg },
  likedIcon: { width: 56, height: 56, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  likedTitle: { color: COLORS.text, fontSize: FONT.lg, fontWeight: "800" },
  likedSub: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 2 },
  sectionTitle: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800", marginBottom: SPACING.md },
  plRow: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.sm },
  plArt: { width: 56, height: 56, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  plImg: { width: 56, height: 56 },
  plName: { color: COLORS.text, fontSize: FONT.md, fontWeight: "700" },
  plSub: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "center", alignItems: "center", padding: SPACING.lg },
  modal: { width: "100%", maxWidth: 360, backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800", marginBottom: SPACING.md },
  modalInput: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 48, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
});
