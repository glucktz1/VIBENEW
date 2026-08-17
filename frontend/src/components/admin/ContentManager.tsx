import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image,
  TextInput, Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { adminApi } from "@/src/services/api";
import { adminArtistApi } from "@/src/services/artistApi";
import { C, SP, COUNTRIES, MONETIZATION, DEFAULT_TAGS } from "./adminTheme";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string;

const MON_BADGE: Record<string, { c: string; l: string }> = {
  free: { c: C.violet, l: "free" },
  standard: { c: C.emerald, l: "standard" },
  premium: { c: C.amber, l: "premium" },
};

const emptyForm = {
  album_id: "", title: "", category_id: "", countries: ["Global"], thumbnail: "",
  release_date: "", monetization_type: "free", artist_name: "", status: "active",
  tags: [] as string[], description: "",
};

export default function ContentManager({ onToast }: { onToast: (m: string) => void }) {
  const [albums, setAlbums] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [monFilter, setMonFilter] = useState("all");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tagsFor, setTagsFor] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [songsByAlbum, setSongsByAlbum] = useState<Record<string, any[]>>({});
  const [songModal, setSongModal] = useState<any>(null); // { album, mode: 'single'|'multi'|'bulk' }
  const [songForm, setSongForm] = useState<any>({ title: "", audio_url: "", source: "cdn", fileName: "" });
  const [bulkText, setBulkText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [singleProgress, setSingleProgress] = useState(0);
  const [uploadQueue, setUploadQueue] = useState<any[]>([]); // [{ name, progress, status, audio_url }]
  const [songEdit, setSongEdit] = useState<any>(null); // { album_id, song_id, title, status }

  const toggleExpand = async (a: any) => {
    setMenuFor(null);
    if (expandedId === a.album_id) { setExpandedId(null); return; }
    setExpandedId(a.album_id);
    if (!songsByAlbum[a.album_id]) {
      const rows = await adminApi.albumSongs(a.album_id).catch(() => []);
      setSongsByAlbum((m) => ({ ...m, [a.album_id]: rows }));
    }
  };
  const refreshSongs = async (albumId: string) => {
    const rows = await adminApi.albumSongs(albumId).catch(() => []);
    setSongsByAlbum((m) => ({ ...m, [albumId]: rows }));
  };
  const pickAndUpload = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    setUploading(true); setSingleProgress(0);
    try {
      const up = await adminApi.uploadAudio(asset.uri, asset.name || "audio.mp3", asset.mimeType || "audio/mpeg", (p) => setSingleProgress(p));
      setSongForm((f: any) => ({ ...f, audio_url: `${BASE_URL}${up.media_url}`, source: "upload", fileName: asset.name, title: f.title || (asset.name || "").replace(/\.[^.]+$/, "") }));
      onToast("Uploaded — will encode to HLS");
    } catch (e: any) { onToast(e.message); } finally { setUploading(false); }
  };
  const pickAndUploadMulti = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true, multiple: true });
    if (res.canceled || !res.assets?.length) return;
    const assets = res.assets;
    setUploadQueue(assets.map((a) => ({ name: a.name || "audio.mp3", progress: 0, status: "uploading", audio_url: "" })));
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      try {
        const up = await adminApi.uploadAudio(a.uri, a.name || `audio${i}.mp3`, a.mimeType || "audio/mpeg", (p) => {
          setUploadQueue((q) => q.map((it, idx) => (idx === i ? { ...it, progress: p } : it)));
        });
        setUploadQueue((q) => q.map((it, idx) => (idx === i ? { ...it, progress: 1, status: "done", audio_url: `${BASE_URL}${up.media_url}` } : it)));
      } catch {
        setUploadQueue((q) => q.map((it, idx) => (idx === i ? { ...it, status: "error" } : it)));
      }
    }
  };
  const closeSongModal = () => { setSongModal(null); setSongForm({ title: "", audio_url: "", source: "cdn", fileName: "" }); setBulkText(""); setUploadQueue([]); setSingleProgress(0); };
  const saveSong = async () => {
    if (!songModal) return;
    setSaving(true);
    try {
      if (songModal.mode === "bulk") {
        const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
        const songs = lines.map((l) => { const [title, url] = l.split("|").map((x) => x.trim()); return { title: title || "Untitled", audio_url: url || "", source: "cdn" }; }).filter((s) => s.audio_url);
        if (!songs.length) { onToast("Add lines like: Title | https://cdn/url.mp3"); setSaving(false); return; }
        await adminApi.addAlbumSongsBulk(songModal.album.album_id, songs);
        onToast(`${songs.length} songs added`);
      } else if (songModal.mode === "multi") {
        const done = uploadQueue.filter((it) => it.status === "done" && it.audio_url);
        if (!done.length) { onToast("Upload at least one file first"); setSaving(false); return; }
        const songs = done.map((it) => ({ title: it.name.replace(/\.[^.]+$/, ""), audio_url: it.audio_url, source: "upload" }));
        await adminApi.addAlbumSongsBulk(songModal.album.album_id, songs);
        onToast(`${songs.length} songs added`);
      } else {
        if (!songForm.title.trim() || !songForm.audio_url) { onToast("Title & audio required"); setSaving(false); return; }
        await adminApi.addAlbumSong(songModal.album.album_id, { title: songForm.title.trim(), audio_url: songForm.audio_url, source: songForm.source });
        onToast("Song added");
      }
      const albumId = songModal.album.album_id;
      closeSongModal();
      await refreshSongs(albumId); await load();
    } catch (e: any) { onToast(e.message); } finally { setSaving(false); }
  };
  const delSong = async (albumId: string, songId: string) => {
    try { await adminApi.deleteSong(songId); await refreshSongs(albumId); await load(); onToast("Song removed"); } catch (e: any) { onToast(e.message); }
  };
  const toggleSongStatus = async (albumId: string, s: any) => {
    const next = (s.status || "active") === "inactive" ? "active" : "inactive";
    try { await adminApi.songStatus(s.song_id, next); await refreshSongs(albumId); onToast(next === "active" ? "Song activated" : "Song deactivated"); }
    catch (e: any) { onToast(e.message); }
  };
  const saveSongEdit = async () => {
    if (!songEdit) return;
    if (!songEdit.title.trim()) { onToast("Song name required"); return; }
    setSaving(true);
    try {
      await adminApi.updateSong(songEdit.song_id, { title: songEdit.title.trim(), status: songEdit.status });
      const albumId = songEdit.album_id;
      setSongEdit(null);
      await refreshSongs(albumId); onToast("Song updated");
    } catch (e: any) { onToast(e.message); } finally { setSaving(false); }
  };

  const load = useCallback(async () => {
    const [al, ca, ar] = await Promise.all([
      adminApi.albums().catch(() => []),
      adminApi.categories().catch(() => []),
      adminArtistApi.list().catch(() => []),
    ]);
    setAlbums(al); setCategories(ca); setArtists(ar); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ ...emptyForm }); setEditing(false); setShowForm(true); };
  const openEdit = (a: any) => {
    setForm({
      album_id: a.album_id, title: a.title || "", category_id: a.category_id || "",
      countries: a.countries?.length ? a.countries : ["Global"], thumbnail: a.thumbnail || "",
      release_date: a.release_date || "", monetization_type: a.monetization_type || "free",
      artist_name: a.artist_name || "", status: a.status || "active", tags: a.tags || [],
      description: a.description || "",
    });
    setEditing(true); setMenuFor(null); setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim()) { onToast("Album name required"); return; }
    if (!form.artist_name.trim()) { onToast("Artist required"); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(), artist_name: form.artist_name.trim(), category_id: form.category_id || null,
        countries: form.countries, thumbnail: form.thumbnail || "https://picsum.photos/seed/vibe/400",
        release_date: form.release_date, monetization_type: form.monetization_type,
        status: form.status, tags: form.tags, description: form.description,
      };
      if (editing) { await adminApi.updateAlbum(form.album_id, payload); onToast("Album updated"); }
      else { await adminApi.createAlbum(payload); onToast("Album created"); }
      setShowForm(false); await load();
    } catch (e: any) { onToast(e.message); } finally { setSaving(false); }
  };

  const toggleStatus = async (a: any) => {
    setMenuFor(null);
    const next = a.status === "inactive" ? "active" : "inactive";
    try { await adminApi.albumStatus(a.album_id, next); onToast(next === "active" ? "Activated" : "Deactivated"); await load(); }
    catch (e: any) { onToast(e.message); }
  };
  const remove = async (a: any) => {
    setMenuFor(null);
    try { await adminApi.deleteAlbum(a.album_id); onToast("Album deleted"); await load(); }
    catch (e: any) { onToast(e.message); }
  };

  const saveTags = async () => {
    try { await adminApi.updateAlbum(tagsFor.album_id, { tags: tagsFor.tags }); onToast("Tags updated"); setTagsFor(null); await load(); }
    catch (e: any) { onToast(e.message); }
  };

  const filtered = albums.filter((a) => {
    if (search && !(`${a.title} ${a.artist_name}`.toLowerCase().includes(search.toLowerCase()))) return false;
    if (catFilter !== "all" && a.category_id !== catFilter) return false;
    if (monFilter !== "all" && (a.monetization_type || "free") !== monFilter) return false;
    return true;
  });

  if (loading) return <ActivityIndicator color={C.violet} style={{ marginTop: SP.xl }} />;

  return (
    <View>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Albums & Songs</Text>
          <Text style={styles.pageSub}>Create albums, upload songs, manage your music library</Text>
        </View>
        <Pressable testID="content-create-album" style={styles.createBtn} onPress={openCreate}>
          <Ionicons name="add" size={18} color="#fff" /><Text style={styles.createText}>Create Album</Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={C.muted} />
        <TextInput testID="content-search" style={styles.searchInput} value={search} onChangeText={setSearch} placeholder="Search albums..." placeholderTextColor={C.muted} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SP.xs }}>
        <FilterChip label="All Categories" active={catFilter === "all"} onPress={() => setCatFilter("all")} />
        {categories.map((c) => <FilterChip key={c.category_id} label={c.name} active={catFilter === c.category_id} onPress={() => setCatFilter(c.category_id)} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SP.sm }}>
        {["all", "free", "standard", "premium"].map((m) => <FilterChip key={m} label={m === "all" ? "All Types" : m} active={monFilter === m} onPress={() => setMonFilter(m)} />)}
      </ScrollView>

      <Text style={styles.count}>Albums ({filtered.length})</Text>
      {filtered.map((a) => {
        const mb = MON_BADGE[a.monetization_type || "free"];
        const expanded = expandedId === a.album_id;
        const songs = songsByAlbum[a.album_id] || [];
        return (
          <View key={a.album_id} style={[styles.rowWrap, a.status === "inactive" && { opacity: 0.6 }]}>
          <View style={styles.row}>
            <Pressable onPress={() => toggleExpand(a)} hitSlop={6}><Ionicons name={expanded ? "chevron-down" : "chevron-forward"} size={18} color={C.muted} /></Pressable>
            <Image source={{ uri: a.thumbnail || "https://picsum.photos/seed/vibe/200" }} style={styles.thumb} />
            <Pressable style={{ flex: 1, marginLeft: SP.sm }} onPress={() => toggleExpand(a)}>
              <Text style={styles.rowTitle} numberOfLines={1}>{a.title}</Text>
              <Text style={styles.rowArtist} numberOfLines={1}>{a.artist_name || "Unknown Artist"} · {a.songs_count || 0} songs</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: mb.c + "22" }]}><Text style={[styles.badgeText, { color: mb.c }]}>{mb.l}</Text></View>
                {a.category_name ? <View style={[styles.badge, { backgroundColor: C.blue + "22" }]}><Text style={[styles.badgeText, { color: C.blue }]}>{a.category_name}</Text></View> : null}
                {(a.tags || []).slice(0, 2).map((t: string) => <View key={t} style={[styles.badge, { backgroundColor: C.pink + "22" }]}><Text style={[styles.badgeText, { color: C.pink }]}>{t}</Text></View>)}
              </View>
            </Pressable>
            <Pressable testID={`album-menu-${a.album_id}`} hitSlop={10} onPress={() => setMenuFor(menuFor === a.album_id ? null : a.album_id)}>
              <Ionicons name="ellipsis-vertical" size={20} color={C.sub} />
            </Pressable>
            {menuFor === a.album_id ? (
              <View style={styles.menu}>
                <MenuItem icon="add-circle-outline" label="Add Song" onPress={() => { setMenuFor(null); setSongModal({ album: a, mode: "single" }); }} tid={`album-addsong-${a.album_id}`} />
                <MenuItem icon="albums-outline" label="Bulk Add" onPress={() => { setMenuFor(null); setSongModal({ album: a, mode: "bulk" }); }} tid={`album-bulk-${a.album_id}`} />
                <MenuItem icon="create-outline" label="Edit" onPress={() => openEdit(a)} tid={`album-edit-${a.album_id}`} />
                <MenuItem icon="pricetag-outline" label="Manage Tags" onPress={() => { setMenuFor(null); setTagsFor({ album_id: a.album_id, tags: a.tags || [] }); }} tid={`album-tags-${a.album_id}`} />
                <MenuItem icon="eye-off-outline" label={a.status === "inactive" ? "Activate" : "Deactivate"} onPress={() => toggleStatus(a)} tid={`album-toggle-${a.album_id}`} />
                <MenuItem icon="trash-outline" label="Delete" danger onPress={() => remove(a)} tid={`album-delete-${a.album_id}`} />
              </View>
            ) : null}
          </View>
          {expanded ? (
            <View style={styles.songsBox}>
              {songs.length === 0 ? <Text style={styles.emptySmall}>No songs yet. Use the ⋮ menu to add.</Text> : null}
              {songs.map((s: any, i: number) => {
                const inactive = (s.status || "active") === "inactive";
                return (
                <View key={s.song_id} style={[styles.songRow, inactive && { opacity: 0.5 }]}>
                  <Text style={styles.songNum}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.songTitle} numberOfLines={1}>{s.title}</Text>
                    <View style={styles.hlsRow}>
                      <View style={[styles.hlsBadge, { backgroundColor: (s.hls_status === "ready" ? C.emerald : C.amber) + "22" }]}>
                        <Ionicons name={s.hls_status === "ready" ? "checkmark-circle" : "sync"} size={10} color={s.hls_status === "ready" ? C.emerald : C.amber} />
                        <Text style={[styles.hlsText, { color: s.hls_status === "ready" ? C.emerald : C.amber }]}>HLS {s.hls_status || "ready"}</Text>
                      </View>
                      <View style={[styles.hlsBadge, { backgroundColor: (inactive ? C.muted : C.emerald) + "22" }]}>
                        <Text style={[styles.hlsText, { color: inactive ? C.muted : C.emerald }]}>{inactive ? "hidden" : "active"}</Text>
                      </View>
                      <Text style={styles.srcText}>{s.encoding_source === "upload" ? "uploaded" : "CDN"}</Text>
                    </View>
                  </View>
                  <Pressable testID={`song-edit-${s.song_id}`} hitSlop={8} onPress={() => setSongEdit({ album_id: a.album_id, song_id: s.song_id, title: s.title || "", status: s.status || "active" })}><Ionicons name="create-outline" size={16} color={C.sub} /></Pressable>
                  <Pressable testID={`song-toggle-${s.song_id}`} hitSlop={8} onPress={() => toggleSongStatus(a.album_id, s)}><Ionicons name={inactive ? "eye-outline" : "eye-off-outline"} size={16} color={C.amber} /></Pressable>
                  <Pressable testID={`song-del-${s.song_id}`} hitSlop={8} onPress={() => delSong(a.album_id, s.song_id)}><Ionicons name="trash-outline" size={16} color={C.red} /></Pressable>
                </View>
                );
              })}
              <View style={styles.songActions}>
                <Pressable testID={`addsong-${a.album_id}`} style={styles.songBtn} onPress={() => setSongModal({ album: a, mode: "single" })}><Ionicons name="add" size={16} color="#fff" /><Text style={styles.songBtnText}>Add Song</Text></Pressable>
                <Pressable testID={`bulksong-${a.album_id}`} style={[styles.songBtn, { backgroundColor: C.blue }]} onPress={() => setSongModal({ album: a, mode: "bulk" })}><Ionicons name="albums" size={15} color="#fff" /><Text style={styles.songBtnText}>Bulk Add</Text></Pressable>
              </View>
            </View>
          ) : null}
          </View>
        );
      })}
      {filtered.length === 0 ? <Text style={styles.empty}>No albums match your filters.</Text> : null}

      {/* Add song modal (single / multi upload / bulk cdn) */}
      <Modal transparent visible={!!songModal} animationType="slide" onRequestClose={closeSongModal}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Add Songs</Text>
              <Pressable testID="song-modal-close" onPress={closeSongModal} hitSlop={10}><Ionicons name="close" size={22} color={C.text} /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.modeRow}>
                <Pressable testID="song-mode-single" style={[styles.modeBtn, songModal?.mode === "single" && styles.modeOn]} onPress={() => setSongModal((m: any) => ({ ...m, mode: "single" }))}><Text style={[styles.modeText, songModal?.mode === "single" && { color: "#fff" }]}>Single</Text></Pressable>
                <Pressable testID="song-mode-multi" style={[styles.modeBtn, songModal?.mode === "multi" && styles.modeOn]} onPress={() => setSongModal((m: any) => ({ ...m, mode: "multi" }))}><Text style={[styles.modeText, songModal?.mode === "multi" && { color: "#fff" }]}>Upload Files</Text></Pressable>
                <Pressable testID="song-mode-bulk" style={[styles.modeBtn, songModal?.mode === "bulk" && styles.modeOn]} onPress={() => setSongModal((m: any) => ({ ...m, mode: "bulk" }))}><Text style={[styles.modeText, songModal?.mode === "bulk" && { color: "#fff" }]}>Bulk CDN</Text></Pressable>
              </View>

              {songModal?.mode === "bulk" ? (
                <>
                  <Label>Songs (one per line: Title | CDN audio URL)</Label>
                  <TextInput testID="song-bulk" style={[styles.input, { height: 140, textAlignVertical: "top", paddingTop: 10 }]} value={bulkText} onChangeText={setBulkText} placeholder={"Track 1 | https://cdn/1.mp3\nTrack 2 | https://cdn/2.mp3"} placeholderTextColor={C.muted} multiline autoCapitalize="none" />
                </>
              ) : songModal?.mode === "multi" ? (
                <>
                  <Label>Upload one or more audio files</Label>
                  <Pressable testID="song-upload-multi" style={styles.pickBtn} onPress={pickAndUploadMulti}>
                    <Ionicons name="cloud-upload" size={20} color={C.violet} />
                    <Text style={styles.pickText} numberOfLines={1}>Choose audio files (.mp3) — select multiple</Text>
                  </Pressable>
                  {uploadQueue.map((it, idx) => (
                    <View key={idx} style={styles.qItem}>
                      <View style={styles.qHead}>
                        <Ionicons name={it.status === "done" ? "checkmark-circle" : it.status === "error" ? "alert-circle" : "musical-note"} size={14} color={it.status === "done" ? C.emerald : it.status === "error" ? C.red : C.violet} />
                        <Text style={styles.qName} numberOfLines={1}>{it.name}</Text>
                        <Text style={styles.qPct}>{it.status === "error" ? "failed" : `${Math.round(it.progress * 100)}%`}</Text>
                      </View>
                      <ProgressBar value={it.progress} error={it.status === "error"} />
                    </View>
                  ))}
                  {uploadQueue.length ? <Text style={styles.hlsNote}>{`ℹ️ ${uploadQueue.filter((it) => it.status === "done").length}/${uploadQueue.length} uploaded. Tap "Add Songs" to save them to this album.`}</Text> : null}
                </>
              ) : (
                <>
                  <Label>Song Title *</Label>
                  <TextInput testID="song-title" style={styles.input} value={songForm.title} onChangeText={(v: string) => setSongForm({ ...songForm, title: v })} placeholder="Song title" placeholderTextColor={C.muted} />
                  <Label>Audio Source *</Label>
                  <Pressable testID="song-upload" style={styles.pickBtn} onPress={pickAndUpload} disabled={uploading}>
                    {uploading ? <ActivityIndicator color={C.violet} /> : (<><Ionicons name={songForm.source === "upload" ? "checkmark-circle" : "cloud-upload"} size={20} color={songForm.source === "upload" ? C.emerald : C.violet} /><Text style={styles.pickText} numberOfLines={1}>{songForm.fileName || "Upload from computer (.mp3)"}</Text></>)}
                  </Pressable>
                  {uploading ? (
                    <View style={{ marginTop: SP.sm }}>
                      <ProgressBar value={singleProgress} />
                      <Text style={styles.qPctCenter}>{Math.round(singleProgress * 100)}%</Text>
                    </View>
                  ) : null}
                  <Text style={styles.orText}>— or paste a CDN URL (already uploaded) —</Text>
                  <TextInput testID="song-cdn" style={styles.input} value={songForm.source === "cdn" ? songForm.audio_url : ""} onChangeText={(v: string) => setSongForm({ ...songForm, audio_url: v, source: "cdn", fileName: "" })} placeholder="https://cdn.bunny.net/.../song.mp3 or .m3u8" placeholderTextColor={C.muted} autoCapitalize="none" />
                  <Text style={styles.hlsNote}>ℹ️ Uploaded files are queued for HLS encoding automatically. HLS/.m3u8 CDN links are used directly.</Text>
                </>
              )}
              <Pressable testID="song-save" style={styles.saveBtn} onPress={saveSong} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Add Songs</Text>}</Pressable>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit song modal */}
      <Modal transparent visible={!!songEdit} animationType="fade" onRequestClose={() => setSongEdit(null)}>
        <View style={styles.centerOverlay}>
          <View style={styles.tagCard} testID="song-edit-modal">
            <Text style={styles.sheetTitle}>Edit Song</Text>
            <Label>Song Name *</Label>
            <TextInput testID="song-edit-name" style={styles.input} value={songEdit?.title || ""} onChangeText={(v) => setSongEdit((f: any) => ({ ...f, title: v }))} placeholder="Song name" placeholderTextColor={C.muted} />
            <Label>Status</Label>
            <View style={styles.wrapRow}>
              {["active", "inactive"].map((s) => (
                <Pressable key={s} testID={`song-status-${s}`} style={[styles.pick, songEdit?.status === s && styles.pickActive]} onPress={() => setSongEdit((f: any) => ({ ...f, status: s }))}>
                  <Text style={[styles.pickText, songEdit?.status === s && { color: "#fff" }]}>{s === "active" ? "Active — Visible" : "Inactive — Hidden"}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable testID="song-edit-save" style={styles.saveBtn} onPress={saveSongEdit} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}</Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setSongEdit(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>

      {/* Create / Edit Album form */}
      <Modal transparent visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{editing ? "Edit Album" : "Create New Album"}</Text>
              <Pressable testID="album-form-close" onPress={() => setShowForm(false)} hitSlop={10}><Ionicons name="close" size={22} color={C.text} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Label>Album Name *</Label>
              <TextInput testID="album-name" style={styles.input} value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} placeholder="Enter album name" placeholderTextColor={C.muted} />

              <Label>Category *</Label>
              <View style={styles.wrapRow}>
                {categories.map((c) => (
                  <Pressable key={c.category_id} testID={`cat-pick-${c.category_id}`} style={[styles.pick, form.category_id === c.category_id && styles.pickActive]} onPress={() => setForm({ ...form, category_id: c.category_id })}>
                    <Text style={[styles.pickText, form.category_id === c.category_id && { color: "#fff" }]}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>

              <Label>Available Countries (Geo Content)</Label>
              <View style={styles.wrapRow}>
                {COUNTRIES.map((co) => {
                  const on = form.countries.includes(co);
                  return (
                    <Pressable key={co} testID={`country-${co}`} style={[styles.check, on && styles.checkOn]} onPress={() => {
                      let next = form.countries.slice();
                      if (co === "Global") next = on ? [] : ["Global"];
                      else {
                        next = next.filter((x: string) => x !== "Global");
                        if (on) next = next.filter((x: string) => x !== co);
                        else next.push(co);
                      }
                      setForm({ ...form, countries: next.length ? next : ["Global"] });
                    }}>
                      <Ionicons name={on ? "checkbox" : "square-outline"} size={16} color={on ? C.violet : C.muted} />
                      <Text style={styles.checkText}>{co}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Label>Album Thumbnail (image URL)</Label>
              <TextInput testID="album-thumbnail" style={styles.input} value={form.thumbnail} onChangeText={(v) => setForm({ ...form, thumbnail: v })} placeholder="https://... (or leave blank)" placeholderTextColor={C.muted} autoCapitalize="none" />

              <Label>Release Date</Label>
              <TextInput testID="album-release" style={styles.input} value={form.release_date} onChangeText={(v) => setForm({ ...form, release_date: v })} placeholder="YYYY-MM-DD" placeholderTextColor={C.muted} />

              <Label>Monetization Type *</Label>
              <View style={styles.wrapRow}>
                {MONETIZATION.map((m) => (
                  <Pressable key={m.key} testID={`mon-${m.key}`} style={[styles.pick, form.monetization_type === m.key && styles.pickActive]} onPress={() => setForm({ ...form, monetization_type: m.key })}>
                    <Text style={[styles.pickText, form.monetization_type === m.key && { color: "#fff" }]}>{m.key}</Text>
                  </Pressable>
                ))}
              </View>

              <Label>Artist / Singer *</Label>
              <TextInput testID="album-artist" style={styles.input} value={form.artist_name} onChangeText={(v) => setForm({ ...form, artist_name: v })} placeholder="Type or pick artist below" placeholderTextColor={C.muted} />
              {artists.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {artists.map((ar) => (
                    <Pressable key={ar.artist_id} style={styles.pick} onPress={() => setForm({ ...form, artist_name: ar.name })}>
                      <Text style={styles.pickText}>{ar.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              <Label>Status</Label>
              <View style={styles.wrapRow}>
                {["active", "inactive"].map((s) => (
                  <Pressable key={s} testID={`status-${s}`} style={[styles.pick, form.status === s && styles.pickActive]} onPress={() => setForm({ ...form, status: s })}>
                    <Text style={[styles.pickText, form.status === s && { color: "#fff" }]}>{s === "active" ? "Active — Visible" : "Inactive — Hidden"}</Text>
                  </Pressable>
                ))}
              </View>

              <Label>Album Tags</Label>
              <View style={styles.wrapRow}>
                {DEFAULT_TAGS.map((t) => {
                  const on = form.tags.includes(t);
                  return (
                    <Pressable key={t} testID={`tag-${t}`} style={[styles.tagChip, on && styles.tagOn]} onPress={() => setForm({ ...form, tags: on ? form.tags.filter((x: string) => x !== t) : [...form.tags, t] })}>
                      <Text style={[styles.tagText, on && { color: "#fff" }]}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Label>Description (optional)</Label>
              <TextInput testID="album-desc" style={[styles.input, { height: 76, textAlignVertical: "top", paddingTop: 10 }]} value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Brief description of the album..." placeholderTextColor={C.muted} multiline />

              <Pressable testID="album-form-save" style={styles.saveBtn} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{editing ? "Save Changes" : "Create Album"}</Text>}
              </Pressable>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Manage Tags quick modal */}
      <Modal transparent visible={!!tagsFor} animationType="fade" onRequestClose={() => setTagsFor(null)}>
        <View style={styles.centerOverlay}>
          <View style={styles.tagCard} testID="manage-tags-modal">
            <Text style={styles.sheetTitle}>Manage Tags</Text>
            <View style={styles.wrapRow}>
              {DEFAULT_TAGS.map((t) => {
                const on = tagsFor?.tags?.includes(t);
                return (
                  <Pressable key={t} testID={`mtag-${t}`} style={[styles.tagChip, on && styles.tagOn]} onPress={() => setTagsFor((f: any) => ({ ...f, tags: on ? f.tags.filter((x: string) => x !== t) : [...f.tags, t] }))}>
                    <Text style={[styles.tagText, on && { color: "#fff" }]}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable testID="manage-tags-save" style={styles.saveBtn} onPress={saveTags}><Text style={styles.saveText}>Save Tags</Text></Pressable>
            <Pressable style={styles.cancelBtn} onPress={() => setTagsFor(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const FilterChip = ({ label, active, onPress }: any) => (
  <Pressable style={[styles.fchip, active && styles.fchipOn]} onPress={onPress}>
    <Text style={[styles.fchipText, active && { color: "#fff" }]} numberOfLines={1}>{label}</Text>
  </Pressable>
);
const MenuItem = ({ icon, label, onPress, danger, tid }: any) => (
  <Pressable testID={tid} style={styles.menuItem} onPress={onPress}>
    <Ionicons name={icon} size={16} color={danger ? C.red : C.sub} />
    <Text style={[styles.menuText, danger && { color: C.red }]}>{label}</Text>
  </Pressable>
);
const Label = ({ children }: any) => <Text style={styles.label}>{children}</Text>;
const ProgressBar = ({ value, error }: { value: number; error?: boolean }) => (
  <View style={styles.progressTrack}>
    <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, value * 100))}%`, backgroundColor: error ? C.red : C.violet }]} />
  </View>
);

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: SP.md },
  pageTitle: { color: C.text, fontSize: 22, fontWeight: "800" },
  pageSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  createBtn: { flexDirection: "row", alignItems: "center", backgroundColor: C.violet, borderRadius: 9999, paddingHorizontal: SP.md, height: 40 },
  createText: { color: "#fff", fontWeight: "800", marginLeft: 4, fontSize: 13 },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 10, paddingHorizontal: SP.md, height: 46, borderWidth: 1, borderColor: C.border, marginBottom: SP.sm },
  searchInput: { flex: 1, color: C.text, marginLeft: SP.sm, fontSize: 14 },
  fchip: { paddingHorizontal: SP.md, height: 34, borderRadius: 9999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", marginRight: SP.sm },
  fchipOn: { backgroundColor: C.violet, borderColor: C.violet },
  fchipText: { color: C.sub, fontWeight: "700", fontSize: 12, textTransform: "capitalize" },
  count: { color: C.sub, fontSize: 12, fontWeight: "700", marginBottom: SP.sm },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: C.cardAlt, borderRadius: 12, padding: SP.sm, borderWidth: 1, borderColor: C.border },
  rowWrap: { marginBottom: SP.sm },
  songsBox: { backgroundColor: "rgba(24,24,27,0.4)", borderRadius: 10, borderWidth: 1, borderColor: C.border, borderTopWidth: 0, marginTop: -6, paddingTop: 12, padding: SP.sm },
  songRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(39,39,42,0.5)", gap: 10 },
  songNum: { color: C.muted, fontSize: 12, width: 18, textAlign: "center" },
  songTitle: { color: C.text, fontSize: 13, fontWeight: "600" },
  hlsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  hlsBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  hlsText: { fontSize: 9, fontWeight: "800" },
  srcText: { color: C.muted, fontSize: 10 },
  songActions: { flexDirection: "row", gap: SP.sm, marginTop: SP.sm },
  songBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: C.violet, borderRadius: 8, height: 40, gap: 4 },
  songBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  modeRow: { flexDirection: "row", gap: SP.sm, marginBottom: SP.sm },
  modeBtn: { flex: 1, height: 38, borderRadius: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  modeOn: { backgroundColor: C.violet, borderColor: C.violet },
  modeText: { color: C.sub, fontWeight: "700", fontSize: 13 },
  orText: { color: C.muted, fontSize: 11, textAlign: "center", marginVertical: SP.sm },
  pickBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.bg, borderRadius: 8, borderWidth: 1, borderColor: C.border, borderStyle: "dashed", paddingHorizontal: SP.md, minHeight: 46, paddingVertical: 10 },
  qItem: { marginTop: SP.sm },
  qHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  qName: { flex: 1, color: C.text, fontSize: 12, fontWeight: "600" },
  qPct: { color: C.sub, fontSize: 11, fontWeight: "700" },
  qPctCenter: { color: C.sub, fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 4 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: C.border, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  hlsNote: { color: C.muted, fontSize: 11, marginTop: SP.sm, lineHeight: 15 },
  thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: C.card },
  rowTitle: { color: C.text, fontSize: 14, fontWeight: "700" },
  rowArtist: { color: C.sub, fontSize: 12, marginTop: 1 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 9, fontWeight: "800" },
  menu: { position: "absolute", right: 30, top: 8, backgroundColor: "#1f1f23", borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingVertical: 4, width: 160, zIndex: 20, elevation: 8 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: SP.md, gap: 10 },
  menuText: { color: C.text, fontSize: 13, fontWeight: "600" },
  empty: { color: C.muted, textAlign: "center", paddingVertical: SP.xl },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: SP.lg, maxHeight: "92%" },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SP.sm },
  sheetTitle: { color: C.text, fontSize: 18, fontWeight: "800" },
  label: { color: C.sub, fontSize: 12, fontWeight: "700", marginTop: SP.md, marginBottom: 6 },
  input: { backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: SP.md, height: 46, color: C.text, borderWidth: 1, borderColor: C.border },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pick: { paddingHorizontal: 12, height: 34, borderRadius: 8, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", marginRight: 6, marginBottom: 6 },
  pickActive: { backgroundColor: C.violet, borderColor: C.violet },
  pickText: { color: C.sub, fontWeight: "700", fontSize: 12, textTransform: "capitalize" },
  check: { flexDirection: "row", alignItems: "center", width: "46%", paddingVertical: 6, gap: 6 },
  checkOn: {},
  checkText: { color: C.text, fontSize: 13 },
  tagChip: { paddingHorizontal: 12, height: 32, borderRadius: 9999, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  tagOn: { backgroundColor: C.pink, borderColor: C.pink },
  tagText: { color: C.sub, fontWeight: "700", fontSize: 12 },
  saveBtn: { backgroundColor: C.violet, borderRadius: 9999, height: 50, alignItems: "center", justifyContent: "center", marginTop: SP.lg },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  cancelBtn: { alignItems: "center", paddingVertical: SP.md },
  cancelText: { color: C.muted },
  centerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: SP.lg },
  tagCard: { width: "100%", maxWidth: 380, backgroundColor: C.card, borderRadius: 16, padding: SP.lg, borderWidth: 1, borderColor: C.border },
});
