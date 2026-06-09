"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type SVGProps, useState } from "react";
import { useAuth } from "@/context/AuthContext";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface NavItem {
  label: string;
  href: string;
  icon: IconComponent;
  isVisible: (permissions: string[]) => boolean;
}

interface SidebarProps {
  isMobileOpen: boolean;
  onClose: () => void;
}

function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M4 13h6V4H4v9Z" />
      <path d="M14 20h6V4h-6v16Z" />
      <path d="M4 20h6v-3H4v3Z" />
    </svg>
  );
}

function ExpensesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h3" />
    </svg>
  );
}

function EventsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M7 3v4" />
      <path d="M17 3v4" />
      <path d="M4 8h16" />
      <path d="M5 5h14v16H5V5Z" />
      <path d="M8 12h3" />
      <path d="M8 16h6" />
    </svg>
  );
}

function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M16 19c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4" />
      <path d="M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M21 19c0-1.9-1.3-3.5-3-3.9" />
      <path d="M16.5 3.5a3.5 3.5 0 0 1 0 7" />
    </svg>
  );
}

function RolesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M12 3 5 6v5c0 4.5 2.9 8.6 7 10 4.1-1.4 7-5.5 7-10V6l-7-3Z" />
      <path d="M9.5 12.5 11 14l3.5-4" />
    </svg>
  );
}

function ReportsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-5" />
      <path d="M12 16V8" />
      <path d="M16 16v-3" />
    </svg>
  );
}

function LogoutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M10 17 15 12l-5-5" />
      <path d="M15 12H3" />
      <path d="M21 4v16" />
    </svg>
  );
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: DashboardIcon,
    isVisible: () => true,
  },
  {
    label: "Expenses",
    href: "/expenses",
    icon: ExpensesIcon,
    isVisible: (permissions) =>
      permissions.includes("expenses.view_own") ||
      permissions.includes("expenses.view_all"),
  },
  {
    label: "Events",
    href: "/events",
    icon: EventsIcon,
    isVisible: (permissions) =>
      permissions.includes("expenses.view_all") ||
      permissions.includes("expenses.disburse"),
  },
  {
    label: "Users",
    href: "/users",
    icon: UsersIcon,
    isVisible: (permissions) => permissions.includes("users.manage"),
  },
  {
    label: "Roles",
    href: "/roles",
    icon: RolesIcon,
    isVisible: (permissions) => permissions.includes("roles.manage"),
  },
  {
    label: "Reports",
    href: "/reports",
    icon: ReportsIcon,
    isVisible: (permissions) => permissions.includes("reports.view"),
  },
];

export default function Sidebar({ isMobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const permissions = user?.permissions || [];
  const visibleNavItems = navItems.filter((item) => item.isVisible(permissions));

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logout();
      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      {isMobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 bg-brand-navy/40 lg:hidden"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-brand-navy text-white shadow-2xl transition-[width] duration-200 lg:w-64 ${
          isMobileOpen ? "w-64" : "w-20"
        }`}
      >
        <div
          className={`flex h-20 items-center border-b border-white/10 ${
            isMobileOpen ? "justify-start px-5" : "justify-center px-0"
          } lg:justify-start lg:px-6`}
        >
          <div className={`${isMobileOpen ? "block" : "hidden"} lg:block`}>
            <p className="text-xl font-extrabold tracking-tight text-brand-red">
              Liquid Ledger
            </p>
            <p className="mt-1 text-sm font-medium text-white/55">Liquid Stage</p>
          </div>
          <p
            className={`text-2xl font-extrabold text-brand-red ${
              isMobileOpen ? "hidden" : "block"
            } lg:hidden`}
          >
            LL
          </p>
        </div>

        <nav className="mt-6 flex-1 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 border-l-4 py-3 text-sm transition ${
                  isMobileOpen
                    ? "justify-start px-5"
                    : "justify-center px-0"
                } lg:justify-start lg:px-6 ${
                  isActive
                    ? "border-brand-red font-bold text-white"
                    : "border-transparent font-semibold text-white/55 hover:text-white"
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <span className={`${isMobileOpen ? "inline" : "hidden"} lg:inline`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3 lg:p-5">
          <div className={`mb-4 ${isMobileOpen ? "block" : "hidden"} lg:block`}>
            <p className="truncate text-sm font-bold text-white">
              {user?.name || "Liquid Ledger user"}
            </p>
            <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wide text-white/55">
              {user?.role?.name || "User"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-red px-3 py-2.5 text-sm font-bold text-white transition hover:bg-brand-red/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <LogoutIcon
              aria-hidden="true"
              className="h-5 w-5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <span className={`${isMobileOpen ? "inline" : "hidden"} lg:inline`}>
              {isLoggingOut ? "Logging Out..." : "Logout"}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
