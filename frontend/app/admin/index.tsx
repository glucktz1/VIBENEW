import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { adminApi, musicApi } from "@/src/services/api";
import { useAuth } from "@/src/context/AuthContext";
import { COLORS, SPACING, FONT, RADIUS } from "@/src/theme";

const MENU = [
  { group: "Reports & Analytics", items: [
    { label: "Dashboard", icon: "grid", tab: "overview" },
    { label: "Analytics", icon: "stats-chart", tab: "overview" },
    { label: "Revenue", icon: "cash", tab: "overview" },
    { label: "Transactions", icon: "receipt", tab: "overview" },
  ]},
  { group: "Contents", items: [
    { label: "Songs & Albums", icon: "musical-notes", tab: "content" },
    { label: "Live Radio", icon: "radio" },
    { label: "Neno la Leo", icon: "sunny" },
    { label: "Bible", icon: "book" },
  ]},
  { group: "Control & Management", items: [
    { label: "App Users", icon: "people", tab: "users" },
    { label: "Admin Users", icon: "shield-checkmark", tab: "users" },
    { label: "Churches", icon: "business" },
    { label: "Religious Leaders", icon: "person" },
    { label: "Choir & Singers", icon: "mic" },
    { label: "Donations", icon: "heart" },
    { label: "Subscriptions", icon: "pricetags" },
  ]},
  { group: "System", items: [
    { label: "Settings", icon: "settings" },
    { label: "Feedback", icon: "chatbubbles" },
  ]},
];

