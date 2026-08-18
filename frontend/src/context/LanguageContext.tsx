import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/services/api";
import { DEFAULT_TRANSLATIONS, DEFAULT_LANG, LANG_NAMES, sectionTitleKey } from "@/src/i18n/translations";

const LANG_KEY = "vibe_lang";

type Dict = Record<string, string>;

type LangCtx = {
  lang: string;
  setLang: (code: string) => void;
  t: (key: string, fallback?: string) => string;
  languages: { code: string; name: string }[];
  sectionTitle: (id: string, rawTitle: string) => string;
};

const Ctx = createContext<LangCtx>({} as LangCtx);
export const useLang = () => useContext(Ctx);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<string>(DEFAULT_LANG);
  const [remote, setRemote] = useState<Record<string, Dict>>({});

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(LANG_KEY, "");
      if (saved) setLangState(saved);
      try {
        const data = await api.get<any>("/translations");
        if (data && typeof data === "object") setRemote(data);
      } catch {}
    })();
  }, []);

  const setLang = useCallback((code: string) => {
    setLangState(code);
    storage.setItem(LANG_KEY, code);
  }, []);

  // merged dictionaries: built-in overlaid with admin-uploaded (remote)
  const merged = useCallback((code: string): Dict => {
    return { ...(DEFAULT_TRANSLATIONS[code] || {}), ...(remote[code] || {}) };
  }, [remote]);

  const t = useCallback((key: string, fallback?: string): string => {
    const cur = merged(lang);
    if (cur[key] != null) return cur[key];
    const base = merged(DEFAULT_LANG);
    if (base[key] != null) return base[key];
    const en = merged("en");
    if (en[key] != null) return en[key];
    return fallback != null ? fallback : key;
  }, [lang, merged]);

  const sectionTitle = useCallback((id: string, rawTitle: string): string => {
    if (id === "country_fav") {
      const country = (rawTitle || "").replace(/^Maarufu\s*/i, "").replace(/^Popular in\s*/i, "").trim();
      return `${t("home.popularIn")} ${country}`.trim();
    }
    const k = sectionTitleKey(id);
    return k ? t(k) : rawTitle;
  }, [t]);

  const languages = React.useMemo(() => {
    const codes = new Set<string>([...Object.keys(DEFAULT_TRANSLATIONS), ...Object.keys(remote)]);
    return Array.from(codes).map((code) => ({ code, name: LANG_NAMES[code] || code.toUpperCase() }));
  }, [remote]);

  return (
    <Ctx.Provider value={{ lang, setLang, t, languages, sectionTitle }}>
      {children}
    </Ctx.Provider>
  );
}
