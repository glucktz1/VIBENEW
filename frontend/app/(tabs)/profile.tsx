import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { authApi } from "@/src/services/api";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function Profile() {
  const router = useRouter();
  const { user, isGuest, isAdmin, isPremium, logout } = useAuth();
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteErr("");
    try {
      await authApi.deleteAccount();
      await logout();
      setShowDelete(false);
      router.replace("/(tabs)");
    } catch (e: any) {
      setDeleteErr(e.message || "Imeshindikana kufuta akaunti");
    } finally {
      setDeleting(false);
    }
  };

  const rows = [
    { key: "plans", label: "Kifurushi & Malipo", icon: "star", route: "/plans" },
    { key: "downloads", label: "Nyimbo Zilizopakuliwa", icon: "cloud-download", route: "/downloads" },
    { key: "neno", label: "Neno la Leo", icon: "sunny", route: "/neno" },
    { key: "churches", label: "Makanisa", icon: "business", route: "/churches" },
    { key: "radio", label: "Redio", icon: "radio", route: "/radio" },
  ];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
        <LinearGradient colors={[COLORS.primaryDark, COLORS.background]} style={styles.hero}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#fff" />
          </View>
          <Text style={styles.name}>{isGuest ? "Mgeni" : user?.name}</Text>
          <Text style={styles.email}>{isGuest ? "Hujaiingia" : user?.email}</Text>
          {isPremium ? (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={14} color="#000" />
              <Text style={styles.premiumText}>PREMIUM</Text>
            </View>
          ) : null}
        </LinearGradient>

        <View style={styles.body}>
          {isGuest ? (
            <Pressable testID="profile-login" style={styles.primary} onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.primaryText}>Ingia au Jisajili</Text>
            </Pressable>
          ) : null}

          {!isGuest && !isPremium ? (
            <Pressable testID="profile-upgrade" style={styles.upgrade} onPress={() => router.push("/plans")}>
              <Ionicons name="sparkles" size={22} color="#000" />
              <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                <Text style={styles.upgradeTitle}>Nenda Premium</Text>
                <Text style={styles.upgradeSub}>Sikiliza bila kikomo, bila matangazo</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#000" />
            </Pressable>
          ) : null}

          {rows.map((r) => (
            <Pressable key={r.key} testID={`profile-${r.key}`} style={styles.row} onPress={() => router.push(r.route as any)}>
              <Ionicons name={r.icon as any} size={22} color={COLORS.primary} />
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </Pressable>
          ))}

          {isAdmin ? (
            <Pressable testID="profile-admin" style={[styles.row, styles.adminRow]} onPress={() => router.push("/admin")}>
              <Ionicons name="shield-checkmark" size={22} color={COLORS.warning} />
              <Text style={[styles.rowLabel, { color: COLORS.warning }]}>Dashibodi ya Admin</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </Pressable>
          ) : null}

          {!isGuest ? (
            <Pressable testID="profile-logout" style={styles.logout} onPress={async () => { await logout(); router.replace("/(tabs)"); }}>
              <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
              <Text style={styles.logoutText}>Toka</Text>
            </Pressable>
          ) : null}

          {!isGuest && !isAdmin ? (
            <Pressable testID="profile-delete-account" style={styles.deleteBtn} onPress={() => { setDeleteErr(""); setShowDelete(true); }}>
              <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              <Text style={styles.deleteText}>Futa Akaunti</Text>
            </Pressable>
          ) : null}

          <Text style={styles.version}>Vibe v1.0.0</Text>
        </View>
      </ScrollView>

      <Modal transparent visible={showDelete} animationType="fade" onRequestClose={() => setShowDelete(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard} testID="delete-account-modal">
            <View style={styles.modalIcon}>
              <Ionicons name="warning" size={28} color={COLORS.error} />
            </View>
            <Text style={styles.modalTitle}>Futa Akaunti?</Text>
            <Text style={styles.modalBody}>
              Kitendo hiki hakiwezi kutenduliwa. Akaunti yako, playlist zako na taarifa zote zitafutwa kabisa.
            </Text>
            {deleteErr ? <Text style={styles.modalErr}>{deleteErr}</Text> : null}
            <Pressable testID="delete-account-confirm" style={styles.modalDelete} onPress={handleDelete} disabled={deleting}>
              {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalDeleteText}>Ndiyo, Futa Akaunti</Text>}
            </Pressable>
            <Pressable testID="delete-account-cancel" style={styles.modalCancel} onPress={() => setShowDelete(false)} disabled={deleting}>
              <Text style={styles.modalCancelText}>Ghairi</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  hero: { alignItems: "center", paddingTop: SPACING.xl, paddingBottom: SPACING.xl },
  avatar: { width: 90, height: 90, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginBottom: SPACING.md },
  name: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800" },
  email: { color: COLORS.textSecondary, fontSize: FONT.md, marginTop: 4 },
  premiumBadge: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.warning, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 4, marginTop: SPACING.sm },
  premiumText: { color: "#000", fontWeight: "800", fontSize: FONT.xs, marginLeft: 4 },
  body: { padding: SPACING.md },
  primary: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, height: 52, alignItems: "center", justifyContent: "center", marginBottom: SPACING.lg },
  primaryText: { color: "#fff", fontSize: FONT.lg, fontWeight: "800" },
  upgrade: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.warning, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg },
  upgradeTitle: { color: "#000", fontSize: FONT.lg, fontWeight: "800" },
  upgradeSub: { color: "#000", fontSize: FONT.sm, opacity: 0.8 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  adminRow: { borderColor: COLORS.warning },
  rowLabel: { flex: 1, color: COLORS.text, fontSize: FONT.md, fontWeight: "600", marginLeft: SPACING.md },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: SPACING.md, marginTop: SPACING.md },
  logoutText: { color: COLORS.error, fontSize: FONT.md, fontWeight: "700", marginLeft: SPACING.sm },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: SPACING.sm },
  deleteText: { color: COLORS.error, fontSize: FONT.sm, fontWeight: "600", marginLeft: 6, textDecorationLine: "underline" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  modalCard: { width: "100%", maxWidth: 360, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: "center" },
  modalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,71,87,0.15)", alignItems: "center", justifyContent: "center", marginBottom: SPACING.md },
  modalTitle: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800", marginBottom: SPACING.sm },
  modalBody: { color: COLORS.textSecondary, fontSize: FONT.md, textAlign: "center", lineHeight: 20, marginBottom: SPACING.md },
  modalErr: { color: COLORS.error, fontSize: FONT.sm, textAlign: "center", marginBottom: SPACING.sm },
  modalDelete: { backgroundColor: COLORS.error, borderRadius: RADIUS.full, height: 50, width: "100%", alignItems: "center", justifyContent: "center" },
  modalDeleteText: { color: "#fff", fontSize: FONT.md, fontWeight: "800" },
  modalCancel: { paddingVertical: SPACING.md, marginTop: SPACING.xs },
  modalCancelText: { color: COLORS.textMuted, fontSize: FONT.md, fontWeight: "600" },
  version: { color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.lg, fontSize: FONT.sm },
});
