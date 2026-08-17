import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import CampaignsManager from "./CampaignsManager";
import AdvertisingManager from "./AdvertisingManager";
import { C, SP } from "./adminTheme";

export default function MarketingHub({ onToast }: { onToast: (m: string) => void }) {
  const [tab, setTab] = useState<"campaigns" | "inapp">("campaigns");
  return (
    <View>
      <View style={styles.tabs}>
        {([["campaigns", "Campaigns"], ["inapp", "In-App Notification"]] as const).map(([k, l]) => (
          <Pressable key={k} testID={`mh-tab-${k}`} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && { color: "#fff" }]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      {tab === "campaigns" ? <CampaignsManager onToast={onToast} /> : <AdvertisingManager onToast={onToast} />}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: SP.sm, marginBottom: SP.md },
  tab: { paddingHorizontal: SP.md, height: 36, borderRadius: 9999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  tabOn: { backgroundColor: C.violet, borderColor: C.violet },
  tabText: { color: C.sub, fontWeight: "700", fontSize: 13 },
});
