import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { contentApi } from "@/src/services/api";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function Churches() {
  const router = useRouter();
  const [churches, setChurches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try { setChurches(await contentApi.churches()); } catch {}
      setLoading(false);
    })();
  }, []);

  const open = async (c: any) => {
    setSelected(c);
    try { setDetail(await contentApi.church(c.church_id)); } catch {}
  };

  if (selected && detail) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
          <View style={styles.cover}>
            <Image source={{ uri: detail.cover_image }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={["transparent", COLORS.background]} style={StyleSheet.absoluteFill} />
            <Pressable testID="church-back" style={styles.back} onPress={() => { setSelected(null); setDetail(null); }} hitSlop={10}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </Pressable>
          </View>
          <View style={{ padding: SPACING.md, marginTop: -40 }}>
            <Text style={styles.name}>{detail.name}</Text>
            <View style={styles.locRow}>
              <Ionicons name="location" size={16} color={COLORS.textSecondary} />
              <Text style={styles.loc}>{detail.location}</Text>
            </View>
            <View style={styles.stats}>
              <View style={styles.stat}><Text style={styles.statNum}>{detail.followers_count}</Text><Text style={styles.statLabel}>Wafuasi</Text></View>
              <View style={styles.stat}><Text style={styles.statNum}>{detail.members_count}</Text><Text style={styles.statLabel}>Wanachama</Text></View>
            </View>

            <Text style={styles.sectionTitle}>Ratiba ya Ibada</Text>
            {Object.entries(detail.schedule || {}).map(([day, time]) => (
              <View key={day} style={styles.schedRow}>
                <Text style={styles.day}>{day}</Text>
                <Text style={styles.time}>{String(time)}</Text>
              </View>
            ))}

            <Text style={styles.sectionTitle}>Matangazo</Text>
            {(detail.announcements || []).map((a: any) => (
              <View key={a.announcement_id} style={styles.annCard}>
                <Text style={styles.annTitle}>{a.title}</Text>
                <Text style={styles.annBody}>{a.body}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="churches-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </Pressable>
        <Text style={styles.h1}>Makanisa</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
          {churches.map((c) => (
            <Pressable key={c.church_id} testID={`church-${c.church_id}`} style={styles.card} onPress={() => open(c)}>
              <Image source={{ uri: c.thumbnail }} style={styles.art} contentFit="cover" />
              <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <Text style={styles.cardName}>{c.name}</Text>
                <Text style={styles.cardLoc}>{c.location}</Text>
                <Text style={styles.cardFollow}>{c.followers_count} wafuasi</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </Pressable>
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
  card: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.sm, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  art: { width: 64, height: 64, borderRadius: RADIUS.md, backgroundColor: COLORS.surface },
  cardName: { color: COLORS.text, fontSize: FONT.md, fontWeight: "700" },
  cardLoc: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 2 },
  cardFollow: { color: COLORS.textMuted, fontSize: FONT.xs, marginTop: 2 },
  cover: { height: 220 },
  back: { position: "absolute", top: SPACING.sm, left: SPACING.md, width: 40, height: 40, borderRadius: RADIUS.full, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  name: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800" },
  locRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  loc: { color: COLORS.textSecondary, fontSize: FONT.md, marginLeft: 4 },
  stats: { flexDirection: "row", gap: SPACING.xl, marginTop: SPACING.md },
  stat: { alignItems: "flex-start" },
  statNum: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800" },
  statLabel: { color: COLORS.textSecondary, fontSize: FONT.sm },
  sectionTitle: { color: COLORS.text, fontSize: FONT.lg, fontWeight: "800", marginTop: SPACING.lg, marginBottom: SPACING.sm },
  schedRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  day: { color: COLORS.text, fontSize: FONT.md, fontWeight: "600" },
  time: { color: COLORS.textSecondary, fontSize: FONT.md },
  annCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  annTitle: { color: COLORS.text, fontSize: FONT.md, fontWeight: "700" },
  annBody: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 4, lineHeight: 19 },
});
