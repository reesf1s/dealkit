"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CreditCard,
  Download,
  FileJson,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";

import type { AuditEventDto } from "@/lib/audit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  crmRequest,
  useWorkspace,
} from "@/components/sme/workspace/use-workspace";
import {
  ScreenHeader,
  WorkspaceError,
  WorkspaceLoading,
  surface,
} from "@/components/sme/workspace/workspace-ui";
import { shortDate } from "@/components/sme/workspace/workspace-format";

function auditLabel(type: string) {
  return type
    .replace(/^crm\./, "")
    .replaceAll("_", " ")
    .replaceAll(".", " ");
}

function metadataSummary(metadata: Record<string, unknown>) {
  return (
    [metadata.companyName, metadata.title, metadata.channel, metadata.stage]
      .filter((value) => typeof value === "string" && value)
      .join(" · ") || "Workspace event"
  );
}

export default function WorkspaceSettings() {
  const { workspace, loading, error, refresh } = useWorkspace();
  const [events, setEvents] = useState<AuditEventDto[]>([]);
  const [filter, setFilter] = useState<
    "all" | "data" | "automation" | "billing"
  >("all");

  useEffect(() => {
    let active = true;
    crmRequest<{ events: AuditEventDto[] }>("/api/crm/audit")
      .then((payload) => {
        if (active) setEvents(payload.events);
      })
      .catch(() => {
        if (active) setEvents([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      events.filter((event) => {
        if (filter === "all") return true;
        if (filter === "data")
          return ["lead", "task", "activity", "message"].some((term) =>
            event.type.includes(term),
          );
        if (filter === "automation")
          return event.type.includes("automation") || event.type.includes("ai");
        return event.type.includes("plan") || event.type.includes("billing");
      }),
    [events, filter],
  );

  if (loading) return <WorkspaceLoading />;
  if (error || !workspace)
    return (
      <WorkspaceError
        message={error ?? "Unable to load settings"}
        onRetry={() => void refresh()}
      />
    );

  const settings = [
    {
      href: "/channels",
      label: "Channels",
      detail: `${workspace.channels.filter((channel) => channel.connected).length}/${workspace.channels.length} connected`,
      icon: PlugZap,
    },
    {
      href: "/automations",
      label: "Automations",
      detail: "Follow-up and risk workflows",
      icon: Bot,
    },
    {
      href: "/import",
      label: "Import data",
      detail: "Bring in a spreadsheet",
      icon: Upload,
    },
    {
      href: "/settings/billing",
      label: "Billing",
      detail: "Plan and invoices",
      icon: CreditCard,
    },
  ];

  return (
    <div className="grid gap-5">
      <ScreenHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage the few controls that affect your CRM. Operational reporting stays in Reports."
        action={
          <div className="flex gap-2">
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-white/10 bg-white/[0.03] text-zinc-300"
            >
              <a href="/api/crm/export?format=csv">
                <Download className="size-4" />
                Export
              </a>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-violet-500 text-white hover:bg-violet-400"
            >
              <Link href="/settings/billing">
                <CreditCard className="size-4" />
                Billing
              </Link>
            </Button>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2">
        {settings.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                surface,
                "flex items-center gap-4 p-4 transition hover:border-violet-400/20 hover:bg-violet-400/[0.03]",
              )}
            >
              <span className="grid size-10 place-items-center rounded-lg bg-violet-400/10 text-violet-300">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="font-medium text-white">{item.label}</p>
                <p className="mt-1 text-xs text-zinc-500">{item.detail}</p>
              </div>
            </Link>
          );
        })}
      </section>

      <details className={cn(surface, "group p-4")}>
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-zinc-200">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-300" />
            Data and security
          </span>
          <span className="text-xs font-normal text-zinc-600">
            Workspace-scoped access
          </span>
        </summary>
        <div className="mt-4 grid gap-3 border-t border-white/[0.07] pt-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-zinc-600">CRM records</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {workspace.leads.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-600">Audit events</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {events.length}
            </p>
          </div>
          <div className="flex items-end gap-2">
            <Button
              asChild
              size="sm"
              variant="outline"
              className="border-white/10 bg-white/[0.03] text-zinc-300"
            >
              <a href="/api/crm/export?format=json">
                <FileJson className="size-4" />
                Export JSON
              </a>
            </Button>
          </div>
        </div>
      </details>

      <Card className={cn(surface, "gap-0 py-0")}>
        <CardHeader className="flex flex-row items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <CardTitle className="text-base">Audit log</CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              Recent changes made inside this workspace.
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() =>
              void crmRequest<{ events: AuditEventDto[] }>(
                "/api/crm/audit",
              ).then((payload) => setEvents(payload.events))
            }
            aria-label="Refresh audit"
          >
            <RefreshCw className="size-4" />
          </Button>
        </CardHeader>
        <div className="flex gap-1 border-b border-white/[0.07] px-4 py-2">
          {(["all", "data", "automation", "billing"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setFilter(value)}
              className={cn(
                "h-7 px-3 capitalize text-zinc-500",
                filter === value && "bg-white/[0.07] text-white",
              )}
            >
              {value}
            </Button>
          ))}
        </div>
        <CardContent className="divide-y divide-white/[0.06] p-2">
          {filtered.slice(0, 12).map((event) => (
            <div
              key={event.id}
              className="grid gap-2 rounded-lg px-3 py-3 sm:grid-cols-[160px_minmax(0,1fr)_100px] sm:items-center"
            >
              <Badge
                variant="outline"
                className="w-fit border-white/10 bg-white/[0.03] capitalize text-zinc-300"
              >
                {auditLabel(event.type)}
              </Badge>
              <p className="truncate text-sm text-zinc-300">
                {metadataSummary(event.metadata)}
              </p>
              <p className="text-xs text-zinc-600">
                {shortDate(event.createdAt)}
              </p>
            </div>
          ))}
        </CardContent>
        {!filtered.length ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            No audit events in this view.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
