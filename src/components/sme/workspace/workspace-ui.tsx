"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Save,
  Send,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CrmLeadDto } from "@/lib/sme-crm";
import type { DealPrediction } from "@/lib/deal-intelligence";
import { crmRequest } from "@/components/sme/workspace/use-workspace";
import {
  initials,
  money,
  shortDate,
} from "@/components/sme/workspace/workspace-format";

export const surface =
  "rounded-xl border border-white/[0.08] bg-[#111019]/90 shadow-sm";
export const inset = "rounded-lg border border-white/[0.07] bg-black/20";

export function ScreenHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 py-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-medium text-violet-300">{eyebrow}</p>
        <h1 className="mt-1.5 font-title text-2xl font-semibold tracking-tight text-white md:text-[28px]">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0 px-4 py-3 first:pl-0 last:pr-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-600">
        {label}
      </p>
      <p className="mt-1 font-title text-xl font-semibold text-white">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 truncate text-xs text-zinc-500">{detail}</p>
      ) : null}
    </div>
  );
}

export function MetricsBar({ children }: { children: ReactNode }) {
  return (
    <section
      className={cn(
        surface,
        "grid divide-y divide-white/[0.07] px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0",
      )}
    >
      {children}
    </section>
  );
}

export function DealAvatar({
  lead,
  size = "md",
}: {
  lead: CrmLeadDto;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-violet-400/10 font-semibold text-violet-200",
        size === "sm" ? "size-8 text-[11px]" : "size-10 text-xs",
      )}
    >
      {initials(lead.companyName)}
    </span>
  );
}

export function PredictionBadge({
  prediction,
}: {
  prediction?: DealPrediction;
}) {
  if (!prediction) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md font-medium",
        prediction.risk === "high"
          ? "border-red-400/20 bg-red-400/10 text-red-200"
          : prediction.risk === "medium"
            ? "border-amber-300/20 bg-amber-300/10 text-amber-200"
            : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
      )}
    >
      {prediction.probability}% predicted
    </Badge>
  );
}

export function WorkspaceLoading() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-[440px] rounded-xl" />
    </div>
  );
}

export function WorkspaceError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className={cn(surface, "max-w-xl")}>
      <CardContent className="p-6">
        <h1 className="text-lg font-semibold text-white">
          Workspace unavailable
        </h1>
        <p className="mt-2 text-sm text-zinc-400">{message}</p>
        <Button type="button" onClick={onRetry} className="mt-4">
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

type DealBrief = {
  summary: string;
  buyerIntent: "strong" | "mixed" | "weak" | "unknown";
  risks: string[];
  positiveSignals: string[];
  nextBestAction: { title: string; reason: string; suggestedMessage: string };
  probabilityAdjustment: number;
};

const stages = ["Discovery", "Evaluation", "Proposal", "Negotiation", "Commit"];

