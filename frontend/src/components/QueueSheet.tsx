import React from "react";
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "@/src/context/PlayerContext";
import AnimatedEqualizer from "@/src/components/AnimatedEqualizer";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function QueueSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { queue, currentIndex, isPlaying, playAt, reorderQueue, removeFromQueue } = usePlayer();

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>Foleni ({queue.length})</Text>
            <Pressable testID="queue-close" onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            {queue.map((t, i) => {
              const active = i === currentIndex;
              const upNext = i > currentIndex;
              return (
                <View key={`${t.song_id}-${i}`} style={[styles.row, active && styles.rowActive]}>
                  <Pressable testID={`queue-item-${i}`} style={styles.rowMain} onPress={() => playAt(i)}>
                    <View style={styles.artWrap}>
                      <Image source={{ uri: t.thumbnail }} style={styles.art} contentFit="cover" />
                      {active ? (
                        <View style={styles.eqOverlay}>
                          <AnimatedEqualizer playing={isPlaying} color="#fff" size={14} />
                        </View>
                      ) : null}
                    </View>
                    <View style={{ flex: 1, marginLeft: SPACING.md }}>
                      <Text style={[styles.name, active && { color: COLORS.primary }]} numberOfLines={1}>{t.title}</Text>
                      <Text style={styles.sub} numberOfLines={1}>{t.artist_name || t.album_title || "Vibe"}</Text>
                    </View>
                  </Pressable>
                  {upNext ? (
                    <View style={styles.controls}>
                      <Pressable testID={`queue-up-${i}`} onPress={() => reorderQueue(i, i - 1)} hitSlop={6} style={styles.ctrl}>
                        <Ionicons name="chevron-up" size={18} color={COLORS.textSecondary} />
                      </Pressable>
                      <Pressable testID={`queue-down-${i}`} onPress={() => reorderQueue(i, i + 1)} hitSlop={6} style={styles.ctrl}>
                        <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
                      </Pressable>
                      <Pressable testID={`queue-remove-${i}`} onPress={() => removeFromQueue(i)} hitSlop={6} style={styles.ctrl}>
                        <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={styles.played}>{active ? "Inacheza" : "Imecheza"}</Text>
                  )}
                </View>
              );
            })}
            <View style={{ height: SPACING.lg }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: SPACING.xxl },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: SPACING.md },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.sm },
  title: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.sm, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xs },
  rowActive: { backgroundColor: COLORS.surface },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center" },
  artWrap: { width: 46, height: 46 },
  art: { width: 46, height: 46, borderRadius: RADIUS.sm, backgroundColor: COLORS.surface },
  eqOverlay: { position: "absolute", top: 0, left: 0, width: 46, height: 46, borderRadius: RADIUS.sm, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  name: { color: COLORS.text, fontSize: FONT.md, fontWeight: "600" },
  sub: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 2 },
  controls: { flexDirection: "row", alignItems: "center" },
  ctrl: { paddingHorizontal: SPACING.xs },
  played: { color: COLORS.textMuted, fontSize: FONT.xs },
});
