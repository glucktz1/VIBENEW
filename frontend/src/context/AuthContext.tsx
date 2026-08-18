import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform, AppState } from "react-native";
import * as Device from "expo-device";
import { storage } from "@/src/utils/storage";
import { authApi, billingApi, TOKEN_KEY } from "@/src/services/api";

type User = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
  is_premium: boolean;
  subscription?: any;
  liked_songs?: string[];
} | null;

type AuthCtx = {
  user: User;
  loading: boolean;
  isGuest: boolean;
  isAdmin: boolean;
  isPremium: boolean;
  billingEnabled: boolean;
  premiumForAll: boolean;
  effectivePremium: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshBilling: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [billingEnabled, setBillingEnabled] = useState(true);
  const [premiumForAll, setPremiumForAll] = useState(false);

  const refreshBilling = useCallback(async () => {
    try {
      const b = await billingApi.status();
      setBillingEnabled(b.billing_enabled !== false);
      setPremiumForAll(!!b.premium_for_all);
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    try {
      const token = await storage.secureGet<string>(TOKEN_KEY, "");
      if (!token) {
        setUser(null);
        return;
      }
      const me = await authApi.me();
      setUser(me);
    } catch {
      await storage.secureRemove(TOKEN_KEY);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await Promise.all([refresh(), refreshBilling()]);
      setLoading(false);
    })();
  }, [refresh, refreshBilling]);

  // Re-check billing whenever the app returns to the foreground so admin toggles reflect quickly.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshBilling();
    });
    return () => sub.remove();
  }, [refreshBilling]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    await storage.secureSet(TOKEN_KEY, res.access_token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const device = {
      platform: Platform.OS,
      device_manufacturer: Device.manufacturer || Device.brand || "",
      device_model: Device.modelName || Device.deviceName || "",
      os_version: Device.osVersion || "",
    };
    const res = await authApi.register(email, password, name, device);
    await storage.secureSet(TOKEN_KEY, res.access_token);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  }, []);

  const isPremium = !!user && user.is_premium;
  const effectivePremium = isPremium || !billingEnabled || premiumForAll;

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        isGuest: !user,
        isAdmin: !!user && ["admin", "moderator", "content_manager"].includes(user.role),
        isPremium,
        billingEnabled,
        premiumForAll,
        effectivePremium,
        login,
        register,
        logout,
        refresh,
        refreshBilling,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
