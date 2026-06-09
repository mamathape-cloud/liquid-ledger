"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import type { User } from "@/types/auth";
import Header from "./Header";
import Sidebar from "./Sidebar";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

interface UserResponse {
  success: boolean;
  data: User;
  message?: string;
}

function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-ui-row-alt p-4 sm:p-6 lg:p-8">
      <section className="mx-auto max-w-6xl animate-pulse rounded-2xl bg-white p-6 shadow-sm">
        <div className="h-8 w-60 rounded bg-ui-border" />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 rounded-xl bg-ui-row-alt" />
          ))}
        </div>
      </section>
    </main>
  );
}

export default function AppLayout({ children, title }: AppLayoutProps) {
  const router = useRouter();
  const { isAuthReady, setUser } = useAuth();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    let isMounted = true;

    async function verifySession() {
      setError("");
      setIsCheckingSession(true);

      try {
        const response = await api.get<UserResponse>("/auth/me");
        const authenticatedUser = response.data.data;

        if (!isMounted) {
          return;
        }

        setUser(authenticatedUser);

        if (authenticatedUser.mustChangePassword) {
          router.replace("/change-password");
          return;
        }
      } catch (sessionError) {
        if (!isMounted) {
          return;
        }

        setUser(null);

        if (axios.isAxiosError(sessionError) && sessionError.response?.status === 401) {
          router.replace("/login");
          return;
        }

        setError("We could not verify your session. Please try again.");
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    }

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [isAuthReady, router, setUser]);

  if (!isAuthReady || isCheckingSession) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ui-row-alt px-4">
        <section className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
          <h1 className="text-2xl font-extrabold text-ui-text-primary">
            Session Check Failed
          </h1>
          <p className="mt-3 text-sm font-medium text-ui-text-muted">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-brand-red px-5 py-3 font-semibold text-white transition hover:bg-brand-red/90"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-ui-row-alt">
      <Sidebar
        isMobileOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="min-h-screen pl-20 lg:pl-64">
        <Header title={title} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
