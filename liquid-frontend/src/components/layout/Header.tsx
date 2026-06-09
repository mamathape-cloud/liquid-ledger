"use client";

import { useAuth } from "@/context/AuthContext";

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-ui-border bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Open sidebar"
          onClick={onMenuClick}
          className="rounded-lg border border-ui-border p-2 text-ui-text-primary transition hover:border-brand-red hover:text-brand-red lg:hidden"
        >
          <MenuIcon />
        </button>

        <h1 className="text-2xl font-extrabold tracking-tight text-ui-text-primary sm:text-3xl">
          {title}
        </h1>
      </div>

      <div className="text-right">
        <p className="max-w-36 truncate text-sm font-bold text-ui-text-primary sm:max-w-none">
          {user?.name || "Liquid Ledger user"}
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ui-text-muted">
          {user?.role?.name || "User"}
        </p>
      </div>
    </header>
  );
}
