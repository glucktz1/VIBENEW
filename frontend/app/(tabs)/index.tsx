import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, ActivityIndicator, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { musicApi } from "@/src/services/api";
import { useAuth } from "@/src/context/AuthContext";
import { usePlayer, Track } from "@/src/context/PlayerContext";
import AlbumCard from "@/src/components/AlbumCard";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";
import { formatCount } from "@/src/utils/format";

const QUICK = [
  { key: "radio", label: "Redio", icon: "radio", route: "/radio", color: "#0077B6" },
  { key: "podcasts", label: "Podcasts", icon: "mic", route: "/podcasts", color: "#FFA502" },
  { key: "books", label: "Vitabu", icon: "book", route: "/(tabs)/bible", color: "#2ED573" },
  { key: "studios", label: "Studio", icon: "business", route: "/churches", color: "#a78bfa" },
];

export default function Home() {
  const router = useRouter();
  const { user, isGuest } = useAuth();
  const { playTrack } = usePlayer();
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await musicApi.home();
      setSections(data.sections || []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const playSong = (song: any, list: any[]) => {
    const queue: Track[] = list.map((s) => ({
      song_id: s.song_id, title: s.title, audio_url: s.audio_url,
      thumbnail: s.thumbnail, artist_name: s.artist_name, album_title: s.album_title,
      album_id: s.album_id, duration: s.duration,
    }));
    playTrack(queue.find((t) => t.song_id === song.song_id)!, queue);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Habari za asubuhi" : hour < 17 ? "Habari za mchana" : "Habari za jioni";

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.primaryDark + "55", COLORS.background]} style={styles.headerGrad} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greet}>{greet}</Text>
              <Text style={styles.name}>{user?.name || "Karibu Vibe"}</Text>
            </View>
            <Pressable testID="home-profile" onPress={() => router.push("/(tabs)/profile")} style={styles.avatar}>
              <Ionicons name="person" size={20} color="#fff" />
            </Pressable>
          </View>

          {isGuest ? (
            <Pressable testID="home-guest-banner" style={styles.banner} onPress={() => router.push("/(auth)/login")}>
              <Ionicons name="sparkles" size={20} color={COLORS.primary} />
              <Text style={styles.bannerText}>Ingia ili kufurahia bila kikomo</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </Pressable>
          ) : null}

          {/* Quick access grid */}
          <View style={styles.quickGrid}>
            {QUICK.map((q) => (
              <Pressable key={q.key} testID={`quick-${q.key}`} style={styles.quickTile} onPress={() => router.push(q.route as any)}>
                <View style={[styles.quickIcon, { backgroundColor: q.color }]}>
                  <Ionicons name={q.icon as any} size={20} color="#fff" />
                </View>
                <Text style={styles.quickLabel} numberOfLines={1}>{q.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Sections */}
          {sections.map((section) => (
            <View key={section.id} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.type === "albums" ? (
                <FlatList
                  data={section.items}
                  keyExtractor={(a) => a.album_id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: SPACING.md }}
                  renderItem={({ item }) => <AlbumCard album={item} width={120} />}
                />
              ) : section.type === "artists" ? (
                <FlatList
                  data={section.items}
                  keyExtractor={(a) => a.artist_id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: SPACING.md }}
                  renderItem={({ item }) => (
                    <Pressable testID={`home-artist-${item.artist_id}`} style={styles.artistCard} onPress={() => router.push(`/artists/${item.artist_id}`)}>
                      {item.thumbnail ? (
                        <Image source={{ uri: item.thumbnail }} style={styles.artistArt} contentFit="cover" transition={200} />
                      ) : (
                        <View style={[styles.artistArt, styles.artistFallback]}><Ionicons name="person" size={30} color="#fff" /></View>
                      )}
                      <Text style={styles.artistName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.songArtist} numberOfLines={1}>{item.plays > 0 ? `${formatCount(item.plays)} michezo` : `${item.albums_count} albamu`}</Text>
                    </Pressable>
                  )}
                />
              ) : section.type === "recommended" ? (
                <FlatList
                  data={section.items}
                  keyExtractor={(s) => s.song_id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: SPACING.md }}
                  renderItem={({ item }) => (
                    <Pressable testID={`home-rec-${item.song_id}`} style={styles.recCard} onPress={() => playSong(item, section.items)}>
                      <Image source={{ uri: item.thumbnail }} style={styles.recArt} contentFit="cover" transition={200} />
                      <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                        <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.songArtist} numberOfLines={1}>{item.plays > 0 ? `${formatCount(item.plays)} michezo` : (item.artist_name || "Vibe")}</Text>
                      </View>
                      <View style={styles.recPlay}><Ionicons name="play" size={16} color="#fff" /></View>
                    </Pressable>
                  )}
                />
              ) : section.type === "pick_week" ? (
                <FlatList
                  data={section.items}
                  keyExtractor={(a) => a.album_id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: SPACING.md }}
                  renderItem={({ item }) => (
                    <Pressable testID={`home-pick-${item.album_id}`} style={styles.pickCard} onPress={() => router.push(`/album/${item.album_id}`)}>
                      <Image source={{ uri: item.thumbnail }} style={styles.pickArt} contentFit="cover" transition={200} />
                      <View style={styles.pickOverlay}>
                        <Text style={styles.pickTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.pickSub} numberOfLines={1}>{item.artist_name || "Vibe"} · {item.songs_count || 0} nyimbo</Text>
                      </View>
                      <View style={styles.pickPlay}><Ionicons name="play" size={22} color="#fff" /></View>
                    </Pressable>
                  )}
                />
              ) : section.type === "recently" ? (
                <FlatList
                  data={section.items}
                  keyExtractor={(a) => a.album_id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: SPACING.md }}
                  renderItem={({ item }) => (
                    <Pressable testID={`home-recent-${item.album_id}`} style={styles.recentCard} onPress={() => router.push(`/album/${item.album_id}`)}>
                      <Image source={{ uri: item.thumbnail }} style={styles.recentArt} contentFit="cover" transition={200} />
                      <Text style={styles.recentTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.recentSub} numberOfLines={1}>{item.artist_name || "Vibe"}</Text>
                    </Pressable>
                  )}
                />
              ) : (
                <FlatList
                  data={section.items}
                  keyExtractor={(s) => s.song_id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: SPACING.md }}
                  renderItem={({ item }) => (
                    <Pressable testID={`home-song-${item.song_id}`} style={styles.songCard} onPress={() => playSong(item, section.items)}>
                      <Image source={{ uri: item.thumbnail }} style={styles.songArt} contentFit="cover" transition={200} />
                      <View style={styles.songPlay}>
                        <Ionicons name="play" size={16} color="#fff" />
                      </View>
                      <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.songArtist} numberOfLines={1}>{item.artist_name || "Vibe"}</Text>
                    </Pressable>
                  )}
                />
              )}
            </View>
          ))}

          <View style={{ height: 140 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  headerGrad: { position: "absolute", top: 0, left: 0, right: 0, height: 260 },
  scroll: { paddingHorizontal: SPACING.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACING.sm, marginBottom: SPACING.md },
  greet: { color: COLORS.textSecondary, fontSize: FONT.md },
  name: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800" },
  avatar: { width: 40, height: 40, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  banner: {
    flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  bannerText: { flex: 1, color: COLORS.text, fontSize: FONT.md, fontWeight: "600", marginLeft: SPACING.sm },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: SPACING.lg },
  quickTile: {
    width: "48.5%", flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card,
    borderRadius: RADIUS.md, marginBottom: SPACING.sm, overflow: "hidden", height: 56,
  },
  quickIcon: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  quickLabel: { color: COLORS.text, fontSize: 13, fontWeight: "700", marginLeft: SPACING.sm, marginRight: SPACING.xs, flex: 1 },
  section: { marginBottom: SPACING.lg },
  artistCard: { width: 96, marginRight: SPACING.md, alignItems: "center" },
  artistArt: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.surface },
  artistFallback: { alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary },
  artistName: { color: COLORS.text, fontSize: FONT.sm, fontWeight: "700", marginTop: SPACING.sm, textAlign: "center" },
  recCard: { flexDirection: "row", alignItems: "center", width: 182, marginRight: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.sm },
  recArt: { width: 52, height: 52, borderRadius: 6, backgroundColor: COLORS.background },
  recPlay: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  pickCard: { width: 192, height: 96, marginRight: SPACING.md, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: COLORS.surface },
  pickArt: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  pickOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: SPACING.sm, backgroundColor: "rgba(0,0,0,0.45)" },
  pickTitle: { color: "#fff", fontSize: FONT.sm, fontWeight: "800" },
  pickSub: { color: "rgba(255,255,255,0.85)", fontSize: FONT.xs, marginTop: 2 },
  pickPlay: { position: "absolute", top: SPACING.sm, right: SPACING.sm, width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  recentCard: { width: 104, marginRight: SPACING.md },
  recentArt: { width: 104, height: 104, borderRadius: RADIUS.md, backgroundColor: COLORS.surface },
  recentTitle: { color: COLORS.text, fontSize: FONT.sm, fontWeight: "700", marginTop: SPACING.sm },
  recentSub: { color: COLORS.textSecondary, fontSize: FONT.xs, marginTop: 2 },
  sectionTitle: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800", marginBottom: SPACING.sm, letterSpacing: -0.5 },
  songCard: { width: 112, marginRight: SPACING.md },
  songArt: { width: 112, height: 112, borderRadius: RADIUS.md, backgroundColor: COLORS.surface },
  songPlay: {
    position: "absolute", right: SPACING.xs, top: 76, width: 32, height: 32, borderRadius: RADIUS.full,
    backgroundColor: COLORS.success, alignItems: "center", justifyContent: "center",
  },
  songTitle: { color: COLORS.text, fontSize: FONT.sm, fontWeight: "700", marginTop: SPACING.sm },
  songArtist: { color: COLORS.textSecondary, fontSize: FONT.xs, marginTop: 2 },
});
