import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, GestureResponderEvent, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from "react-native-reanimated";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { usePlayer } from "@/src/context/PlayerContext";
import { useAuth } from "@/src/context/AuthContext";
import { libraryApi } from "@/src/services/api";
import { isDownloaded, downloadTrack, removeDownload, isWeb } from "@/src/services/downloads";
import { shareItem } from "@/src/services/share";
import AddToPlaylistSheet from "@/src/components/AddToPlaylistSheet";
import QueueSheet from "@/src/components/QueueSheet";
import AnimatedEqualizer from "@/src/components/AnimatedEqualizer";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

function fmt(sec: number) {
  if (!sec || sec < 0 || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Player() {
  const router = useRouter();
  const { current, isPlaying, isBuffering, position, duration, togglePlay, next, prev, seek, previewMode, gatePremium, promptDownloadApp } = usePlayer();
  const { isGuest, isPremium } = useAuth();
  const [barWidth, setBarWidth] = useState(1);
  const [liked, setLiked] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [toast, setToast] = useState("");

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    opacity: 1 - Math.min(0.35, Math.abs(ty.value) / 900),
  }));

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2000); };

  useEffect(() => {
    if (current && !isWeb) isDownloaded(current.song_id).then(setDownloaded);
    else setDownloaded(false);
  }, [current?.song_id]);

  if (!current) {
    return (
      <View style={styles.center}>
        <Text style={{ color: COLORS.textSecondary }}>Hakuna wimbo unaochezwa</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: COLORS.primary }}>Rudi</Text>
        </Pressable>
      </View>
    );
  }

  // Live radio (or unknown/broken duration) => no seek bar, show LIVE.
  const rawDur = duration || current.duration || 0;
  const isLive = !!current.isLive || !isFinite(rawDur) || rawDur > 86400 || rawDur <= 0;
  const dur = isLive ? 0 : rawDur;
  const progress = dur > 0 ? Math.min(1, position / dur) : 0;

  const onSeek = (e: GestureResponderEvent) => {
    if (isLive) return;
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / barWidth));
    seek(ratio * dur);
  };

  const toggleLike = async () => {
    if (!gatePremium()) return;
    try {
      const res = await libraryApi.toggleLike(current.song_id);
      setLiked(res.liked);
    } catch {}
  };

  const onDownload = async () => {
    if (isWeb) { promptDownloadApp(); return; }
    if (downloaded) { await removeDownload(current.song_id); setDownloaded(false); return; }
    if (!gatePremium()) return;
    setDownloading(true);
    try {
      await downloadTrack(current);
      setDownloaded(true);
    } catch {}
    setDownloading(false);
  };

  const showChangiaBanner = !isGuest && !isPremium;

  const onShare = async () => {
    const r = await shareItem({ type: "song", id: current.song_id, title: current.title, subtitle: current.artist_name });
    if (r === "copied") flash("Kiungo kimenakiliwa");
  };

  const onAddToPlaylist = () => {
    if (gatePremium()) setShowPlaylist(true);
  };

  const doClose = () => router.back();
  const doNext = () => next();
  const doPrev = () => prev();

  const pan = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .activeOffsetY([-24, 24])
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY > 0 ? e.translationY : e.translationY * 0.12;
    })
    .onEnd((e) => {
      const CLOSE = 130;
      const SWIPE = 90;
      if (e.translationY > CLOSE && e.translationY > Math.abs(e.translationX)) {
        runOnJS(doClose)();
      } else if (Math.abs(e.translationX) > SWIPE && Math.abs(e.translationX) >= Math.abs(e.translationY)) {
        if (e.translationX < 0) runOnJS(doNext)();
        else runOnJS(doPrev)();
      }
      tx.value = withSpring(0);
      ty.value = withSpring(0);
    });

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.primaryDark, COLORS.background, COLORS.background]} style={StyleSheet.absoluteFill} />
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ flex: 1 }, animStyle]}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable testID="player-close" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-down" size={30} color={COLORS.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerLabel}>{isLive ? "REDIO" : "INACHEZA KUTOKA"}</Text>
            <Text style={styles.headerAlbum} numberOfLines={1}>{current.album_title || current.artist_name || "Vibe"}</Text>
          </View>
          <Pressable testID="player-queue" onPress={() => setShowQueue(true)} hitSlop={10}>
            <Ionicons name="list" size={26} color={COLORS.text} />
          </Pressable>
        </View>

        <View style={styles.artWrap}>
          <Image source={{ uri: current.thumbnail }} style={styles.art} contentFit="cover" transition={300} />
        </View>

        {previewMode ? (
          <View testID="preview-banner" style={styles.previewBanner}>
            <Ionicons name="time" size={16} color="#000" />
            <Text style={styles.previewText}>Hali ya Onjo (sekunde 15) · Changia usikilize kamili</Text>
          </View>
        ) : null}

        <View style={styles.meta}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{current.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>{isLive ? "LIVE · Redio" : current.artist_name || current.album_title || "Vibe"}</Text>
          </View>
          {isPlaying ? <AnimatedEqualizer playing={isPlaying} color={COLORS.primary} size={22} /> : null}
        </View>

        {/* Action row: like, add-to-playlist, share, download */}
        <View style={styles.actionRow}>
          <Pressable testID="player-like" onPress={toggleLike} hitSlop={10} style={styles.actBtn}>
            <Ionicons name={liked ? "heart" : "heart-outline"} size={26} color={liked ? COLORS.error : COLORS.text} />
          </Pressable>
          <Pressable testID="player-add" onPress={onAddToPlaylist} hitSlop={10} style={styles.actBtn}>
            <Ionicons name="add-circle-outline" size={26} color={COLORS.text} />
          </Pressable>
          <Pressable testID="player-share" onPress={onShare} hitSlop={10} style={styles.actBtn}>
            <Ionicons name="share-social-outline" size={24} color={COLORS.text} />
          </Pressable>
          {!isLive ? (
            <Pressable testID="player-download" onPress={onDownload} hitSlop={10} style={styles.actBtn}>
              {downloading ? (
                <ActivityIndicator color={COLORS.text} size="small" />
              ) : (
                <Ionicons name={downloaded ? "checkmark-circle" : "download-outline"} size={26} color={downloaded ? COLORS.success : COLORS.text} />
              )}
            </Pressable>
          ) : null}
        </View>

        {/* Non-premium payment prompt banner (faithful to Gracefy) */}
        {showChangiaBanner ? (
          <Pressable testID="changia-banner" style={styles.changiaBanner} onPress={() => router.push("/plans")}>
            <Ionicons name="star" size={16} color="#fff" />
            <Text style={styles.changiaText} numberOfLines={1}>Changia kidogo kusikiliza kwa uhuru</Text>
            <View style={styles.changiaBtn}><Text style={styles.changiaBtnText}>Changia</Text></View>
          </Pressable>
        ) : null}

        {/* Progress */}
        <View style={styles.progressWrap}>
          {isLive ? (
            <View style={styles.liveWrap}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>LIVE</Text>
            </View>
          ) : (
            <>
              <Pressable
                testID="player-seek"
                style={styles.barTouch}
                onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                onPress={onSeek}
              >
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
                  <View style={[styles.knob, { left: `${progress * 100}%` }]} />
                </View>
              </Pressable>
              <View style={styles.times}>
                <Text style={styles.time}>{fmt(position)}</Text>
                <Text style={styles.time}>{fmt(dur)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <Pressable testID="player-prev" onPress={prev} hitSlop={10}>
            <Ionicons name="play-skip-back" size={34} color={COLORS.text} />
          </Pressable>
          <Pressable testID="player-toggle" onPress={togglePlay} style={styles.playBtn}>
            {isBuffering ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <Ionicons name={isPlaying ? "pause" : "play"} size={40} color="#fff" />
            )}
          </Pressable>
          <Pressable testID="player-next" onPress={() => next()} hitSlop={10}>
            <Ionicons name="play-skip-forward" size={34} color={COLORS.text} />
          </Pressable>
        </View>
      </SafeAreaView>
        </Animated.View>
      </GestureDetector>

      {toast ? <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View> : null}

      <AddToPlaylistSheet
        songId={showPlaylist ? current.song_id : null}
        visible={showPlaylist}
        onClose={() => setShowPlaylist(false)}
        onDone={(m) => flash(m)}
      />

      <QueueSheet visible={showQueue} onClose={() => setShowQueue(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  headerLabel: { color: COLORS.textSecondary, fontSize: FONT.xs, fontWeight: "800", letterSpacing: 1 },
  headerAlbum: { color: COLORS.text, fontSize: FONT.md, fontWeight: "700", marginTop: 2, maxWidth: 240 },
  actionRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, marginTop: SPACING.md, gap: SPACING.lg },
  actBtn: { paddingVertical: SPACING.xs },
  toast: { position: "absolute", bottom: 30, left: SPACING.lg, right: SPACING.lg, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  toastText: { color: COLORS.text, textAlign: "center", fontWeight: "600" },
  artWrap: { alignItems: "center", marginTop: SPACING.xl, paddingHorizontal: SPACING.lg },
  art: { width: "100%", aspectRatio: 1, maxWidth: 360, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface },
  previewBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.warning, marginHorizontal: SPACING.lg, marginTop: SPACING.lg, borderRadius: RADIUS.md, padding: SPACING.sm },
  previewText: { color: "#000", fontSize: FONT.sm, fontWeight: "700", marginLeft: SPACING.xs },
  meta: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, marginTop: SPACING.xl },
  title: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800" },
  artist: { color: COLORS.textSecondary, fontSize: FONT.lg, marginTop: 4 },
  changiaBanner: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.primary, marginHorizontal: SPACING.lg, marginTop: SPACING.md, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 46 },
  changiaText: { flex: 1, color: "#fff", fontSize: FONT.sm, fontWeight: "700", marginLeft: SPACING.sm },
  changiaBtn: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  changiaBtnText: { color: "#fff", fontWeight: "800", fontSize: FONT.sm },
  liveWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: SPACING.md },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.error, marginRight: 6 },
  liveLabel: { color: COLORS.error, fontWeight: "800", fontSize: FONT.md, letterSpacing: 1 },
  progressWrap: { paddingHorizontal: SPACING.lg, marginTop: SPACING.lg },
  barTouch: { paddingVertical: SPACING.sm },
  barTrack: { height: 5, borderRadius: 3, backgroundColor: COLORS.progressBar },
  barFill: { height: 5, borderRadius: 3, backgroundColor: COLORS.primary },
  knob: { position: "absolute", top: -4, width: 13, height: 13, borderRadius: 7, backgroundColor: "#fff", marginLeft: -6 },
  times: { flexDirection: "row", justifyContent: "space-between", marginTop: SPACING.xs },
  time: { color: COLORS.textMuted, fontSize: FONT.sm },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-evenly", marginTop: SPACING.xl, paddingHorizontal: SPACING.xl },
  playBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
});
