import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { billingApi } from "@/src/services/api";
import { useAuth } from "@/src/context/AuthContext";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

const PERKS = ["Sikiliza bila kikomo", "Bila matangazo", "Ruka nyimbo bila kikomo", "Pakua kwa matumizi ya nje ya mtandao", "Ubora wa juu wa sauti"];

export default function Plans() {
  const router = useRouter();
  const { isGuest, isPremium, refresh, user } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    (async () => {
      try { setPlans(await billingApi.plans()); } catch {}
      setLoading(false);
    })();
  }, []);

  const subscribe = async () => {
    if (isGuest) { router.push("/(auth)/login"); return; }
    if (!phone.trim()) { setResult("Weka namba ya simu"); return; }
    setProcessing(true);
    setResult("");
    try {
      const res = await billingApi.subscribe(selected.plan_id, phone.trim());
      await refresh();
      setResult(res.message || "Malipo yamekamilika!");
      setTimeout(() => { setSelected(null); router.back(); }, 1500);
    } catch (e: any) {
      setResult(e.message || "Malipo yameshindikana");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.primaryDark, COLORS.background]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <Pressable testID="plans-back" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={COLORS.text} />
          </Pressable>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <View style={styles.heroIcon}>
            <Ionicons name="star" size={40} color={COLORS.warning} />
          </View>
          <Text style={styles.h1}>Vibe Premium</Text>
          <Text style={styles.sub}>Chagua unavyotaka kuchangia</Text>

          {isPremium ? (
            <View style={styles.activeCard} testID="plans-active">
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
              <Text style={styles.activeText}>Wewe ni mwanachama Premium</Text>
              {user?.subscription?.expires_at ? (
                <Text style={styles.activeSub}>Inaisha: {new Date(user.subscription.expires_at).toLocaleDateString()}</Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.perks}>
            {PERKS.map((p) => (
              <View key={p} style={styles.perkRow}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                <Text style={styles.perkText}>{p}</Text>
              </View>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.lg }} />
          ) : (
            plans.map((pl, idx) => (
              <Pressable key={pl.plan_id} testID={`plan-${pl.plan_id}`} style={[styles.planCard, idx === 1 && styles.planCardFeatured]} onPress={() => { if (!isPremium) setSelected(pl); }}>
                {idx === 1 ? <View style={styles.badge}><Text style={styles.badgeText}>MAARUFU</Text></View> : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{pl.name}</Text>
                  <Text style={styles.planDesc}>{pl.description}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.planPrice}>{pl.currency} {pl.price.toLocaleString()}</Text>
                  <Text style={styles.planDays}>/ siku {pl.duration_days}</Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Checkout modal */}
      <Modal transparent visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.checkoutTitle}>Lipia {selected?.name}</Text>
            <Text style={styles.checkoutPrice}>{selected?.currency} {selected?.price?.toLocaleString()}</Text>
            <Text style={styles.checkoutLabel}>Namba ya simu (Azam Pay)</Text>
            <TextInput
              testID="checkout-phone"
              style={styles.input}
              placeholder="07XX XXX XXX"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            {result ? <Text style={[styles.result, { color: result.includes("kamili") ? COLORS.success : COLORS.error }]} testID="checkout-result">{result}</Text> : null}
            <Pressable testID="checkout-pay" style={styles.payBtn} onPress={subscribe} disabled={processing}>
              {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>Changia Sasa</Text>}
            </Pressable>
            <Pressable testID="checkout-cancel" style={styles.cancelBtn} onPress={() => setSelected(null)}>
              <Text style={styles.cancelText}>Ghairi</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  heroIcon: { alignSelf: "center", width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", marginBottom: SPACING.md },
  h1: { color: COLORS.text, fontSize: FONT.xxxl, fontWeight: "800", textAlign: "center" },
  sub: { color: COLORS.textSecondary, fontSize: FONT.md, textAlign: "center", marginTop: 4, marginBottom: SPACING.lg },
  activeCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: "center", marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.success },
  activeText: { color: COLORS.text, fontSize: FONT.md, fontWeight: "700", marginTop: 4 },
  activeSub: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 2 },
  perks: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  perkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  perkText: { color: COLORS.text, fontSize: FONT.md, marginLeft: SPACING.sm },
  planCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  planCardFeatured: { borderColor: COLORS.primary, borderWidth: 2 },
  badge: { position: "absolute", top: -10, left: SPACING.md, backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: FONT.xs, fontWeight: "800" },
  planName: { color: COLORS.text, fontSize: FONT.lg, fontWeight: "800" },
  planDesc: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 2 },
  planPrice: { color: COLORS.primary, fontSize: FONT.xl, fontWeight: "800" },
  planDays: { color: COLORS.textMuted, fontSize: FONT.xs },
  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: SPACING.xxl },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: SPACING.md },
  checkoutTitle: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800" },
  checkoutPrice: { color: COLORS.primary, fontSize: FONT.xxl, fontWeight: "800", marginVertical: SPACING.sm },
  checkoutLabel: { color: COLORS.textSecondary, fontSize: FONT.sm, marginBottom: SPACING.xs },
  input: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 52, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, fontSize: FONT.md },
  result: { marginTop: SPACING.sm, fontWeight: "600" },
  payBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, height: 54, alignItems: "center", justifyContent: "center", marginTop: SPACING.md },
  payText: { color: "#fff", fontSize: FONT.lg, fontWeight: "800" },
  cancelBtn: { alignItems: "center", paddingVertical: SPACING.md, marginTop: SPACING.xs },
  cancelText: { color: COLORS.textMuted, fontSize: FONT.md },
});
