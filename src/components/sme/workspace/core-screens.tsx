"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  Check,
  Clock3,
  Search,
  Send,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CrmLeadDto, CrmWorkspacePayload } from "@/lib/sme-crm";
import type { predictDeals } from "@/lib/deal-intelligence";
import { crmRequest } from "@/components/sme/workspace/use-workspace";
import {
  DealAvatar,
  Metric,
  MetricsBar,
  PredictionBadge,
  ScreenHeader,
  surface,
} from "@/components/sme/workspace/workspace-ui";
import {
  findLeadForRecord,
  messagesForLead,
  money,
  shortDate,
  totalValue,
} from "@/components/sme/workspace/workspace-format";

type WorkspaceIntelligence = ReturnType<typeof predictDeals>;

export type ScreenProps = {
  workspace: CrmWorkspacePayload;
  intelligence: WorkspaceIntelligence;
  onSelectLead: (leadId: string) => void;
  refresh: () => Promise<void>;
};

function ActionRow({
  lead,
  intelligence,
  onSelect,
}: {
  lead: CrmLeadDto;
  intelligence: WorkspaceIntelligence;
  onSelect: () => void;
}) {
  const prediction = intelligence.predictions[lead.id];
  return (
    <button
      type="button"
      onClick={onSelect}
      className="grid w-full gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-white/[0.04] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
    >
      <DealAvatar lead={lead} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">
            {prediction.nextAction.title}
          </p>
          <PredictionBadge prediction={prediction} />
        </div>
        <p className="mt-1 truncate text-xs text-zinc-500">
          {lead.companyName} · {prediction.nextAction.reason}
        </p>
      </div>
      <div className="flex items-center gap-3 text-right">
        <span className="text-sm font-medium text-zinc-300">
          {money(Number(lead.valueAmount ?? 0))}
        </span>
        <ArrowUpRight className="size-4 text-zinc-600" />
      </div>
    </button>
  );
}

