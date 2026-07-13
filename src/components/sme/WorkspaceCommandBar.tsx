"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CrmLeadDto, CrmWorkspacePayload } from "@/lib/sme-crm";
import { useWorkspace } from "@/components/sme/workspace/use-workspace";

type SearchResult = {
  id: string;
  title: string;
  detail: string;
  href: "/deals" | "/inbox";
};

type DealForm = {
  companyName: string;
  primaryPersonName: string;
  valueAmount: string;
  nextStep: string;
  description: string;
};

const emptyForm: DealForm = {
  companyName: "",
  primaryPersonName: "",
  valueAmount: "",
  nextStep: "",
  description: "",
};

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }
  return payload as T;
}

function searchIndex(workspace: CrmWorkspacePayload | null): SearchResult[] {
  if (!workspace) return [];
  const deals = workspace.leads.map((lead) => ({
    id: `deal-${lead.id}`,
    title: lead.companyName ?? lead.title ?? "Untitled deal",
    detail: `${lead.primaryPersonName ?? "No buyer"} · ${lead.stageName ?? lead.stage ?? "No stage"}`,
    href: "/deals" as const,
  }));
  const conversations = Object.values(workspace.messages)
    .flat()
    .slice(-20)
    .map((message) => {
      const lead = workspace.leads.find((item) => item.id === message.leadId);
      return {
        id: `message-${message.id}`,
        title: lead?.companyName ?? "Conversation",
        detail: message.text,
        href: "/inbox" as const,
      };
    });
  return [...deals, ...conversations];
}

export default function WorkspaceCommandBar() {
  const { workspace } = useWorkspace();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return [];
    return searchIndex(workspace)
      .filter((item) =>
        `${item.title} ${item.detail}`.toLowerCase().includes(value),
      )
      .slice(0, 6);
  }, [query, workspace]);

  async function createDeal() {
    if (!form.companyName.trim()) {
      setMessage("Add a company name to create the deal.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const closeDate = new Date();
      closeDate.setDate(closeDate.getDate() + 14);
      await requestJson<{ lead: CrmLeadDto }>("/api/crm/leads", {
        method: "POST",
        body: JSON.stringify({
          title: form.companyName.trim(),
          companyName: form.companyName.trim(),
          primaryPersonName: form.primaryPersonName.trim(),
          valueAmount: Number(form.valueAmount || 0),
          nextStep: form.nextStep.trim(),
          description: form.description.trim(),
          owner: "Sales owner",
          stage: "Discovery",
          probability: 35,
          expectedCloseDate: closeDate.toISOString(),
          channel: "mail",
          risk: "new",
        }),
      });
      window.dispatchEvent(new Event("halvex:workspace-refresh"));
      setForm(emptyForm);
      setMessage("Deal created. Halvex will rank it as evidence arrives.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to create deal",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
        <Input
          aria-label="Search deals and conversations"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          placeholder="Search deals and conversations"
          className="h-9 rounded-md border-white/[0.08] bg-white/[0.035] pl-9 text-xs text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-400/40"
        />
        {focused && query.trim() ? (
          <div className="absolute right-0 top-11 z-50 w-full min-w-[300px] overflow-hidden rounded-lg border border-white/10 bg-[#0d111b] p-1 shadow-2xl">
            {results.length ? (
              results.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 transition hover:bg-white/[0.05]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-100">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {item.detail}
                    </span>
                  </span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-slate-600" />
                </Link>
              ))
            ) : (
              <p className="px-3 py-4 text-xs text-slate-500">
                No matching work.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <Button
        type="button"
        onClick={() => {
          setMessage(null);
          setOpen(true);
        }}
        className="h-9 rounded-md bg-violet-500 px-3 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(124,58,237,0.22)] hover:bg-violet-400"
      >
        <Plus className="size-4" />
        <span className="hidden sm:inline">New deal</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto border-white/10 bg-[#0b0f18] p-0 text-slate-100 sm:max-w-md">
          <SheetHeader className="border-b border-white/[0.07] px-6 py-5">
            <SheetTitle className="text-xl font-semibold text-white">
              New deal
            </SheetTitle>
            <SheetDescription className="text-sm text-slate-500">
              Capture the essentials. Halvex fills in the intelligence from
              activity and conversations.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-5 p-6">
            {message ? (
              <p className="rounded-md border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs text-slate-300">
                {message}
              </p>
            ) : null}
            <Label className="grid gap-2 text-xs font-medium text-slate-400">
              Company
              <Input
                autoFocus
                value={form.companyName}
                onChange={(event) =>
                  setForm({ ...form, companyName: event.target.value })
                }
                placeholder="Acme"
                className="border-white/10 bg-black/20 text-white"
              />
            </Label>
            <Label className="grid gap-2 text-xs font-medium text-slate-400">
              Primary buyer
              <Input
                value={form.primaryPersonName}
                onChange={(event) =>
                  setForm({ ...form, primaryPersonName: event.target.value })
                }
                placeholder="Name"
                className="border-white/10 bg-black/20 text-white"
              />
            </Label>
            <div className="grid gap-5 sm:grid-cols-2">
              <Label className="grid gap-2 text-xs font-medium text-slate-400">
                Value
                <Input
                  type="number"
                  value={form.valueAmount}
                  onChange={(event) =>
                    setForm({ ...form, valueAmount: event.target.value })
                  }
                  placeholder="12000"
                  className="border-white/10 bg-black/20 text-white"
                />
              </Label>
              <Label className="grid gap-2 text-xs font-medium text-slate-400">
                Next step
                <Input
                  value={form.nextStep}
                  onChange={(event) =>
                    setForm({ ...form, nextStep: event.target.value })
                  }
                  placeholder="Book technical review"
                  className="border-white/10 bg-black/20 text-white"
                />
              </Label>
            </div>
            <details className="rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-400">
                Add context
              </summary>
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="What are they buying and why now?"
                className="mt-3 min-h-24 w-full resize-none rounded-md border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:border-violet-400/50"
              />
            </details>
            <Button
              type="button"
              onClick={() => void createDeal()}
              disabled={busy}
              className="h-10 rounded-md bg-violet-500 font-semibold text-white hover:bg-violet-400"
            >
              {busy ? "Creating…" : "Create deal"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
