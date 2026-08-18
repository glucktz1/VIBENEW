import React from "react";
import { View, Text, Pressable, StyleSheet, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { usePlayer } from "@/src/context/PlayerContext";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;

export function usePlayerPrompt() {
  const { isGuest, effectivePremium, user } = useAuth() as any;
  const { current, promptRingtonePct } = usePlayer() as any;
  let isNew = false;
  if (user?.created_at) {
    const t = new Date(user.created_at).getTime();
    if (!isNaN(t)) isNew = Date.now() - t < NEW_WINDOW_MS;
  }
  if (isGuest) return { showRingtone: false, showContribute: false };
  // Paid users, just-joined users, or when billing is OFF (everyone premium) => ringtone prompt only, never a pay prompt.
  if (effectivePremium || isNew) return { showRingtone: true, showContribute: false };
  // FREE users: alternate between ringtone and contribute per admin-set ratio.
  // Deterministic per song (stable while a song plays, varies across songs).
  const pct = typeof promptRingtonePct === "number" ? promptRingtonePct : 50;
  const sid = String(current?.song_id || current?.id || "x");
  let h = 0;
  for (let i = 0; i < sid.length; i++) h = (h * 31 + sid.charCodeAt(i)) % 100;
  const ringtone = h < pct;
  return { showRingtone: ringtone, showContribute: !ringtone };
}

export default function PlayerPromptBanner({ variant = "full" }: { variant?: "full" | "mini" }) {
  const router = useRouter();
  const { current } = usePlayer();
  const { showRingtone, showContribute } = usePlayerPrompt();
  if (!showRingtone && !showContribute) return null;

  const setRingtone = () => {
    const title = current?.title || "Wimbo";
    if (Platform.OS === "android") {
      Alert.alert("Weka Muziki wa Simu", `"${title}" itawekwa kama mlio wa simu yako. Kipengele hiki hufanya kazi kwenye app iliyosakinishwa (build).`);
    } else if (Platform.OS === "ios") {
      Alert.alert("Weka Muziki wa Simu", "Kwenye iOS, mlio wa simu huwekwa kupitia GarageBand. Kipengele hiki hufanya kazi kwenye app iliyosakinishwa.");
    } else {
      Alert.alert("Weka Muziki wa Simu", "Kipengele hiki hupatikana kwenye app ya simu.");
    }
  };

  const mini = variant === "mini";
  const wrap = mini ? styles.miniWrap : styles.fullWrap;

  if (showRingtone) {
    return (
      <Pressable testID={`ringtone-banner-${variant}`} style={wrap} onPress={setRingtone}>
        <Ionicons name="musical-note" size={mini ? 12 : 16} color="#fff" />
        <Text style={mini ? styles.miniText : styles.fullText} numberOfLines={1}>Weka Wimbo huu muito wa simu yangu</Text>
        {!mini ? <View style={styles.actBtn}><Text style={styles.actBtnText}>Weka</Text></View> : <Ionicons name="chevron-forward" size={12} color="#fff" />}
      </Pressable>
    );
  }
  return (
    <Pressable testID={`changia-banner-${variant}`} style={wrap} onPress={() => router.push("/plans")}>
      <Ionicons name="star" size={mini ? 12 : 16} color="#fff" />
      <Text style={mini ? styles.miniText : styles.fullText} numberOfLines={1}>Changia kidogo kusikiliza kwa uhuru</Text>
      {!mini ? <View style={styles.actBtn}><Text style={styles.actBtnText}>Changia</Text></View> : <Ionicons name="chevron-forward" size={12} color="#fff" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWrap: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, marginTop: SPACING.md, gap: SPACING.sm },
  fullText: { flex: 1, color: "#fff", fontSize: FONT.sm, fontWeight: "700" },
  actBtn: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 5 },
  actBtnText: { color: "#fff", fontWeight: "800", fontSize: FONT.sm },
  miniWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary, paddingHorizontal: SPACING.sm, paddingVertical: 4, gap: 6 },
  miniText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