export function DealPanel({
  lead,
  prediction,
  open,
  onOpenChange,
  onMutated,
}: {
  lead?: CrmLeadDto;
  prediction?: DealPrediction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMutated: () => Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  const [reply, setReply] = useState("");
  const [brief, setBrief] = useState<DealBrief | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setNotes(lead?.notes ?? "");
    setReply("");
    setBrief(null);
    setNotice(null);
  }, [lead?.id, lead?.notes]);

  if (!lead) return null;

  async function analyse() {
    setBusy("analyse");
    setNotice(null);
    try {
      const result = await crmRequest<{ brief: DealBrief }>(
        "/api/ai/deal-brief",
        { method: "POST", body: JSON.stringify({ leadId: lead!.id }) },
      );
      setBrief(result.brief);
      setReply(result.brief.nextBestAction.suggestedMessage);
    } finally {
      setBusy(null);
    }
  }

  async function saveNotes() {
    setBusy("notes");
    try {
      await crmRequest(`/api/crm/leads/${lead!.id}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      });
      setNotice("Notes saved");
      await onMutated();
    } finally {
      setBusy(null);
    }
  }

  async function updateStage(stage: string) {
    setBusy("stage");
    try {
      const probability = Math.max(
        Number(lead!.probability ?? 0),
        {
          Discovery: 25,
          Evaluation: 45,
          Proposal: 60,
          Negotiation: 75,
          Commit: 90,
        }[stage] ?? 25,
      );
      await crmRequest(`/api/crm/leads/${lead!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stage, probability }),
      });
      setNotice(`Moved to ${stage}`);
      await onMutated();
    } finally {
      setBusy(null);
    }
  }

  async function createRecommendedTask() {
    const action = brief?.nextBestAction ?? prediction?.nextAction;
    if (!action) return;
    setBusy("task");
    try {
      await crmRequest("/api/crm/tasks", {
        method: "POST",
        body: JSON.stringify({
          leadId: lead!.id,
          title: action.title,
          description: action.reason,
          priority: prediction?.risk === "high" ? "high" : "medium",
          companyName: lead!.companyName,
          personName: lead!.primaryPersonName,
        }),
      });
      setNotice("Next action added to tasks");
      await onMutated();
    } finally {
      setBusy(null);
    }
  }

  async function draftReply() {
    setBusy("draft");
    try {
      const result = await crmRequest<{ draft: string }>("/api/ai/draft", {
        method: "POST",
        body: JSON.stringify({
          leadId: lead!.id,
          channel: lead!.channel,
          instruction: lead!.nextStep,
        }),
      });
      setReply(result.draft);
    } finally {
      setBusy(null);
    }
  }

  async function sendReply() {
    if (!reply.trim()) return;
    setBusy("send");
    try {
      await crmRequest("/api/crm/messages", {
        method: "POST",
        body: JSON.stringify({
          leadId: lead!.id,
          channel: lead!.channel,
          from: "rep",
          text: reply.trim(),
        }),
      });
      setReply("");
      setNotice("Reply sent");
      await onMutated();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-white/10 bg-[#0b0a12] p-0 text-zinc-100 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-white/[0.08] p-6">
          <div className="flex items-start gap-3 pr-8">
            <DealAvatar lead={lead} />
            <div className="min-w-0">
              <SheetTitle className="truncate text-xl text-white">
                {lead.companyName}
              </SheetTitle>
              <SheetDescription>
                {lead.primaryPersonName} · {lead.stageName ?? lead.stage} ·{" "}
                {money(Number(lead.valueAmount ?? 0))}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="grid gap-5 p-6">
          {notice ? (
            <p className="rounded-lg border border-emerald-400/15 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
              {notice}
            </p>
          ) : null}

          <section className={cn(surface, "p-4")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-violet-300">
                  Predictive score
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {prediction?.probability ?? lead.probability}%
                </p>
              </div>
              <PredictionBadge prediction={prediction} />
            </div>
            <div className="mt-4 grid gap-2">
              {(prediction?.signals ?? []).map((signal) => (
                <p key={signal} className="text-sm text-zinc-400">
                  • {signal}
                </p>
              ))}
            </div>
          </section>

          <section className={cn(surface, "p-4")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  AI deal brief
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Evidence-grounded analysis and one recommended action.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => void analyse()}
                disabled={busy !== null}
                className="bg-violet-500 text-white hover:bg-violet-400"
              >
                {busy === "analyse" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <BrainCircuit className="size-4" />
                )}
                Analyse
              </Button>
            </div>
            {brief ? (
              <div className="mt-4 grid gap-4">
                <p className="text-sm leading-6 text-zinc-300">
                  {brief.summary}
                </p>
                <div className={cn(inset, "p-3")}>
                  <p className="text-sm font-semibold text-white">
                    {brief.nextBestAction.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {brief.nextBestAction.reason}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-white/10 px-3 py-5 text-sm text-zinc-500">
                Run analysis when you need a fresh evidence-based
                recommendation.
              </div>
            )}
          </section>

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Move deal</h3>
              <span className="text-xs text-zinc-600">
                Current: {lead.stageName ?? lead.stage}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {stages.map((stage) => (
                <Button
                  key={stage}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    busy !== null || stage === (lead.stageName ?? lead.stage)
                  }
                  onClick={() => void updateStage(stage)}
                  className="border-white/10 bg-white/[0.03] text-zinc-300"
                >
                  {stage}
                </Button>
              ))}
            </div>
          </section>

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Next action</h3>
              <span className="text-xs text-zinc-600">
                Close {shortDate(lead.expectedCloseDate)}
              </span>
            </div>
            <div className={cn(inset, "p-3")}>
              <p className="text-sm text-zinc-200">
                {brief?.nextBestAction.title ??
                  prediction?.nextAction.title ??
                  lead.nextStep}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                {brief?.nextBestAction.reason ?? prediction?.nextAction.reason}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void createRecommendedTask()}
              disabled={busy !== null}
              className="w-fit border-white/10 bg-white/[0.04] text-zinc-100"
            >
              <CheckCircle2 className="size-4" />
              Add to tasks
            </Button>
          </section>

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Reply</h3>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void draftReply()}
                disabled={busy !== null}
                className="text-violet-300"
              >
                <Sparkles className="size-4" />
                Draft
              </Button>
            </div>
            <Textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Write or generate a concise follow-up..."
              className="min-h-28 border-white/10 bg-black/20 text-white"
            />
            <Button
              type="button"
              onClick={() => void sendReply()}
              disabled={busy !== null || !reply.trim()}
              className="w-fit bg-white text-black hover:bg-zinc-200"
            >
              <Send className="size-4" />
              Send reply
            </Button>
          </section>

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Notes</h3>
              <MessageSquareText className="size-4 text-zinc-600" />
            </div>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-32 border-white/10 bg-black/20 font-mono text-xs leading-6 text-zinc-200"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void saveNotes()}
              disabled={busy !== null}
              className="w-fit border-white/10 bg-white/[0.04] text-zinc-100"
            >
              <Save className="size-4" />
              Save notes
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