export function HomeScreen({
  workspace,
  intelligence,
  onSelectLead,
}: ScreenProps) {
  const [now] = useState(() => Date.now());
  const openLeads = workspace.leads.filter(
    (lead) => lead.status !== "won" && lead.status !== "lost",
  );
  const total = totalValue(openLeads);
  const weighted = openLeads.reduce(
    (sum, lead) =>
      sum +
      (Number(lead.valueAmount ?? 0) *
        intelligence.predictions[lead.id].probability) /
        100,
    0,
  );
  const dueTasks = workspace.tasks.filter(
    (task) => task.dueAt && new Date(task.dueAt).getTime() <= now + 86_400_000,
  ).length;

  return (
    <div className="grid gap-5">
      <ScreenHeader
        eyebrow="Your day"
        title="What needs attention"
        description="Halvex ranks the few actions most likely to move revenue. Work down the list, then you are done."
      />
      <MetricsBar>
        <Metric
          label="Predicted revenue"
          value={money(Math.round(weighted))}
          detail={`${openLeads.length} open deals`}
        />
        <Metric
          label="Needs attention"
          value={`${intelligence.queue.filter((item) => item.prediction.risk === "high").length}`}
          detail="Ranked by risk and value"
        />
        <Metric
          label="Due today"
          value={`${dueTasks}`}
          detail="Tasks to clear"
        />
      </MetricsBar>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className={cn(surface, "gap-0 py-0")}>
          <CardHeader className="border-b border-white/[0.07] px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Recommended actions</CardTitle>
                <p className="mt-1 text-xs text-zinc-500">
                  Predictive scoring combines deal stage, freshness, activity
                  and your own outcomes.
                </p>
              </div>
              <Sparkles className="size-4 text-violet-300" />
            </div>
          </CardHeader>
          <CardContent className="divide-y divide-white/[0.06] p-2">
            {intelligence.queue.slice(0, 5).map((item) => (
              <ActionRow
                key={item.lead.id}
                lead={item.lead}
                intelligence={intelligence}
                onSelect={() => onSelectLead(item.lead.id)}
              />
            ))}
          </CardContent>
        </Card>

        <Card className={cn(surface, "gap-0 py-0")}>
          <CardHeader className="border-b border-white/[0.07] px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-violet-500 text-white">
                <Bot className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base">How Halvex helps</CardTitle>
                <p className="mt-1 text-xs text-zinc-500">
                  Intelligence inside the CRM, not another dashboard.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 text-sm">
            {[
              [
                "1",
                "Predict",
                "A workspace-trained model ranks win likelihood and risk.",
              ],
              [
                "2",
                "Explain",
                "An LLM reads the evidence and explains the next move.",
              ],
              [
                "3",
                "Act",
                "Create the task, draft the reply, or update the deal in place.",
              ],
            ].map((item) => (
              <div key={item[0]} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-violet-400/10 text-xs font-semibold text-violet-300">
                  {item[0]}
                </span>
                <div>
                  <p className="font-medium text-zinc-200">{item[1]}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {item[2]}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <div className="flex items-center justify-between border-t border-white/[0.07] pt-4 text-xs text-zinc-600">
        <span>{money(total)} total open pipeline</span>
        <span>
          {intelligence.model.trained
            ? `Model trained on ${intelligence.model.samples} workspace outcomes`
            : "Model uses a prior until six closed outcomes are available"}
        </span>
      </div>
    </div>
  );
}

export function DealsScreen({
  workspace,
  intelligence,
  onSelectLead,
}: ScreenProps) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"open" | "risk" | "all">("open");
  const rows = workspace.leads.filter((lead) => {
    const matchesQuery =
      `${lead.companyName} ${lead.primaryPersonName} ${lead.owner}`
        .toLowerCase()
        .includes(query.toLowerCase());
    const matchesScope =
      scope === "all" ||
      (scope === "risk"
        ? intelligence.predictions[lead.id].risk === "high"
        : lead.status !== "won" && lead.status !== "lost");
    return matchesQuery && matchesScope;
  });

  return (
    <div className="grid gap-5">
      <ScreenHeader
        eyebrow="Pipeline"
        title="Deals"
        description="Scan every opportunity, open the evidence, and take the next action without changing screens."
      />
      <Card className={cn(surface, "gap-0 py-0")}>
        <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search company, buyer, or owner"
              className="h-9 border-white/10 bg-black/20 pl-9 text-white"
            />
          </div>
          <div className="flex gap-1 rounded-lg border border-white/[0.07] bg-black/20 p-1">
            {(["open", "risk", "all"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setScope(value)}
                className={cn(
                  "h-7 px-3 capitalize text-zinc-500",
                  scope === value && "bg-white/[0.08] text-white",
                )}
              >
                {value}
              </Button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-white/[0.07] text-[11px] uppercase tracking-[0.1em] text-zinc-600">
              <tr>
                <th className="px-5 py-3 font-medium">Deal</th>
                <th className="px-3 py-3 font-medium">Stage</th>
                <th className="px-3 py-3 font-medium">Prediction</th>
                <th className="px-3 py-3 font-medium">Value</th>
                <th className="px-3 py-3 font-medium">Next action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((lead) => {
                const prediction = intelligence.predictions[lead.id];
                return (
                  <tr
                    key={lead.id}
                    className="cursor-pointer transition hover:bg-white/[0.03]"
                    onClick={() => onSelectLead(lead.id)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <DealAvatar lead={lead} size="sm" />
                        <div>
                          <p className="font-medium text-white">
                            {lead.companyName}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {lead.primaryPersonName} · {lead.owner}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-zinc-300">
                      {lead.stageName ?? lead.stage}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-32 items-center gap-2">
                        <Progress
                          value={prediction.probability}
                          className="h-1.5"
                        />
                        <span className="text-xs text-zinc-400">
                          {prediction.probability}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-medium text-zinc-200">
                      {money(Number(lead.valueAmount ?? 0))}
                    </td>
                    <td className="max-w-xs px-3 py-3">
                      <p className="truncate text-zinc-300">
                        {prediction.nextAction.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-zinc-600">
                        {prediction.nextAction.reason}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            No deals match this view.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

export function InboxScreen({ workspace, onSelectLead, refresh }: ScreenProps) {
  const conversations = workspace.leads
    .map((lead) => ({ lead, messages: messagesForLead(workspace, lead.id) }))
    .filter((item) => item.messages.length)
    .sort(
      (a, b) =>
        new Date(b.messages.at(-1)?.sentAt ?? 0).getTime() -
        new Date(a.messages.at(-1)?.sentAt ?? 0).getTime(),
    );
  const [selectedId, setSelectedId] = useState(conversations[0]?.lead.id ?? "");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const selected =
    conversations.find((item) => item.lead.id === selectedId) ??
    conversations[0];

  async function draft() {
    if (!selected) return;
    setBusy("draft");
    try {
      const result = await crmRequest<{ draft: string }>("/api/ai/draft", {
        method: "POST",
        body: JSON.stringify({
          leadId: selected.lead.id,
          channel: selected.lead.channel,
          instruction: selected.lead.nextStep,
        }),
      });
      setReply(result.draft);
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!selected || !reply.trim()) return;
    setBusy("send");
    try {
      await crmRequest("/api/crm/messages", {
        method: "POST",
        body: JSON.stringify({
          leadId: selected.lead.id,
          channel: selected.lead.channel,
          from: "rep",
          text: reply.trim(),
        }),
      });
      setReply("");
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5">
      <ScreenHeader
        eyebrow="Conversations"
        title="Inbox"
        description="One queue for buyer messages. Reply, create work, or inspect the deal from the same place."
      />
      <section
        className={cn(
          surface,
          "grid min-h-[620px] overflow-hidden lg:grid-cols-[330px_minmax(0,1fr)]",
        )}
      >
        <aside className="border-b border-white/[0.07] lg:border-b-0 lg:border-r">
          <div className="border-b border-white/[0.07] px-4 py-3 text-xs font-medium text-zinc-500">
            {conversations.length} conversations
          </div>
          <div className="divide-y divide-white/[0.06]">
            {conversations.map((item) => {
              const last = item.messages.at(-1);
              const waiting = last?.from === "customer";
              return (
                <button
                  key={item.lead.id}
                  type="button"
                  onClick={() => setSelectedId(item.lead.id)}
                  className={cn(
                    "w-full p-4 text-left transition hover:bg-white/[0.03]",
                    selected?.lead.id === item.lead.id &&
                      "bg-violet-400/[0.08]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <DealAvatar lead={item.lead} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-white">
                          {item.lead.companyName}
                        </p>
                        <span className="text-[11px] text-zinc-600">
                          {shortDate(last?.sentAt)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {last?.text}
                      </p>
                      {waiting ? (
                        <Badge
                          variant="outline"
                          className="mt-2 border-violet-400/20 bg-violet-400/10 text-violet-200"
                        >
                          reply needed
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
        <div className="flex min-w-0 flex-col">
          {selected ? (
            <>
              <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
                <div>
                  <p className="font-semibold text-white">
                    {selected.lead.companyName}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {selected.lead.primaryPersonName} ·{" "}
                    {selected.lead.stageName ?? selected.lead.stage}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectLead(selected.lead.id)}
                  className="border-white/10 bg-white/[0.03] text-zinc-300"
                >
                  Open deal
                </Button>
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {selected.messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[82%] rounded-xl px-4 py-3 text-sm leading-6",
                      message.from === "customer"
                        ? "bg-white/[0.05] text-zinc-200"
                        : "ml-auto bg-violet-500/15 text-violet-50",
                    )}
                  >
                    <p>{message.text}</p>
                    <p className="mt-1 text-[10px] text-zinc-600">
                      {message.from === "customer"
                        ? selected.lead.primaryPersonName
                        : "You"}{" "}
                      · {shortDate(message.sentAt)}
                    </p>
                  </div>
                ))}
              </div>
              <footer className="grid gap-3 border-t border-white/[0.07] p-4">
                <Textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Write a concise next-step reply..."
                  className="min-h-24 border-white/10 bg-black/20 text-white"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void draft()}
                    disabled={busy !== null}
                    className="border-white/10 bg-white/[0.03] text-zinc-200"
                  >
                    <Sparkles className="size-4" />
                    Draft with AI
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void send()}
                    disabled={busy !== null || !reply.trim()}
                    className="bg-violet-500 text-white hover:bg-violet-400"
                  >
                    <Send className="size-4" />
                    Send
                  </Button>
                </div>
              </footer>
            </>
          ) : (
            <p className="m-auto text-sm text-zinc-500">
              No conversations yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export function TasksScreen({ workspace, onSelectLead, refresh }: ScreenProps) {
  const [now] = useState(() => Date.now());
  const [scope, setScope] = useState<"today" | "all">("today");
  const rows = workspace.tasks
    .filter(
      (task) =>
        scope === "all" ||
        !task.dueAt ||
        new Date(task.dueAt).getTime() <= now + 86_400_000,
    )
    .sort(
      (a, b) =>
        new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime(),
    );
  const [busy, setBusy] = useState<string | null>(null);

  async function complete(taskId: string) {
    setBusy(taskId);
    try {
      await crmRequest(`/api/crm/tasks/${taskId}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5">
      <ScreenHeader
        eyebrow="Execution"
        title="Tasks"
        description="A short, revenue-linked list. Complete the work and the queue gets out of your way."
        action={
          <div className="flex gap-1 rounded-lg border border-white/[0.07] bg-black/20 p-1">
            {(["today", "all"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setScope(value)}
                className={cn(
                  "h-7 px-3 capitalize text-zinc-500",
                  scope === value && "bg-white/[0.08] text-white",
                )}
              >
                {value}
              </Button>
            ))}
          </div>
        }
      />
      <Card className={cn(surface, "gap-0 py-0")}>
        <CardContent className="divide-y divide-white/[0.06] p-2">
          {rows.map((task) => {
            const lead = findLeadForRecord(workspace, task);
            return (
              <div
                key={task.id}
                className="grid gap-3 rounded-lg px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              >
                <button
                  type="button"
                  onClick={() => void complete(task.id)}
                  disabled={busy === task.id}
                  className="grid size-8 place-items-center rounded-full border border-white/10 text-zinc-600 transition hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-300"
                  aria-label={`Complete ${task.title}`}
                >
                  <Check className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => lead && onSelectLead(lead.id)}
                  className="min-w-0 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {task.title}
                    </p>
                    {task.priority === "high" ? (
                      <Badge
                        variant="outline"
                        className="border-red-400/20 bg-red-400/10 text-red-200"
                      >
                        high
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {task.companyName ?? "No deal"} · {task.description}
                  </p>
                </button>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Clock3 className="size-3.5" />
                  {shortDate(task.dueAt)}
                </div>
              </div>
            );
          })}
        </CardContent>
        {!rows.length ? (
          <p className="p-10 text-center text-sm text-zinc-500">
            You are clear. No tasks in this view.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

export function AccountsScreen({
  workspace,
  intelligence,
  onSelectLead,
}: ScreenProps) {
  const accounts = useMemo(
    () =>
      [...workspace.leads].sort(
        (a, b) => Number(b.valueAmount ?? 0) - Number(a.valueAmount ?? 0),
      ),
    [workspace.leads],
  );
  return (
    <div className="grid gap-5">
      <ScreenHeader
        eyebrow="Relationships"
        title="Accounts"
        description="Every company, buyer, open value and next move—without a separate company database to maintain."
      />
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((lead) => (
          <button
            key={lead.id}
            type="button"
            onClick={() => onSelectLead(lead.id)}
            className={cn(
              surface,
              "p-4 text-left transition hover:border-violet-400/20 hover:bg-violet-400/[0.03]",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <DealAvatar lead={lead} />
                <div>
                  <p className="font-semibold text-white">{lead.companyName}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {lead.primaryPersonName}
                  </p>
                </div>
              </div>
              <PredictionBadge prediction={intelligence.predictions[lead.id]} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-zinc-600">Open value</p>
                <p className="mt-1 font-medium text-zinc-200">
                  {money(Number(lead.valueAmount ?? 0))}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-600">Owner</p>
                <p className="mt-1 truncate font-medium text-zinc-200">
                  {lead.owner}
                </p>
              </div>
            </div>
            <p className="mt-4 truncate border-t border-white/[0.07] pt-3 text-xs text-zinc-500">
              {intelligence.predictions[lead.id].nextAction.title}
            </p>
          </button>
        ))}
      </section>
    </div>
  );
}
