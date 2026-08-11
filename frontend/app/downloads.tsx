import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { listDownloads, removeDownload, clearAllDownloads, getDownloadsSize, formatBytes, isWeb, DownloadedTrack } from "@/src/services/downloads";
import { usePlayer, Track } from "@/src/context/PlayerContext";
import SongRow from "@/src/components/SongRow";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function Downloads() {
  const router = useRouter();
  const { playTrack } = usePlayer();
  const [items, setItems] = useState<DownloadedTrack[]>([]);
  const [size, setSize] = useState(0);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    if (isWeb) { setItems([]); setSize(0); return; }
    setItems(await listDownloads());
    setSize(await getDownloadsSize());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const play = (d: DownloadedTrack) => {
    const q: Track[] = items.map((x) => ({ song_id: x.song_id, title: x.title, audio_url: x.localUri, thumbnail: x.thumbnail, artist_name: x.artist_name, album_title: x.album_title, album_id: x.album_id, duration: x.duration }));
    playTrack(q.find((t) => t.song_id === d.song_id)!, q);
  };

  const del = async (id: string) => { await removeDownload(id); load(); };
  const clearAll = async () => { await clearAllDownloads(); setConfirm(false); load(); };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="downloads-back" onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </Pressable>
        <Text style={styles.h1}>Nyimbo Zilizopakuliwa</Text>
        <View style={{ width: 26 }} />
      </View>

      {isWeb ? (
        <View style={styles.center}>
          <Ionicons name="cloud-download-outline" size={56} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Pakua kwenye programu ya simu</Text>
          <Text style={styles.emptySub}>Nyimbo za nje ya mtandao zinapatikana kwenye programu ya Vibe ya Android/iOS.</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="download-outline" size={56} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Bado hujapakua nyimbo</Text>
          <Text style={styles.emptySub}>Bofya alama ya kupakua kwenye kicheza ili usikilize bila mtandao.</Text>
        </View>
      ) : (
        <>
          {/* Storage summary */}
          <View style={styles.summary} testID="downloads-summary">
            <View style={styles.storageIcon}>
              <Ionicons name="save" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={styles.storageValue}>{formatBytes(size)}</Text>
              <Text style={styles.storageLabel}>{items.length} nyimbo · hifadhi iliyotumika</Text>
            </View>
            <Pressable testID="downloads-clear-all" style={styles.clearBtn} onPress={() => setConfirm(true)}>
              <Ionicons name="trash-outline" size={16} color={COLORS.error} />
              <Text style={styles.clearText}>Futa Zote</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
            {items.map((d) => (
              <SongRow key={d.song_id} song={d} onPress={() => play(d)} onMore={() => del(d.song_id)} />
            ))}
          </ScrollView>
        </>
      )}

      <Modal transparent visible={confirm} animationType="fade" onRequestClose={() => setConfirm(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal} testID="clear-confirm">
            <Ionicons name="trash" size={32} color={COLORS.error} />
            <Text style={styles.modalTitle}>Futa upakuaji wote?</Text>
            <Text style={styles.modalSub}>Nyimbo {items.length} ({formatBytes(size)}) zitaondolewa kwenye simu.</Text>
            <Pressable testID="clear-confirm-yes" style={styles.dangerBtn} onPress={clearAll}>
              <Text style={styles.dangerText}>Futa Zote</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setConfirm(false)}>
              <Text style={styles.cancelText}>Ghairi</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md },
  h1: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  emptyTitle: { color: COLORS.text, fontSize: FONT.lg, fontWeight: "700", marginTop: SPACING.md },
  emptySub: { color: COLORS.textSecondary, fontSize: FONT.md, textAlign: "center", marginTop: SPACING.sm },
  summary: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, marginHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  storageIcon: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center" },
  storageValue: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800" },
  storageLabel: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 2 },
  clearBtn: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderWidth: 1, borderColor: COLORS.error },
  clearText: { color: COLORS.error, fontWeight: "700", fontSize: FONT.sm, marginLeft: 4 },
  overlay: { flex: 1, backgroundColor: COLORS.overlay, alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  modal: { width: "100%", maxWidth: 360, backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: "center" },
  modalTitle: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800", marginTop: SPACING.md },
  modalSub: { color: COLORS.textSecondary, fontSize: FONT.md, textAlign: "center", marginTop: SPACING.sm, marginBottom: SPACING.lg },
  dangerBtn: { backgroundColor: COLORS.error, borderRadius: RADIUS.full, height: 50, width: "100%", alignItems: "center", justifyContent: "center" },
  dangerText: { color: "#fff", fontWeight: "800", fontSize: FONT.md },
  cancelBtn: { paddingVertical: SPACING.md, marginTop: SPACING.xs },
  cancelText: { color: COLORS.textMuted, fontSize: FONT.md },
});
