import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";
import { artistApi } from "@/src/services/artistApi";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

export default function ArtistDashboard() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [albums, setAlbums] = useState<any[]>([]);
  const [songs, setSongs] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"overview" | "music" | "withdrawals" | "profile">("overview");
  const [toast, setToast] = useState("");

  const [showAlbum, setShowAlbum] = useState(false);
  const [showSong, setShowSong] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [albumTitle, setAlbumTitle] = useState("");
  const [songForm, setSongForm] = useState({ title: "", album_id: "", path: "", media_url: "", fileName: "" });
  const [uploading, setUploading] = useState(false);
  const [wdForm, setWdForm] = useState({ amount: "", details: "" });
  const [busy, setBusy] = useState(false);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2400); };

  const load = useCallback(async () => {
    try {
      const m = await artistApi.me();
      setMe(m);
      const [e, a, s, w] = await Promise.all([
        artistApi.earnings().catch(() => null),
        artistApi.albums().catch(() => []),
        artistApi.songs().catch(() => []),
        artistApi.withdrawals().catch(() => []),
      ]);
      setEarnings(e); setAlbums(a); setSongs(s); setWithdrawals(w);
    } catch {
      router.replace("/artist/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const createAlbum = async () => {
    if (!albumTitle.trim()) return;
    setBusy(true);
    try {
      await artistApi.createAlbum({ title: albumTitle.trim() });
      setShowAlbum(false); setAlbumTitle(""); flash("Albamu imeongezwa (inasubiri idhini)");
      await load();
    } catch (e: any) { flash(e.message); } finally { setBusy(false); }
  };

  const pickAudio = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    setUploading(true);
    try {
      const up = await artistApi.uploadAudio(asset.uri, asset.name || "audio.mp3", asset.mimeType || "audio/mpeg");
      const url = `${artistApi.BASE}${up.media_url}`;
      setSongForm((f) => ({ ...f, path: up.path, media_url: url, fileName: asset.name || "audio.mp3", title: f.title || (asset.name || "").replace(/\.[^.]+$/, "") }));
      flash("Sauti imepakiwa");
    } catch (e: any) { flash(e.message); } finally { setUploading(false); }
  };

  const createSong = async () => {
    if (!songForm.title.trim() || !songForm.album_id || !songForm.media_url) {
      flash("Chagua albamu, weka kichwa na pakia sauti");
      return;
    }
    setBusy(true);
    try {
      await artistApi.createSong({ title: songForm.title.trim(), album_id: songForm.album_id, audio_url: songForm.media_url });
      setShowSong(false); setSongForm({ title: "", album_id: "", path: "", media_url: "", fileName: "" });
      flash("Wimbo umepakiwa (inasubiri idhini)");
      await load();
    } catch (e: any) { flash(e.message); } finally { setBusy(false); }
  };

  const requestWithdraw = async () => {
    const amount = parseInt(wdForm.amount, 10);
    if (!amount || amount <= 0) { flash("Weka kiasi sahihi"); return; }
    setBusy(true);
    try {
      await artistApi.requestWithdrawal({ amount, method: "mobile_money", details: wdForm.details });
      setShowWithdraw(false); setWdForm({ amount: "", details: "" });
      flash("Ombi la malipo limetumwa");
      await load();
    } catch (e: any) { flash(e.message); } finally { setBusy(false); }
  };

  const logout = async () => { await artistApi.clearToken(); router.replace("/(tabs)/profile"); };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const statusColor = (s: string) => s === "approved" || s === "paid" ? COLORS.success : s === "rejected" || s === "suspended" ? COLORS.error : COLORS.warning;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/(tabs)/profile")} hitSlop={10} testID="artist-back">
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <Text style={styles.hName} numberOfLines={1}>{me?.name}</Text>
          <Text style={styles.hSub}>Artist Portal</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusColor(me?.status) + "22", borderColor: statusColor(me?.status) }]}>
          <Text style={[styles.badgeText, { color: statusColor(me?.status) }]}>{me?.status?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.segment}>
        {([["overview", "Muhtasari"], ["music", "Muziki"], ["withdrawals", "Malipo"], ["profile", "Wasifu"]] as const).map(([t, l]) => (
          <Pressable key={t} testID={`artist-tab-${t}`} style={[styles.segBtn, tab === t && styles.segActive]} onPress={() => setTab(t as any)}>
            <Text style={[styles.segText, tab === t && styles.segTextActive]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}>

        {tab === "overview" ? (
          <>
            <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.earnCard}>
              <Text style={styles.earnLabel}>Salio Linalopatikana</Text>
              <Text style={styles.earnValue}>{earnings?.currency} {Number(earnings?.available || 0).toLocaleString()}</Text>
              <Pressable testID="artist-withdraw-open" style={styles.withdrawBtn} onPress={() => setShowWithdraw(true)}>
                <Ionicons name="wallet" size={18} color={COLORS.primary} />
                <Text style={styles.withdrawText}>Omba Malipo</Text>
              </Pressable>
            </LinearGradient>
            <View style={styles.statRow}>
              <MiniStat icon="cash" label="Jumla ya Mapato" value={`${earnings?.currency} ${Number(earnings?.total_earned || 0).toLocaleString()}`} />
              <MiniStat icon="play" label="Michezo" value={Number(earnings?.total_plays || 0).toLocaleString()} />
            </View>
            <View style={styles.statRow}>
              <MiniStat icon="checkmark-done" label="Yaliyolipwa" value={`${earnings?.currency} ${Number(earnings?.total_withdrawn || 0).toLocaleString()}`} />
              <MiniStat icon="time" label="Yanayosubiri" value={`${earnings?.currency} ${Number(earnings?.pending || 0).toLocaleString()}`} />
            </View>
            <Text style={styles.note}>Unapata {earnings?.currency} {earnings?.per_play_rate} kwa kila mchezo (mfano; malipo halisi yataongezwa baadaye).</Text>
          </>
        ) : null}

        {tab === "music" ? (
          <>
            <View style={styles.actionRow}>
              <Pressable testID="artist-add-album" style={styles.actBtn} onPress={() => setShowAlbum(true)}>
                <Ionicons name="add" size={18} color="#fff" /><Text style={styles.actText}>Albamu</Text>
              </Pressable>
              <Pressable testID="artist-add-song" style={[styles.actBtn, { backgroundColor: COLORS.success }]}
                onPress={() => { if (!albums.length) { flash("Tengeneza albamu kwanza"); return; } setSongForm((f) => ({ ...f, album_id: albums[0].album_id })); setShowSong(true); }}>
                <Ionicons name="cloud-upload" size={18} color="#fff" /><Text style={styles.actText}>Pakia Wimbo</Text>
              </Pressable>
            </View>
            {albums.length === 0 ? <Text style={styles.empty}>Bado hujaongeza albamu.</Text> : null}
            {albums.map((a) => (
              <View key={a.album_id} style={styles.albumCard}>
                <View style={styles.albumHead}>
                  <Ionicons name="albums" size={18} color={COLORS.primary} />
                  <Text style={styles.albumTitle} numberOfLines={1}>{a.title}</Text>
                  <View style={[styles.pill, { borderColor: statusColor(a.status) }]}>
                    <Text style={[styles.pillText, { color: statusColor(a.status) }]}>{a.status}</Text>
                  </View>
                </View>
                {songs.filter((s) => s.album_id === a.album_id).map((s) => (
                  <View key={s.song_id} style={styles.songRow}>
                    <Ionicons name="musical-note" size={15} color={COLORS.textMuted} />
                    <Text style={styles.songTitle} numberOfLines={1}>{s.title}</Text>
                    <Text style={styles.songPlays}>{s.plays || 0} ▶</Text>
                    <View style={[styles.pill, { borderColor: statusColor(s.status) }]}>
                      <Text style={[styles.pillText, { color: statusColor(s.status) }]}>{s.status}</Text>
                    </View>
                  </View>
                ))}
                {songs.filter((s) => s.album_id === a.album_id).length === 0 ? <Text style={styles.emptySmall}>Hakuna nyimbo bado</Text> : null}
              </View>
            ))}
          </>
        ) : null}

        {tab === "withdrawals" ? (
          <>
            <Pressable testID="artist-withdraw-open2" style={styles.actBtnFull} onPress={() => setShowWithdraw(true)}>
              <Ionicons name="wallet" size={18} color="#fff" /><Text style={styles.actText}>Omba Malipo Mapya</Text>
            </Pressable>
            {withdrawals.length === 0 ? <Text style={styles.empty}>Hakuna maombi ya malipo bado.</Text> : null}
            {withdrawals.map((w) => (
              <View key={w.withdrawal_id} style={styles.wdRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.wdAmount}>{w.currency} {Number(w.amount).toLocaleString()}</Text>
                  <Text style={styles.wdSub}>{w.method} · {(w.created_at || "").slice(0, 10)}</Text>
                </View>
                <View style={[styles.pill, { borderColor: statusColor(w.status) }]}>
                  <Text style={[styles.pillText, { color: statusColor(w.status) }]}>{w.status}</Text>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {tab === "profile" ? (
          <>
            <View style={styles.profRow}><Text style={styles.profLabel}>Jina</Text><Text style={styles.profVal}>{me?.name}</Text></View>
            <View style={styles.profRow}><Text style={styles.profLabel}>Barua pepe</Text><Text style={styles.profVal}>{me?.email}</Text></View>
            <View style={styles.profRow}><Text style={styles.profLabel}>Simu</Text><Text style={styles.profVal}>{me?.phone || "-"}</Text></View>
            <View style={styles.profRow}><Text style={styles.profLabel}>Aina</Text><Text style={styles.profVal}>{me?.genre || "-"}</Text></View>
            <View style={[styles.profRow, { borderBottomWidth: 0 }]}><Text style={styles.profLabel}>Maelezo</Text><Text style={styles.profVal} numberOfLines={3}>{me?.bio || "-"}</Text></View>
            <Pressable testID="artist-logout" style={styles.logout} onPress={logout}>
              <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
              <Text style={styles.logoutText}>Toka</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      {toast ? <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View> : null}

      {/* Album modal */}
      <Sheet visible={showAlbum} title="Ongeza Albamu" onClose={() => setShowAlbum(false)}>
        <Text style={styles.fieldLabel}>Kichwa cha Albamu</Text>
        <TextInput testID="album-title" style={styles.input} value={albumTitle} onChangeText={setAlbumTitle} placeholder="Sifa za Asubuhi" placeholderTextColor={COLORS.textMuted} />
        <SaveBtn tid="album-save" busy={busy} onPress={createAlbum} label="Hifadhi" />
      </Sheet>

      {/* Song upload modal */}
      <Sheet visible={showSong} title="Pakia Wimbo" onClose={() => setShowSong(false)}>
        <Text style={styles.fieldLabel}>Albamu</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.sm }}>
          {albums.map((a) => (
            <Pressable key={a.album_id} testID={`album-pick-${a.album_id}`} style={[styles.chip, songForm.album_id === a.album_id && styles.chipActive]}
              onPress={() => setSongForm((f) => ({ ...f, album_id: a.album_id }))}>
              <Text style={[styles.chipTxt, songForm.album_id === a.album_id && { color: "#fff" }]}>{a.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={styles.fieldLabel}>Kichwa cha Wimbo</Text>
        <TextInput testID="song-title" style={styles.input} value={songForm.title} onChangeText={(v) => setSongForm((f) => ({ ...f, title: v }))} placeholder="Asante Bwana" placeholderTextColor={COLORS.textMuted} />
        <Text style={styles.fieldLabel}>Faili la Sauti</Text>
        <Pressable testID="song-pick-audio" style={styles.pickBtn} onPress={pickAudio} disabled={uploading}>
          {uploading ? <ActivityIndicator color={COLORS.primary} /> : (
            <>
              <Ionicons name={songForm.media_url ? "checkmark-circle" : "cloud-upload"} size={20} color={songForm.media_url ? COLORS.success : COLORS.primary} />
              <Text style={styles.pickText} numberOfLines={1}>{songForm.fileName || "Chagua faili la sauti (.mp3)"}</Text>
            </>
          )}
        </Pressable>
        <SaveBtn tid="song-save" busy={busy} onPress={createSong} label="Pakia Wimbo" />
      </Sheet>

      {/* Withdraw modal */}
      <Sheet visible={showWithdraw} title="Omba Malipo" onClose={() => setShowWithdraw(false)}>
        <Text style={styles.fieldLabel}>Kiasi ({earnings?.currency}) · Salio: {Number(earnings?.available || 0).toLocaleString()}</Text>
        <TextInput testID="wd-amount" style={styles.input} value={wdForm.amount} onChangeText={(v) => setWdForm((f) => ({ ...f, amount: v.replace(/[^0-9]/g, "") }))} keyboardType="number-pad" placeholder="5000" placeholderTextColor={COLORS.textMuted} />
        <Text style={styles.fieldLabel}>Namba ya simu (M-Pesa/Tigo)</Text>
        <TextInput testID="wd-details" style={styles.input} value={wdForm.details} onChangeText={(v) => setWdForm((f) => ({ ...f, details: v }))} keyboardType="phone-pad" placeholder="+2557..." placeholderTextColor={COLORS.textMuted} />
        <SaveBtn tid="wd-save" busy={busy} onPress={requestWithdraw} label="Tuma Ombi" />
      </Sheet>
    </SafeAreaView>
  );
}

function MiniStat({ icon, label, value }: any) {
  return (
    <View style={styles.miniStat}>
      <Ionicons name={icon} size={18} color={COLORS.primary} />
      <Text style={styles.miniValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function Sheet({ visible, title, onClose, children }: any) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
            <Pressable style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelText}>Ghairi</Text></Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SaveBtn({ tid, busy, onPress, label }: any) {
  return (
    <Pressable testID={tid} style={styles.saveBtn} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", padding: SPACING.md },
  hName: { color: COLORS.text, fontSize: FONT.lg, fontWeight: "800" },
  hSub: { color: COLORS.textSecondary, fontSize: FONT.xs },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1 },
  badgeText: { fontSize: FONT.xs, fontWeight: "800" },
  segment: { flexDirection: "row", marginHorizontal: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 4 },
  segBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm, alignItems: "center" },
  segActive: { backgroundColor: COLORS.primary },
  segText: { color: COLORS.textSecondary, fontWeight: "700", fontSize: FONT.xs },
  segTextActive: { color: "#fff" },
  earnCard: { borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md },
  earnLabel: { color: "rgba(255,255,255,0.85)", fontSize: FONT.sm },
  earnValue: { color: "#fff", fontSize: 34, fontWeight: "900", marginTop: 4 },
  withdrawBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderRadius: RADIUS.full, height: 44, marginTop: SPACING.md },
  withdrawText: { color: COLORS.primary, fontWeight: "800", marginLeft: 6 },
  statRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm },
  miniStat: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  miniValue: { color: COLORS.text, fontSize: FONT.lg, fontWeight: "800", marginTop: 6 },
  miniLabel: { color: COLORS.textSecondary, fontSize: FONT.xs, marginTop: 2 },
  note: { color: COLORS.textMuted, fontSize: FONT.xs, marginTop: SPACING.sm, lineHeight: 16 },
  actionRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary, borderRadius: RADIUS.md, height: 46 },
  actBtnFull: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary, borderRadius: RADIUS.md, height: 48, marginBottom: SPACING.md },
  actText: { color: "#fff", fontWeight: "800", marginLeft: 6 },
  empty: { color: COLORS.textMuted, textAlign: "center", marginTop: SPACING.lg },
  emptySmall: { color: COLORS.textMuted, fontSize: FONT.xs, paddingVertical: SPACING.sm },
  albumCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  albumHead: { flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm },
  albumTitle: { flex: 1, color: COLORS.text, fontSize: FONT.md, fontWeight: "800", marginLeft: SPACING.sm },
  songRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.divider, gap: 8 },
  songTitle: { flex: 1, color: COLORS.text, fontSize: FONT.sm },
  songPlays: { color: COLORS.textMuted, fontSize: FONT.xs },
  pill: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  wdRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  wdAmount: { color: COLORS.text, fontSize: FONT.md, fontWeight: "800" },
  wdSub: { color: COLORS.textSecondary, fontSize: FONT.xs, marginTop: 2 },
  profRow: { paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  profLabel: { color: COLORS.textMuted, fontSize: FONT.xs, marginBottom: 2 },
  profVal: { color: COLORS.text, fontSize: FONT.md, fontWeight: "600" },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: SPACING.md, marginTop: SPACING.lg },
  logoutText: { color: COLORS.error, fontWeight: "700", marginLeft: 8 },
  toast: { position: "absolute", bottom: 30, left: SPACING.lg, right: SPACING.lg, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  toastText: { color: COLORS.text, textAlign: "center", fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: SPACING.xxl, maxHeight: "85%" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: SPACING.md },
  sheetTitle: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800", marginBottom: SPACING.md },
  fieldLabel: { color: COLORS.textSecondary, fontSize: FONT.sm, marginBottom: 6, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 48, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  chip: { paddingHorizontal: SPACING.md, height: 38, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", marginRight: SPACING.sm },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipTxt: { color: COLORS.textSecondary, fontWeight: "700", fontSize: FONT.sm },
  pickBtn: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: RADIUS.md, height: 50, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", gap: 8 },
  pickText: { flex: 1, color: COLORS.text, fontSize: FONT.sm },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, height: 50, alignItems: "center", justifyContent: "center", marginTop: SPACING.lg },
  saveText: { color: "#fff", fontWeight: "800", fontSize: FONT.md },
  cancelBtn: { alignItems: "center", paddingVertical: SPACING.md },
  cancelText: { color: COLORS.textMuted },
});
