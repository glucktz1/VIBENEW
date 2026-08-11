import { Share, Platform } from "react-native";

const APP_BASE = (process.env.EXPO_PUBLIC_APP_BASE as string) || "https://vibe.app";

export type ShareTarget = {
  type: "song" | "album" | "playlist";
  id: string;
  title: string;
  subtitle?: string;
};

export async function shareItem(target: ShareTarget): Promise<"shared" | "copied" | "none"> {
  const url = `${APP_BASE}/${target.type}/${target.id}`;
  const message = `Sikiliza "${target.title}"${target.subtitle ? ` - ${target.subtitle}` : ""} kwenye Vibe 🎵`;
  const full = `${message}\n${url}`;
  try {
    if (Platform.OS === "web") {
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.share) {
        await nav.share({ title: target.title, text: message, url });
        return "shared";
      }
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(full);
        return "copied";
      }
      return "none";
    }
    await Share.share({ title: target.title, message: full });
    return "shared";
  } catch {
    return "none";
  }
}
