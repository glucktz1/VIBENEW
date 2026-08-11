import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, ActivityIndicator, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { musicApi } from "@/src/services/api";
import { usePlayer, Track } from "@/src/context/PlayerContext";
import AlbumCard from "@/src/components/AlbumCard";
import SongRow from "@/src/components/SongRow";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function Search() {
  const { playTrack } = usePlayer();
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [albums, setAlbums] = useState<any[]>([]);
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setCategories(await musicApi.categories());
        setAlbums(await musicApi.albums());
      } catch {}
    })();
  }, []);

  const runSearch = useCallback(async (text: string) => {
    if (!text.trim()) {
      setSongs([]);
      const a = active ? await musicApi.albums(`?category_id=${active}`) : await musicApi.albums();
      setAlbums(a);
      return;
    }
    setLoading(true);
    try {
      const res = await musicApi.search(text.trim());
      setAlbums(res.albums || []);
      setSongs(res.songs || []);
    } catch {}
    setLoading(false);
  }, [active]);

  useEffect(() => {
    const t = setTimeout(() => runSearch(q), 350);
    return () => clearTimeout(t);
  }, [q, runSearch]);

  const filterCat = async (catId: string | null) => {
    setActive(catId);
    setQ("");
    setSongs([]);
    const a = catId ? await musicApi.albums(`?category_id=${catId}`) : await musicApi.albums();
    setAlbums(a);
  };

  const play = (song: any) => {
    const t: Track = { song_id: song.song_id, title: song.title, audio_url: song.audio_url, thumbnail: song.thumbnail, artist_name: song.artist_name, album_title: song.album_title, album_id: song.album_id, duration: song.duration };
    playTrack(t, songs.map((s) => ({ song_id: s.song_id, title: s.title, audio_url: s.audio_url, thumbnail: s.thumbnail, artist_name: s.artist_name, album_title: s.album_title, album_id: s.album_id, duration: s.duration })));
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.headerBox}>
        <Text style={styles.h1}>Tafuta</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            testID="search-input"
            style={styles.input}
            placeholder="Nyimbo, albamu, wasanii"
            placeholderTextColor={COLORS.textMuted}
            value={q}
            onChangeText={setQ}
            returnKeyType="search"
          />
          {q ? (
            <Pressable testID="search-clear" onPress={() => setQ("")}>
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Category chips (horizontal, non-wrapping) */}
      <View style={styles.chipRowWrap}>
        <FlatList
          data={[{ category_id: null, name: "Zote" }, ...categories]}
          keyExtractor={(c) => c.category_id || "all"}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item }) => {
            const selected = active === item.category_id;
            return (
              <Pressable
                testID={`chip-${item.category_id || "all"}`}
                onPress={() => filterCat(item.category_id)}
                style={[styles.chip, selected && styles.chipActive]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item.name}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.lg }} /> : null}

        {songs.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nyimbo</Text>
            {songs.map((s) => (
              <SongRow key={s.song_id} song={s} onPress={() => play(s)} />
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{q ? "Albamu" : "Vinjari Albamu"}</Text>
          <View style={styles.grid}>
            {albums.map((a) => (
              <View key={a.album_id} style={styles.gridItem}>
                <AlbumCard album={a} full />
              </View>
            ))}
          </View>
        </View>
        <View style={{ height: 160 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  headerBox: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  h1: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800", marginBottom: SPACING.md },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 48, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, color: COLORS.text, marginLeft: SPACING.sm, fontSize: FONT.md },
  chipRowWrap: { height: 56, justifyContent: "center" },
  chipRow: { paddingHorizontal: SPACING.md, gap: SPACING.sm, alignItems: "center" },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: SPACING.md, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.textSecondary, fontSize: FONT.sm, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  section: { marginBottom: SPACING.lg },
  sectionTitle: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800", marginBottom: SPACING.md },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  gridItem: { width: "48%", marginBottom: SPACING.md },
});
