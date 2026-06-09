"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import api from "@/lib/api";
import type { LoginForm, User } from "@/types/auth";

interface AuthResponse {
  success: boolean;
  data: User;
  message?: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthReady: boolean;
  login: (credentials: LoginForm) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USER_STORAGE_KEY = "liquidLedgerUser";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const storedUser = window.localStorage.getItem(USER_STORAGE_KEY);

    if (storedUser) {
      try {
        return JSON.parse(storedUser) as User;
      } catch {
        window.localStorage.removeItem(USER_STORAGE_KEY);
      }
    }

    return null;
  });
  const isAuthReady = true;

  const setUser = useCallback((nextUser: User | null) => {
    setUserState(nextUser);

    if (nextUser) {
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
      return;
    }

    window.localStorage.removeItem(USER_STORAGE_KEY);
  }, []);

  const login = useCallback(async (credentials: LoginForm) => {
    const response = await api.post<AuthResponse>("/auth/login", credentials);
    const authenticatedUser = response.data.data;

    setUser(authenticatedUser);
    return authenticatedUser;
  }, [setUser]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
    }
  }, [setUser]);

  const value = useMemo(
    () => ({
      user,
      isAuthReady,
      login,
      logout,
      setUser,
    }),
    [user, isAuthReady, login, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
