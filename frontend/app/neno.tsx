import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { contentApi, api } from "@/src/services/api";
import { usePlayer } from "@/src/context/PlayerContext";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function Neno() {
  const router = useRouter();
  const { playTrack } = usePlayer();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setEntries(await contentApi.neno()); } catch {}
      setLoading(false);
    })();
  }, []);

  const play = (e: any, kind: "reading" | "reflection") => {
    const url = kind === "reading" ? e.reading_audio_url : e.reflection_audio_url;
    if (!url) return;
    api.post(`/neno-la-leo/${e.entry_id}/play?kind=${kind}`).catch(() => {});
    playTrack({
      song_id: `neno_${e.entry_id}_${kind}`,
      title: `${e.title} · ${kind === "reading" ? "Kusoma" : "Tafakari"}`,
      audio_url: url,
      thumbnail: e.thumbnail,
      artist_name: e.leader_name || "Neno la Leo",
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="neno-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </Pressable>
        <Text style={styles.h1}>Neno la Leo</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
          {entries.map((e, idx) => (
            <View key={e.entry_id} testID={`neno-${e.entry_id}`} style={styles.card}>
              <LinearGradient
                colors={idx % 2 === 0 ? [COLORS.primary, COLORS.primaryDark] : ["#7c3aed", "#4c1d95"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGrad}
              >
                <View style={styles.leaderRow}>
                  {e.leader_photo ? <Image source={{ uri: e.leader_photo }} style={styles.leaderImg} contentFit="cover" /> : null}
                  <View style={{ marginLeft: SPACING.sm }}>
                    <Text style={styles.leaderName}>{e.leader_name || "Kiongozi"}</Text>
                    <Text style={styles.leaderTitle}>{e.leader_title || ""}</Text>
                  </View>
                </View>
                <Text style={styles.verseRef}>{e.verse_reference}</Text>
                <Text style={styles.title}>{e.title}</Text>
                <Text style={styles.body} numberOfLines={3}>{e.reading_text}</Text>

                <View style={styles.actions}>
                  <Pressable testID={`neno-read-${e.entry_id}`} style={styles.actBtn} onPress={() => play(e, "reading")} disabled={!e.reading_audio_url}>
                    <Ionicons name="play" size={16} color="#000" />
                    <Text style={styles.actText}>Kusoma</Text>
                  </Pressable>
                  {e.reflection_audio_url ? (
                    <Pressable testID={`neno-reflect-${e.entry_id}`} style={styles.actBtnGhost} onPress={() => play(e, "reflection")}>
                      <Ionicons name="play" size={16} color="#fff" />
                      <Text style={styles.actTextGhost}>Tafakari</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.soon}><Text style={styles.soonText}>Inakuja Hivi Karibuni</Text></View>
                  )}
                </View>
              </LinearGradient>
            </View>
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
  card: { borderRadius: RADIUS.xl, overflow: "hidden", marginBottom: SPACING.md },
  cardGrad: { padding: SPACING.lg },
  leaderRow: { flexDirection: "row", alignItems: "center", marginBottom: SPACING.md },
  leaderImg: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)" },
  leaderName: { color: "#fff", fontSize: FONT.md, fontWeight: "800" },
  leaderTitle: { color: "rgba(255,255,255,0.8)", fontSize: FONT.sm },
  verseRef: { color: "rgba(255,255,255,0.9)", fontSize: FONT.sm, fontWeight: "700" },
  title: { color: "#fff", fontSize: FONT.xl, fontWeight: "800", marginTop: 4 },
  body: { color: "rgba(255,255,255,0.9)", fontSize: FONT.md, lineHeight: 20, marginTop: SPACING.sm },
  actions: { flexDirection: "row", alignItems: "center", marginTop: SPACING.md, gap: SPACING.sm },
  actBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, height: 40 },
  actText: { color: "#000", fontWeight: "800", marginLeft: 4 },
  actBtnGhost: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, height: 40 },
  actTextGhost: { color: "#fff", fontWeight: "800", marginLeft: 4 },
  soon: { backgroundColor: "rgba(0,0,0,0.25)", borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, height: 40, justifyContent: "center" },
  soonText: { color: "#fff", fontSize: FONT.sm, fontWeight: "600" },
});
