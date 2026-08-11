import React, { useRef } from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { shareItem } from "@/src/services/share";
import { isWeb } from "@/src/services/downloads";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function ShareCardModal({
  song,
  visible,
  onClose,
  onToast,
}: {
  song: any | null;
  visible: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const cardRef = useRef<View>(null);

  if (!song) return null;

  const link = async () => {
    const r = await shareItem({ type: "song", id: song.song_id, title: song.title, subtitle: song.artist_name });
    if (r === "copied") onToast("Kiungo kimenakiliwa");
    onClose();
  };

  const shareImage = async () => {
    if (isWeb) { link(); return; }
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 0.95 });
      const can = await Sharing.isAvailableAsync();
      if (can) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: song.title });
      } else {
        await link();
        return;
      }
    } catch {
      await link();
      return;
    }
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.wrap}>
          {/* The capturable card */}
          <ViewShot ref={cardRef} style={styles.shot}>
            <LinearGradient colors={[COLORS.primary, COLORS.primaryDark, COLORS.background]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
              <View style={styles.brandRow}>
                <View style={styles.logo}><Ionicons name="musical-notes" size={16} color="#fff" /></View>
                <Text style={styles.brand}>Vibe</Text>
              </View>
              <Image source={{ uri: song.thumbnail }} style={styles.art} contentFit="cover" />
              <Text style={styles.title} numberOfLines={2}>{song.title}</Text>
              <Text style={styles.artist} numberOfLines={1}>{song.artist_name || song.album_title || "Vibe"}</Text>
              <View style={styles.eqRow}>
                <View style={[styles.eqBar, { height: 10 }]} />
                <View style={[styles.eqBar, { height: 20 }]} />
                <View style={[styles.eqBar, { height: 14 }]} />
                <View style={[styles.eqBar, { height: 24 }]} />
                <View style={[styles.eqBar, { height: 12 }]} />
              </View>
              <Text style={styles.tagline}>Sikiliza kwenye Vibe 🎵</Text>
            </LinearGradient>
          </ViewShot>

          <Pressable testID="share-image-btn" style={styles.primary} onPress={shareImage}>
            <Ionicons name={isWeb ? "share-social" : "image"} size={20} color="#fff" />
            <Text style={styles.primaryText}>{isWeb ? "Shiriki Kiungo" : "Shiriki Picha"}</Text>
          </Pressable>
          <Pressable testID="share-link-btn" style={styles.ghost} onPress={link}>
            <Ionicons name="link" size={18} color={COLORS.textSecondary} />
            <Text style={styles.ghostText}>Nakili Kiungo</Text>
          </Pressable>
          <Pressable testID="share-close" style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Funga</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: COLORS.overlay, alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  wrap: { width: "100%", maxWidth: 360, alignItems: "center" },
  shot: { borderRadius: RADIUS.xl, overflow: "hidden" },
  card: { width: 300, padding: SPACING.lg, alignItems: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginBottom: SPACING.md },
  logo: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  brand: { color: "#fff", fontSize: FONT.lg, fontWeight: "800", marginLeft: SPACING.sm },
  art: { width: 220, height: 220, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface },
  title: { color: "#fff", fontSize: FONT.xl, fontWeight: "800", marginTop: SPACING.md, textAlign: "center" },
  artist: { color: "rgba(255,255,255,0.85)", fontSize: FONT.md, marginTop: 4 },
  eqRow: { flexDirection: "row", alignItems: "flex-end", gap: 5, height: 26, marginTop: SPACING.md },
  eqBar: { width: 5, borderRadius: 2, backgroundColor: "#fff" },
  tagline: { color: "#fff", fontSize: FONT.sm, fontWeight: "700", marginTop: SPACING.md },
  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary, borderRadius: RADIUS.full, height: 52, width: "100%", marginTop: SPACING.lg },
  primaryText: { color: "#fff", fontSize: FONT.md, fontWeight: "800", marginLeft: SPACING.sm },
  ghost: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: SPACING.md, marginTop: SPACING.xs },
  ghostText: { color: COLORS.textSecondary, fontSize: FONT.md, marginLeft: SPACING.sm },
  close: { paddingVertical: SPACING.sm },
  closeText: { color: COLORS.textMuted, fontSize: FONT.md },
});
