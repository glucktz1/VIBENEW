import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { contentApi } from "@/src/services/api";
import { usePlayer } from "@/src/context/PlayerContext";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function Radio() {
  const router = useRouter();
  const { playTrack, current, isPlaying } = usePlayer();
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setStations(await contentApi.radio()); } catch {}
      setLoading(false);
    })();
  }, []);

  const playStation = (st: any) => {
    playTrack({
      song_id: `radio_${st.station_id}`,
      title: st.name,
      audio_url: st.stream_url,
      thumbnail: st.thumbnail,
      artist_name: "LIVE · Redio",
      isLive: true,
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="radio-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </Pressable>
        <Text style={styles.h1}>Redio</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
          {stations.map((st) => {
            const active = current?.song_id === `radio_${st.station_id}`;
            return (
              <Pressable key={st.station_id} testID={`radio-${st.station_id}`} style={styles.card} onPress={() => playStation(st)}>
                <Image source={{ uri: st.thumbnail }} style={styles.art} contentFit="cover" />
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <View style={styles.liveRow}>
                    <View style={styles.liveDot} />
                    <Text style={styles.live}>LIVE</Text>
                  </View>
                  <Text style={styles.name}>{st.name}</Text>
                  <Text style={styles.desc} numberOfLines={1}>{st.description}</Text>
                </View>
                <View style={[styles.playBtn, active && { backgroundColor: COLORS.success }]}>
                  <Ionicons name={active && isPlaying ? "pause" : "play"} size={22} color="#fff" />
                </View>
              </Pressable>
            );
          })}
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
  art: { width: 64, height: 64, borderRadius: RADIUS.full, backgroundColor: COLORS.surface },
  liveRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.error, marginRight: 4 },
  live: { color: COLORS.error, fontSize: FONT.xs, fontWeight: "800" },
  name: { color: COLORS.text, fontSize: FONT.md, fontWeight: "700" },
  desc: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 2 },
  playBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
});
