import React from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePlayer } from "@/src/context/PlayerContext";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

/** Shows the GuestLimit prompt (login) or Subscription prompt (pay), driven by player.blockReason. */
export default function BlockModal() {
  const { blockReason, clearBlock } = usePlayer();
  const router = useRouter();
  const visible = blockReason !== null;
  const isGuest = blockReason === "guest";
  const isDownloadApp = blockReason === "download-app";

  const title = isGuest ? "Endelea Kusikiliza" : isDownloadApp ? "Pakua Programu ya Vibe" : "Nenda Premium";
  const body = isGuest
    ? "Umefikia kikomo cha bila malipo. Ingia au jisajili ili kuendelea kusikiliza bila kikomo."
    : isDownloadApp
    ? "Kupakua nyimbo na kusikiliza bila mtandao, tumia programu ya Vibe kwenye simu yako (Android/iOS)."
    : "Umefikia kikomo. Changia ili usikilize bila kikomo, bila matangazo, na upakue nyimbo.";
  const primaryLabel = isGuest ? "Ingia" : isDownloadApp ? "Sawa" : "Changia Sasa";
  const iconName = isGuest ? "lock-closed" : isDownloadApp ? "cloud-download" : "star";

  const onPrimary = () => {
    clearBlock();
    if (isGuest) router.push("/(auth)/login");
    else if (!isDownloadApp) router.push("/plans");
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={clearBlock}>
      <View style={styles.overlay}>
        <View testID="block-modal" style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name={iconName as any} size={34} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          <Pressable testID="block-primary" style={styles.primary} onPress={onPrimary}>
            <Text style={styles.primaryText}>{primaryLabel}</Text>
          </Pressable>
          {!isDownloadApp ? (
            <Pressable testID="block-dismiss" style={styles.ghost} onPress={clearBlock}>
              <Text style={styles.ghostText}>Baadaye</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  title: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800", marginBottom: SPACING.sm },
  body: { color: COLORS.textSecondary, fontSize: FONT.md, textAlign: "center", lineHeight: 20, marginBottom: SPACING.lg },
  primary: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    width: "100%",
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontSize: FONT.lg, fontWeight: "800" },
  ghost: { paddingVertical: SPACING.md, marginTop: SPACING.xs },
  ghostText: { color: COLORS.textMuted, fontSize: FONT.md },
});
