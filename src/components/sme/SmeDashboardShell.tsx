"use client";

import { UserButton } from "@clerk/nextjs";
import {
  BarChart3,
  ChevronDown,
  MessageSquare,
  PhoneCall,
  Settings,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import WorkspaceCommandBar from "@/components/sme/WorkspaceCommandBar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/home", label: "Today" },
  { href: "/deals", label: "Pipeline" },
  { href: "/inbox", label: "Conversations" },
  { href: "/call-review", label: "Calls" },
] as const;

function active(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SmeDashboardShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[#080b12] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#080b12]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-5 px-4 sm:px-6">
          <Link
            href="/home"
            aria-label="Halvex Today"
            className="flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <span className="grid size-8 place-items-center rounded-md bg-violet-500 text-xs font-bold text-white shadow-[0_8px_24px_rgba(124,58,237,0.24)]">
              H
            </span>
            <span className="hidden text-sm font-semibold tracking-tight text-white sm:block">
              Halvex
            </span>
          </Link>

          <nav
            className="hidden h-full items-center gap-1 md:flex"
            aria-label="Primary navigation"
          >
            {navigation.map((item) => {
              const selected = active(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-9 items-center rounded-md px-3 text-xs font-medium text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60",
                    selected && "bg-white/[0.055] text-white",
                  )}
                >
                  {item.label}
                  {selected ? (
                    <span className="absolute inset-x-3 -bottom-[14px] h-px bg-violet-400" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 md:max-w-[430px]">
            <WorkspaceCommandBar />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Workspace menu"
                  className="size-9 shrink-0 rounded-md text-slate-500 hover:bg-white/[0.05] hover:text-white"
                >
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-lg border-white/10 bg-[#0d111b] p-1 text-slate-200 shadow-2xl"
              >
                <DropdownMenuItem
                  asChild
                  className="rounded-md focus:bg-white/[0.06]"
                >
                  <Link href="/import">
                    <Upload className="size-4 text-slate-500" />
                    Import data
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="rounded-md focus:bg-white/[0.06]"
                >
                  <Link href="/settings">
                    <Settings className="size-4 text-slate-500" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/[0.07]" />
                <DropdownMenuItem
                  asChild
                  className="rounded-md focus:bg-white/[0.06]"
                >
                  <Link href="/deals">
                    <BarChart3 className="size-4 text-slate-500" />
                    Pipeline
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="grid size-9 shrink-0 place-items-center rounded-md border border-white/[0.08] bg-white/[0.035]">
              <UserButton />
            </div>
          </div>
        </div>
        <nav
          className="flex overflow-x-auto border-t border-white/[0.05] px-3 py-2 md:hidden"
          aria-label="Mobile navigation"
        >
          {navigation.map((item) => {
            const selected = active(pathname, item.href);
            const Icon =
              item.href === "/deals"
                ? BarChart3
                : item.href === "/inbox"
                  ? MessageSquare
                  : item.href === "/call-review"
                    ? PhoneCall
                    : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs text-slate-500",
                  selected && "bg-white/[0.06] text-white",
                )}
              >
                {Icon ? <Icon className="size-3.5" /> : null}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
