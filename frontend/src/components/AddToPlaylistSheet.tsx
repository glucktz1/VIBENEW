import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, TextInput, FlatList, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { libraryApi } from "@/src/services/api";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function AddToPlaylistSheet({
  songId,
  visible,
  onClose,
  onDone,
}: {
  songId: string | null;
  visible: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (visible) load();
  }, [visible]);

  const load = async () => {
    setLoading(true);
    try {
      setPlaylists(await libraryApi.playlists());
    } catch {}
    setLoading(false);
  };

  const add = async (pl: any) => {
    if (!songId) return;
    try {
      await libraryApi.addToPlaylist(pl.playlist_id, songId);
      onDone(`Imeongezwa kwenye "${pl.name}"`);
      onClose();
    } catch (e: any) {
      onDone(e.message || "Imeshindikana");
    }
  };

  const create = async () => {
    if (!name.trim()) return;
    try {
      const pl = await libraryApi.createPlaylist(name.trim());
      setName("");
      setCreating(false);
      if (songId) await libraryApi.addToPlaylist(pl.playlist_id, songId);
      onDone(`Playlist "${pl.name}" imetengenezwa`);
      onClose();
    } catch (e: any) {
      onDone(e.message || "Imeshindikana");
    }
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Ongeza kwenye Playlist</Text>

          {creating ? (
            <View style={styles.createRow}>
              <TextInput
                testID="new-playlist-input"
                value={name}
                onChangeText={setName}
                placeholder="Jina la playlist"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                autoFocus
              />
              <Pressable testID="new-playlist-save" style={styles.saveBtn} onPress={create}>
                <Text style={styles.saveText}>Hifadhi</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable testID="new-playlist-open" style={styles.newBtn} onPress={() => setCreating(true)}>
              <Ionicons name="add-circle" size={22} color={COLORS.primary} />
              <Text style={styles.newText}>Tengeneza playlist mpya</Text>
            </Pressable>
          )}

          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.lg }} />
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(i) => i.playlist_id}
              style={{ maxHeight: 280 }}
              renderItem={({ item }) => (
                <Pressable testID={`pl-pick-${item.playlist_id}`} style={styles.plRow} onPress={() => add(item)}>
                  <Ionicons name="musical-notes" size={20} color={COLORS.textSecondary} />
                  <Text style={styles.plName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.plCount}>{item.songs_count || 0}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>Huna playlist bado. Tengeneza mpya hapo juu.</Text>
              }
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: SPACING.md },
  title: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800", marginBottom: SPACING.md },
  newBtn: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md },
  newText: { color: COLORS.primary, fontSize: FONT.md, fontWeight: "700", marginLeft: SPACING.sm },
  createRow: { flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 44,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 44, justifyContent: "center", marginLeft: SPACING.sm },
  saveText: { color: "#fff", fontWeight: "800" },
  plRow: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  plName: { flex: 1, color: COLORS.text, fontSize: FONT.md, marginLeft: SPACING.md },
  plCount: { color: COLORS.textMuted, fontSize: FONT.sm },
  empty: { color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.lg },
});