export default function AdminDashboard() {
  const router = useRouter();
  const { isAdmin, isGuest, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "content" | "users">("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState("");

  // add forms
  const [showAlbum, setShowAlbum] = useState(false);
  const [showSong, setShowSong] = useState(false);
  const [albForm, setAlbForm] = useState({ title: "", artist_name: "", thumbnail: "" });
  const [songForm, setSongForm] = useState({ title: "", album_id: "", audio_url: "" });

  const load = useCallback(async () => {
    try {
      const [s, u, a] = await Promise.all([adminApi.stats(), adminApi.users(), musicApi.albums()]);
      setStats(s); setUsers(u); setAlbums(a);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const createAlbum = async () => {
    if (!albForm.title || !albForm.artist_name) return;
    try {
      await adminApi.createAlbum({ ...albForm, thumbnail: albForm.thumbnail || "https://picsum.photos/seed/vibe/400" });
      setShowAlbum(false); setAlbForm({ title: "", artist_name: "", thumbnail: "" });
      flash("Albamu imeongezwa"); load();
    } catch (e: any) { flash(e.message); }
  };

  const createSong = async () => {
    if (!songForm.title || !songForm.album_id || !songForm.audio_url) return;
    try {
      await adminApi.createSong(songForm);
      setShowSong(false); setSongForm({ title: "", album_id: "", audio_url: "" });
      flash("Wimbo umeongezwa"); load();
    } catch (e: any) { flash(e.message); }
  };

  if (authLoading) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.center} edges={["top"]}>
        <Ionicons name="lock-closed" size={48} color={COLORS.textMuted} />
        <Text style={styles.denied}>Huna ruhusa ya admin</Text>
        {isGuest ? (
          <>
            <Text style={styles.deniedSub}>Ingia na akaunti ya admin ili kuendelea.</Text>
            <Pressable testID="admin-login" style={styles.primary} onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.primaryText}>Ingia kama Admin</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable style={styles.ghostBtn} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.ghostBtnText}>Rudi Nyumbani</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="admin-menu" onPress={() => setDrawerOpen(true)} hitSlop={10}>
          <Ionicons name="menu" size={26} color={COLORS.text} />
        </Pressable>
        <Text style={styles.h1}>Admin Dashboard</Text>
        <Pressable testID="admin-back" onPress={() => router.replace("/(tabs)")} hitSlop={10}>
          <Ionicons name="home" size={22} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.segment}>
        {(["overview", "content", "users"] as const).map((t) => (
          <Pressable key={t} testID={`admin-tab-${t}`} style={[styles.segBtn, tab === t && styles.segActive]} onPress={() => setTab(t)}>
            <Text style={[styles.segText, tab === t && styles.segTextActive]}>
              {t === "overview" ? "Muhtasari" : t === "content" ? "Maudhui" : "Watumiaji"}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {tab === "overview" && stats ? (
            <>
              {/* Summary chips */}
              <View style={styles.chipsCard}>
                <View style={styles.chipsRow}>
                  <Text style={styles.chip}><Text style={styles.chipNum}>{stats.guest_plays ?? 0}</Text> guests</Text>
                  <Text style={styles.chipDot}>•</Text>
                  <Text style={styles.chip}><Text style={styles.chipNum}>{stats.total_plays ?? 0}</Text> plays</Text>
                  <Text style={styles.chipDot}>•</Text>
                  <Text style={styles.chip}><Text style={styles.chipNum}>{stats.total_transactions ?? 0}</Text> payments</Text>
                </View>
                <View style={styles.chipsRow}>
                  <Text style={styles.chip}><Text style={styles.chipNum}>{stats.currency} {Number(stats.revenue||0).toLocaleString()}</Text> raised</Text>
                  <Text style={styles.chipDot}>•</Text>
                  <Text style={styles.chip}><Text style={styles.chipNum}>{stats.total_users ?? 0}</Text> users</Text>
                </View>
              </View>
              <View style={styles.statGrid}>
                <StatCard testID="stat-users" icon="people" label="Watumiaji" value={stats.total_users} />
                <StatCard testID="stat-premium" icon="star" label="Premium" value={stats.premium_users} color={COLORS.warning} />
                <StatCard testID="stat-songs" icon="musical-notes" label="Nyimbo" value={stats.total_songs} color={COLORS.success} />
                <StatCard testID="stat-albums" icon="albums" label="Albamu" value={stats.total_albums} />
                <StatCard testID="stat-plays" icon="play" label="Michezo" value={stats.total_plays} color={COLORS.primaryLight} />
                <StatCard testID="stat-playlists" icon="list" label="Playlist" value={stats.total_playlists} />
                <StatCard testID="stat-radio" icon="radio" label="Redio" value={stats.total_radio} color={COLORS.primaryLight} />
                <StatCard testID="stat-neno" icon="sunny" label="Neno la Leo" value={stats.total_neno} color={COLORS.warning} />
                <StatCard testID="stat-churches" icon="business" label="Makanisa" value={stats.total_churches} />
                <StatCard testID="stat-plans" icon="pricetags" label="Vifurushi" value={stats.total_plans} color={COLORS.success} />
                <StatCard testID="stat-txns" icon="receipt" label="Malipo" value={stats.total_transactions} />
                <StatCard testID="stat-revenue" icon="cash" label={`Mapato (${stats.currency})`} value={stats.revenue?.toLocaleString()} color={COLORS.success} />
              </View>

              {/* Plays breakdown: guest vs logged-in */}
              <Text style={styles.sectionTitle}>Uchambuzi wa Michezo</Text>
              <View style={styles.breakdown}>
                <View style={styles.breakItem}>
                  <Text style={styles.breakNum}>{stats.logged_plays ?? 0}</Text>
                  <Text style={styles.breakLabel}>Waliojisajili</Text>
                </View>
                <View style={styles.breakDivider} />
                <View style={styles.breakItem}>
                  <Text style={styles.breakNum}>{stats.guest_plays ?? 0}</Text>
                  <Text style={styles.breakLabel}>Wageni</Text>
                </View>
              </View>
              {(() => {
                const g = stats.guest_plays ?? 0; const l = stats.logged_plays ?? 0; const tot = g + l || 1;
                return (
                  <View style={styles.barTrack}>
                    <View style={{ width: `${(l / tot) * 100}%`, backgroundColor: COLORS.primary, height: 10, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }} />
                    <View style={{ width: `${(g / tot) * 100}%`, backgroundColor: COLORS.warning, height: 10, borderTopRightRadius: 6, borderBottomRightRadius: 6 }} />
                  </View>
                );
              })()}

              <Text style={styles.sectionTitle}>Nyimbo Zinazoongoza</Text>
              {(stats.top_songs || []).map((s: any, i: number) => (
                <View key={s.song_id} style={styles.topRow}>
                  <Text style={styles.rank}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topTitle} numberOfLines={1}>{s.title}</Text>
                    <Text style={styles.topSub}>{s.artist_name || "Vibe"}</Text>
                  </View>
                  <Text style={styles.topPlays}>{s.plays} ▶</Text>
                </View>
              ))}

              {/* Recent transactions */}
              <Text style={styles.sectionTitle}>Malipo ya Karibuni</Text>
              {(stats.recent_transactions || []).length === 0 ? (
                <Text style={styles.topSub}>Hakuna malipo bado.</Text>
              ) : (
                (stats.recent_transactions || []).map((t: any, i: number) => (
                  <View key={i} style={styles.topRow}>
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                    <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                      <Text style={styles.topTitle} numberOfLines={1}>{t.plan_id || "Premium"}</Text>
                      <Text style={styles.topSub} numberOfLines={1}>{t.phone || "-"}</Text>
                    </View>
                    <Text style={styles.topPlays}>{stats.currency} {Number(t.amount || 0).toLocaleString()}</Text>
                  </View>
                ))
              )}
            </>
          ) : null}

          {tab === "content" ? (
            <>
              <View style={styles.actionRow}>
                <Pressable testID="admin-add-album" style={styles.actBtn} onPress={() => setShowAlbum(true)}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.actText}>Albamu</Text>
                </Pressable>
                <Pressable testID="admin-add-song" style={[styles.actBtn, { backgroundColor: COLORS.success }]} onPress={() => setShowSong(true)}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.actText}>Wimbo</Text>
                </Pressable>
              </View>
              <Text style={styles.sectionTitle}>Albamu ({albums.length})</Text>
              {albums.map((a) => (
                <View key={a.album_id} style={styles.contentRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topTitle} numberOfLines={1}>{a.title}</Text>
                    <Text style={styles.topSub}>{a.artist_name} · {a.songs_count} nyimbo</Text>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          {tab === "users" ? (
            <>
              <Text style={styles.sectionTitle}>Watumiaji ({users.length})</Text>
              {users.map((u, i) => (
                <View key={i} style={styles.contentRow}>
                  <View style={styles.userAvatar}>
                    <Ionicons name="person" size={16} color="#fff" />
                  </View>
                  <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                    <Text style={styles.topTitle} numberOfLines={1}>{u.name || u.email}</Text>
                    <Text style={styles.topSub} numberOfLines={1}>{u.email}</Text>
                  </View>
                  {u.is_premium ? <Ionicons name="star" size={16} color={COLORS.warning} /> : null}
                  {u.role !== "customer" ? <Text style={styles.roleBadge}>{u.role}</Text> : null}
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}

      {toast ? <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View> : null}

      {/* Side drawer navigation */}
      <Modal transparent visible={drawerOpen} animationType="slide" onRequestClose={() => setDrawerOpen(false)}>
        <Pressable style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)}>
          <Pressable style={styles.drawer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.drawerHead}>
              <Ionicons name="musical-notes" size={20} color={COLORS.primary} />
              <Text style={styles.drawerTitle}>Admin Dashboard</Text>
              <Pressable testID="drawer-close" onPress={() => setDrawerOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {MENU.map((grp) => (
                <View key={grp.group} style={{ marginBottom: SPACING.md }}>
                  <Text style={styles.drawerGroup}>{grp.group}</Text>
                  {grp.items.map((it) => (
                    <Pressable
                      key={it.label}
                      testID={`menu-${it.tab || it.label}`}
                      style={styles.drawerItem}
                      onPress={() => {
                        setDrawerOpen(false);
                        if (it.tab) setTab(it.tab as any);
                        else flash(`${it.label}: Inakuja hivi karibuni`);
                      }}
                    >
                      <Ionicons name={it.icon as any} size={18} color={it.tab === tab ? COLORS.primary : COLORS.textSecondary} />
                      <Text style={[styles.drawerLabel, it.tab === tab && { color: COLORS.primary, fontWeight: "800" }]}>{it.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add album modal */}
      <FormModal
        visible={showAlbum} title="Ongeza Albamu" onClose={() => setShowAlbum(false)} onSave={createAlbum} testID="album-form"
        fields={[
          { key: "title", label: "Kichwa", value: albForm.title, set: (v: string) => setAlbForm({ ...albForm, title: v }) },
          { key: "artist_name", label: "Msanii", value: albForm.artist_name, set: (v: string) => setAlbForm({ ...albForm, artist_name: v }) },
          { key: "thumbnail", label: "URL ya Picha (hiari)", value: albForm.thumbnail, set: (v: string) => setAlbForm({ ...albForm, thumbnail: v }) },
        ]}
      />
      {/* Add song modal */}
      <FormModal
        visible={showSong} title="Ongeza Wimbo" onClose={() => setShowSong(false)} onSave={createSong} testID="song-form"
        fields={[
          { key: "title", label: "Kichwa", value: songForm.title, set: (v: string) => setSongForm({ ...songForm, title: v }) },
          { key: "album_id", label: "Album ID", value: songForm.album_id, set: (v: string) => setSongForm({ ...songForm, album_id: v }) },
          { key: "audio_url", label: "URL ya Sauti", value: songForm.audio_url, set: (v: string) => setSongForm({ ...songForm, audio_url: v }) },
        ]}
      />
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, color = COLORS.primary, testID }: any) {
  return (
    <View testID={testID} style={styles.statCard}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FormModal({ visible, title, fields, onClose, onSave, testID }: any) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet} testID={testID}>
          <View style={styles.handle} />
          <Text style={styles.modalTitle}>{title}</Text>
          {fields.map((f: any) => (
            <View key={f.key} style={{ marginBottom: SPACING.sm }}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <TextInput
                testID={`${testID}-${f.key}`}
                style={styles.input}
                value={f.value}
                onChangeText={f.set}
                placeholder={f.label}
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
              />
            </View>
          ))}
          <Pressable testID={`${testID}-save`} style={styles.saveBtn} onPress={onSave}>
            <Text style={styles.saveText}>Hifadhi</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Ghairi</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  denied: { color: COLORS.text, fontSize: FONT.lg, fontWeight: "700", marginTop: SPACING.md },
  deniedSub: { color: COLORS.textSecondary, fontSize: FONT.md, textAlign: "center", marginTop: SPACING.sm, paddingHorizontal: SPACING.lg },
  ghostBtn: { paddingVertical: SPACING.md, marginTop: SPACING.sm },
  ghostBtnText: { color: COLORS.textMuted, fontSize: FONT.md, fontWeight: "600" },
  primary: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: SPACING.xl, height: 48, alignItems: "center", justifyContent: "center", marginTop: SPACING.lg },
  primaryText: { color: "#fff", fontWeight: "800" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md },
  h1: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800" },
  chipsCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md },
  chipsRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", paddingVertical: 2 },
  chip: { color: COLORS.textSecondary, fontSize: FONT.sm },
  chipNum: { color: COLORS.text, fontWeight: "800" },
  chipDot: { color: COLORS.textMuted, marginHorizontal: SPACING.sm },
  drawerOverlay: { flex: 1, backgroundColor: COLORS.overlay, flexDirection: "row" },
  drawer: { width: "78%", maxWidth: 320, height: "100%", backgroundColor: COLORS.surface, borderRightWidth: 1, borderRightColor: COLORS.border, padding: SPACING.md, paddingTop: SPACING.xl },
  drawerHead: { flexDirection: "row", alignItems: "center", marginBottom: SPACING.lg },
  drawerTitle: { flex: 1, color: COLORS.text, fontSize: FONT.lg, fontWeight: "800", marginLeft: SPACING.sm },
  drawerGroup: { color: COLORS.textMuted, fontSize: FONT.xs, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: SPACING.xs, marginTop: SPACING.xs },
  drawerItem: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.sm, paddingLeft: SPACING.sm },
  drawerLabel: { color: COLORS.text, fontSize: FONT.md, marginLeft: SPACING.md, fontWeight: "600" },
  segment: { flexDirection: "row", marginHorizontal: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 4 },
  segBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm, alignItems: "center" },
  segActive: { backgroundColor: COLORS.primary },
  segText: { color: COLORS.textSecondary, fontWeight: "700", fontSize: FONT.sm },
  segTextActive: { color: "#fff" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  statCard: { width: "31%", backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, alignItems: "flex-start" },
  breakdown: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm },
  breakItem: { flex: 1, alignItems: "center" },
  breakNum: { color: COLORS.text, fontSize: FONT.xxl, fontWeight: "800" },
  breakLabel: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 2 },
  breakDivider: { width: 1, height: 40, backgroundColor: COLORS.border },
  barTrack: { flexDirection: "row", width: "100%", height: 10, borderRadius: 6, backgroundColor: COLORS.surface, overflow: "hidden", marginBottom: SPACING.sm },
  statValue: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800", marginTop: SPACING.xs },
  statLabel: { color: COLORS.textSecondary, fontSize: FONT.xs, marginTop: 2 },
  sectionTitle: { color: COLORS.text, fontSize: FONT.lg, fontWeight: "800", marginTop: SPACING.lg, marginBottom: SPACING.sm },
  topRow: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  rank: { width: 28, color: COLORS.primary, fontWeight: "800", fontSize: FONT.md },
  topTitle: { color: COLORS.text, fontSize: FONT.md, fontWeight: "600" },
  topSub: { color: COLORS.textSecondary, fontSize: FONT.sm, marginTop: 2 },
  topPlays: { color: COLORS.textMuted, fontSize: FONT.sm },
  actionRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary, borderRadius: RADIUS.md, height: 46 },
  actText: { color: "#fff", fontWeight: "800", marginLeft: 4 },
  contentRow: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  userAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  roleBadge: { color: COLORS.warning, fontSize: FONT.xs, fontWeight: "800", marginLeft: SPACING.sm, textTransform: "uppercase" },
  toast: { position: "absolute", bottom: 40, left: SPACING.lg, right: SPACING.lg, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  toastText: { color: COLORS.text, textAlign: "center", fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: SPACING.xxl },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: SPACING.md },
  modalTitle: { color: COLORS.text, fontSize: FONT.xl, fontWeight: "800", marginBottom: SPACING.md },
  fieldLabel: { color: COLORS.textSecondary, fontSize: FONT.sm, marginBottom: 4 },
  input: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 46, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, height: 50, alignItems: "center", justifyContent: "center", marginTop: SPACING.sm },
  saveText: { color: "#fff", fontWeight: "800", fontSize: FONT.md },
  cancelBtn: { alignItems: "center", paddingVertical: SPACING.md },
  cancelText: { color: COLORS.textMuted },
});
