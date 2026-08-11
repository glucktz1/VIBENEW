import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { contentApi } from "@/src/services/api";
import { usePlayer } from "@/src/context/PlayerContext";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function Bible() {
  const { playTrack } = usePlayer();
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState<any>(null);
  const [chapter, setChapter] = useState<any>(null);
  const [chLoading, setChLoading] = useState(false);
  const [tab, setTab] = useState<"old" | "new">("old");

  useEffect(() => {
    (async () => {
      try { setBooks(await contentApi.bibleBooks()); } catch {}
      setLoading(false);
    })();
  }, []);

  const openChapter = async (b: any, ch: number) => {
    setBook(b);
    setChLoading(true);
    try {
      const data = await contentApi.bibleChapter(b.book_id, ch);
      setChapter(data);
    } catch {}
    setChLoading(false);
  };

  const playChapterAudio = () => {
    if (!chapter?.audio_url) return;
    playTrack({
      song_id: `bible_${book.book_id}_${chapter.chapter}`,
      title: `${chapter.book_name} ${chapter.chapter}`,
      audio_url: chapter.audio_url,
      thumbnail: undefined,
      artist_name: "Biblia Takatifu",
    });
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  // Chapter reader view
  if (chapter && book) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.readerHeader}>
          <Pressable testID="bible-back" onPress={() => setChapter(null)} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={COLORS.text} />
          </Pressable>
          <Text style={styles.readerTitle}>{chapter.book_name} {chapter.chapter}</Text>
          {chapter.has_audio ? (
            <Pressable testID="bible-play-audio" onPress={playChapterAudio} hitSlop={10}>
              <Ionicons name="volume-high" size={24} color={COLORS.primary} />
            </Pressable>
          ) : <View style={{ width: 24 }} />}
        </View>

        {/* Chapter selector */}
        <View style={styles.chipRowWrap}>
          <FlatList
            data={Array.from({ length: chapter.total_chapters }, (_, i) => i + 1)}
            keyExtractor={(n) => String(n)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            renderItem={({ item }) => (
              <Pressable
                testID={`bible-ch-${item}`}
                onPress={() => openChapter(book, item)}
                style={[styles.chChip, item === chapter.chapter && styles.chChipActive]}
              >
                <Text style={[styles.chChipText, item === chapter.chapter && styles.chChipTextActive]}>{item}</Text>
              </Pressable>
            )}
          />
        </View>

        <ScrollView contentContainerStyle={styles.readerBody} showsVerticalScrollIndicator={false}>
          {chLoading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : chapter.verses.length ? (
            chapter.verses.map((v: any) => (
              <Text key={v.verse} style={styles.verse}>
                <Text style={styles.verseNum}>{v.verse} </Text>
                {v.text}
              </Text>
            ))
          ) : (
            <View style={styles.center}>
              <Ionicons name="book-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.soon}>Sura hii inakuja hivi karibuni</Text>
            </View>
          )}
          <View style={{ height: 160 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Book list view
  const filtered = books.filter((b) => b.testament === tab);
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <Text style={styles.h1}>Biblia Takatifu</Text>
      <View style={styles.segment}>
        <Pressable testID="bible-old" style={[styles.segBtn, tab === "old" && styles.segActive]} onPress={() => setTab("old")}>
          <Text style={[styles.segText, tab === "old" && styles.segTextActive]}>Agano la Kale</Text>
        </Pressable>
        <Pressable testID="bible-new" style={[styles.segBtn, tab === "new" && styles.segActive]} onPress={() => setTab("new")}>
          <Text style={[styles.segText, tab === "new" && styles.segTextActive]}>Agano Jipya</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        {filtered.map((b) => (
          <Pressable key={b.book_id} testID={`bible-book-${b.book_id}`} style={styles.bookRow} onPress={() => openChapter(b, 1)}>
            <View style={styles.bookIcon}>
              <Ionicons name="book" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={styles.bookName}>{b.name}</Text>
              <Text style={styles.bookSub}>{b.name_en} · Sura {b.chapters}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  h1: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800", paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  segment: { flexDirection: "row", margin: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 4 },
  segBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm, alignItems: "center" },
  segActive: { backgroundColor: COLORS.primary },
  segText: { color: COLORS.textSecondary, fontWeight: "700" },
  segTextActive: { color: "#fff" },
  bookRow: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.sm },
  bookIcon: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center" },
  bookName: { color: COLORS.text, fontSize: FONT.md, fontWeight: "700" },
  bookSub: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 2 },
  readerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md },
  readerTitle: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800" },
  chipRowWrap: { height: 56, justifyContent: "center" },
  chipRow: { paddingHorizontal: SPACING.md, gap: SPACING.sm, alignItems: "center" },
  chChip: { flexShrink: 0, width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  chChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chChipText: { color: COLORS.textSecondary, fontWeight: "700" },
  chChipTextActive: { color: "#fff" },
  readerBody: { padding: SPACING.md },
  verse: { color: COLORS.text, fontSize: FONT.lg, lineHeight: 30, marginBottom: SPACING.sm },
  verseNum: { color: COLORS.primary, fontWeight: "800", fontSize: FONT.sm },
  soon: { color: COLORS.textMuted, marginTop: SPACING.md, fontSize: FONT.md },
});
