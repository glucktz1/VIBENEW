import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "@/src/context/PlayerContext";
import { libraryApi } from "@/src/services/api";
import { isWeb, isDownloaded, downloadTrack, removeDownload } from "@/src/services/downloads";
import { shareItem } from "@/src/services/share";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function SongActionsSheet({
  song,
  visible,
  onClose,
  onAddToPlaylist,
  onToast,
  extraActions = [],
}: {
  song: any | null;
  visible: boolean;
  onClose: () => void;
  onAddToPlaylist: (song: any) => void;
  onToast: (msg: string) => void;
  extraActions?: { key: string; icon: string; label: string; onPress: () => void }[];
}) {
  const { gatePremium, promptDownloadApp } = usePlayer();
  const [liked, setLiked] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible && song && !isWeb) isDownloaded(song.song_id).then(setDownloaded);
    else setDownloaded(false);
  }, [visible, song?.song_id]);

  if (!song) return null;

  const like = async () => {
    if (!gatePremium()) { onClose(); return; }
    try {
      const res = await libraryApi.toggleLike(song.song_id);
      setLiked(res.liked);
      onToast(res.liked ? "Imeongezwa kwenye pendwa" : "Imeondolewa kwenye pendwa");
    } catch (e: any) { onToast(e.message || "Imeshindikana"); }
    onClose();
  };

  const download = async () => {
    if (isWeb) { onClose(); promptDownloadApp(); return; }
    if (downloaded) { await removeDownload(song.song_id); onToast("Imeondolewa"); onClose(); return; }
    if (!gatePremium()) { onClose(); return; }
    setBusy(true);
    try { await downloadTrack(song); onToast("Imepakuliwa"); }
    catch (e: any) { onToast(e.message || "Imeshindikana"); }
    setBusy(false);
    onClose();
  };

  const share = async () => {
    const r = await shareItem({ type: "song", id: song.song_id, title: song.title, subtitle: song.artist_name });
    if (r === "copied") onToast("Kiungo kimenakiliwa");
    onClose();
  };

  const addToPl = () => {
    onClose();
    if (gatePremium()) onAddToPlaylist(song);
  };

  const actions = [
    { key: "add", icon: "add-circle-outline", label: "Ongeza kwenye Playlist", onPress: addToPl },
    { key: "download", icon: downloaded ? "checkmark-circle" : "download-outline", label: downloaded ? "Ondoa upakuaji" : "Pakua", onPress: download },
    { key: "like", icon: liked ? "heart" : "heart-outline", label: liked ? "Ondoa kwenye pendwa" : "Penda", onPress: like },
    { key: "share", icon: "share-social-outline", label: "Shiriki", onPress: share },
    ...extraActions.map((a) => ({ ...a, onPress: () => { onClose(); a.onPress(); } })),
  ];

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Image source={{ uri: song.thumbnail }} style={styles.art} contentFit="cover" />
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={styles.title} numberOfLines={1}>{song.title}</Text>
              <Text style={styles.sub} numberOfLines={1}>{song.artist_name || song.album_title || "Vibe"}</Text>
            </View>
          </View>
          {actions.map((a) => (
            <Pressable key={a.key} testID={`action-${a.key}`} style={styles.row} onPress={a.onPress} disabled={busy}>
              {busy && a.key === "download" ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Ionicons name={a.icon as any} size={22} color={COLORS.text} />
              )}
              <Text style={styles.rowLabel}>{a.label}</Text>
            </Pressable>
          ))}
          <View style={{ height: SPACING.md }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: SPACING.xxl },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: SPACING.md },
  head: { flexDirection: "row", alignItems: "center", paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider, marginBottom: SPACING.sm },
  art: { width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.surface },
  title: { color: COLORS.text, fontSize: FONT.md, fontWeight: "800" },
  sub: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md },
  rowLabel: { color: COLORS.text, fontSize: FONT.md, marginLeft: SPACING.md, fontWeight: "600" },
});
