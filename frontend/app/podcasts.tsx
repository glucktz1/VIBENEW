import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function Podcasts() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="podcasts-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </Pressable>
        <Text style={styles.h1}>Podcasts</Text>
        <View style={{ width: 26 }} />
      </View>
      <View style={styles.body}>
        <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.icon}>
          <Ionicons name="mic" size={40} color="#fff" />
        </LinearGradient>
        <Text style={styles.title}>Podcasts zinakuja hivi karibuni</Text>
        <Text style={styles.sub}>Sikiliza vipindi vya sauti kutoka kwa wasanii na waandaaji wako uwapendao. Tunaandaa maudhui — rudi tena hivi karibuni!</Text>
        <Pressable testID="podcasts-home" style={styles.btn} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.btnText}>Rudi Nyumbani</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md },
  h1: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800" },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  icon: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", marginBottom: SPACING.lg },
  title: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800", textAlign: "center" },
  sub: { color: COLORS.textSecondary, fontSize: FONT.md, textAlign: "center", marginTop: SPACING.sm, lineHeight: 22 },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: SPACING.xl, height: 48, alignItems: "center", justifyContent: "center", marginTop: SPACING.xl },
  btnText: { color: "#fff", fontWeight: "800" },
});
