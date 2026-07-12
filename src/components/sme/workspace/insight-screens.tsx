"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarPlus, PlugZap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ChannelId } from "@/lib/sme-crm";
import { crmRequest } from "@/components/sme/workspace/use-workspace";
import type { ScreenProps } from "@/components/sme/workspace/core-screens";
import {
  DealAvatar,
  Metric,
  MetricsBar,
  PredictionBadge,
  ScreenHeader,
  inset,
  surface,
} from "@/components/sme/workspace/workspace-ui";
import {
  findLeadForRecord,
  money,
  shortDate,
  totalValue,
} from "@/components/sme/workspace/workspace-format";

export function ForecastScreen({
  workspace,
  intelligence,
  onSelectLead,
}: ScreenProps) {
  const open = workspace.leads.filter(
    (lead) => lead.status !== "won" && lead.status !== "lost",
  );
  const total = totalValue(open);
  const predicted = open.reduce(
    (sum, lead) =>
      sum +
      (Number(lead.valueAmount ?? 0) *
        intelligence.predictions[lead.id].probability) /
        100,
    0,
  );
  const commit = open.filter(
    (lead) => intelligence.predictions[lead.id].probability >= 75,
  );
  const stages = [
    ...open
      .reduce((map, lead) => {
        const stage = lead.stageName ?? lead.stage;
        const current = map.get(stage) ?? { stage, leads: [], value: 0 };
        current.leads.push(lead);
        current.value += Number(lead.valueAmount ?? 0);
        map.set(stage, current);
        return map;
      }, new Map<string, { stage: string; leads: typeof open; value: number }>())
      .values(),
  ];

  return (
    <div className="grid gap-5">
      <ScreenHeader
        eyebrow="Planning"
        title="Forecast"
        description="A prediction-led view of expected revenue, with every number traceable to a real deal."
      />
      <MetricsBar>
        <Metric
          label="Open pipeline"
          value={money(total)}
          detail={`${open.length} deals`}
        />
        <Metric
          label="Predicted revenue"
          value={money(Math.round(predicted))}
          detail={`${total ? Math.round((predicted / total) * 100) : 0}% of pipeline`}
        />
        <Metric
          label="Likely to close"
          value={money(totalValue(commit))}
          detail={`${commit.length} deals above 75%`}
        />
      </MetricsBar>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className={cn(surface, "gap-0 py-0")}>
          <CardHeader className="border-b border-white/[0.07] px-5 py-4">
            <CardTitle className="text-base">Forecast by deal</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-white/[0.06] p-2">
            {open
              .sort(
                (a, b) =>
                  intelligence.predictions[b.id].probability -
                  intelligence.predictions[a.id].probability,
              )
              .map((lead) => {
                const prediction = intelligence.predictions[lead.id];
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => onSelectLead(lead.id)}
                    className="grid w-full gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-white/[0.04] sm:grid-cols-[minmax(0,1fr)_180px_100px] sm:items-center"
                  >
                    <div className="flex items-center gap-3">
                      <DealAvatar lead={lead} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {lead.companyName}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {lead.stageName ?? lead.stage} · close{" "}
                          {shortDate(lead.expectedCloseDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={prediction.probability}
                        className="h-1.5"
                      />
                      <span className="w-10 text-xs text-zinc-400">
                        {prediction.probability}%
                      </span>
                    </div>
                    <p className="text-right text-sm font-medium text-zinc-200">
                      {money(
                        Math.round(
                          (Number(lead.valueAmount ?? 0) *
                            prediction.probability) /
                            100,
                        ),
                      )}
                    </p>
                  </button>
                );
              })}
          </CardContent>
        </Card>
        <Card className={cn(surface, "gap-0 py-0")}>
          <CardHeader className="border-b border-white/[0.07] px-5 py-4">
            <CardTitle className="text-base">Stage coverage</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-5">
            {stages.map((stage) => (
              <div key={stage.stage}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-300">{stage.stage}</span>
                  <span className="font-medium text-white">
                    {money(stage.value)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  {stage.leads.length} deal{stage.leads.length === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export function CoachScreen({ intelligence, onSelectLead }: ScreenProps) {
  return (
    <div className="grid gap-5">
      <ScreenHeader
        eyebrow="Deal intelligence"
        title="Recommended actions"
        description="Ranked work, clear reasoning, and actions inside every deal—without a separate analytics project."
      />
      <section className="grid gap-3">
        {intelligence.queue.map(({ lead, prediction }, index) => (
          <button
            key={lead.id}
            type="button"
            onClick={() => onSelectLead(lead.id)}
            className={cn(
              surface,
              "grid gap-4 p-4 text-left transition hover:border-violet-400/20 hover:bg-violet-400/[0.03] sm:grid-cols-[36px_minmax(0,1fr)_auto] sm:items-center",
            )}
          >
            <span className="grid size-8 place-items-center rounded-lg bg-violet-400/10 text-xs font-semibold text-violet-300">
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-white">
                  {prediction.nextAction.title}
                </p>
                <PredictionBadge prediction={prediction} />
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                {lead.companyName} · {prediction.nextAction.reason}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {prediction.signals.map((signal) => (
                  <span
                    key={signal}
                    className="rounded-md bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-500"
                  >
                    {signal}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-200">
                {money(Number(lead.valueAmount ?? 0))}
              </span>
              <ArrowUpRight className="size-4 text-zinc-600" />
            </div>
          </button>
        ))}
      </section>
    </div>
  );
}

export function ReportsScreen({ workspace, intelligence }: ScreenProps) {
  const open = workspace.leads.filter(
    (lead) => lead.status !== "won" && lead.status !== "lost",
  );
  const highRisk = open.filter(
    (lead) => intelligence.predictions[lead.id].risk === "high",
  );
  const noNextStep = open.filter((lead) => !lead.nextStep?.trim());
  const byStage = [
    ...open
      .reduce((map, lead) => {
        const stage = lead.stageName ?? lead.stage;
        const current = map.get(stage) ?? {
          stage,
          count: 0,
          value: 0,
          predicted: 0,
        };
        current.count += 1;
        current.value += Number(lead.valueAmount ?? 0);
        current.predicted +=
          (Number(lead.valueAmount ?? 0) *
            intelligence.predictions[lead.id].probability) /
          100;
        map.set(stage, current);
        return map;
      }, new Map<string, { stage: string; count: number; value: number; predicted: number }>())
      .values(),
  ];

  return (
    <div className="grid gap-5">
      <ScreenHeader
        eyebrow="Performance"
        title="Reports"
        description="Three useful answers: what is open, what is likely, and what needs fixing."
      />
      <MetricsBar>
        <Metric
          label="Pipeline"
          value={money(totalValue(open))}
          detail={`${open.length} active deals`}
        />
        <Metric
          label="High risk"
          value={money(totalValue(highRisk))}
          detail={`${highRisk.length} deals`}
        />
        <Metric
          label="Missing next step"
          value={`${noNextStep.length}`}
          detail="Deals without a clear action"
        />
      </MetricsBar>
      <Card className={cn(surface, "gap-0 py-0")}>
        <CardHeader className="border-b border-white/[0.07] px-5 py-4">
          <CardTitle className="text-base">Funnel quality</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-[1fr_80px_120px_120px] border-b border-white/[0.07] px-5 py-3 text-[11px] uppercase tracking-[0.1em] text-zinc-600">
            <span>Stage</span>
            <span>Deals</span>
            <span>Pipeline</span>
            <span>Predicted</span>
          </div>
          {byStage.map((stage) => (
            <div
              key={stage.stage}
              className="grid grid-cols-[1fr_80px_120px_120px] border-b border-white/[0.05] px-5 py-4 text-sm last:border-0"
            >
              <span className="text-white">{stage.stage}</span>
              <span className="text-zinc-400">{stage.count}</span>
              <span className="text-zinc-300">{money(stage.value)}</span>
              <span className="font-medium text-violet-200">
                {money(Math.round(stage.predicted))}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function TeamScreen({ workspace, intelligence }: ScreenProps) {
  const owners = useMemo(
    () =>
      [
        ...workspace.leads
          .reduce((map, lead) => {
            const owner = lead.owner || "Unassigned";
            const current = map.get(owner) ?? {
              owner,
              deals: 0,
              value: 0,
              predicted: 0,
              risk: 0,
              tasks: 0,
            };
            current.deals += 1;
            current.value += Number(lead.valueAmount ?? 0);
            current.predicted +=
              (Number(lead.valueAmount ?? 0) *
                intelligence.predictions[lead.id].probability) /
              100;
            current.risk +=
              intelligence.predictions[lead.id].risk === "high" ? 1 : 0;
            current.tasks += Number(lead.openTaskCount ?? 0);
            map.set(owner, current);
            return map;
          }, new Map<string, { owner: string; deals: number; value: number; predicted: number; risk: number; tasks: number }>())
          .values(),
      ].sort((a, b) => b.predicted - a.predicted),
    [intelligence.predictions, workspace.leads],
  );
  return (
    <div className="grid gap-5">
      <ScreenHeader
        eyebrow="Team"
        title="Owner view"
        description="See who owns revenue and where they need help. This is workload context, not surveillance."
      />
      <section className="grid gap-3 md:grid-cols-2">
        {owners.map((owner) => (
          <Card key={owner.owner} className={cn(surface, "gap-0 py-0")}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-violet-400/10 text-sm font-semibold text-violet-200">
                    {owner.owner
                      .split(/\s+/)
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <div>
                    <p className="font-semibold text-white">{owner.owner}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {owner.deals} deals · {owner.tasks} open tasks
                    </p>
                  </div>
                </div>
                {owner.risk ? (
                  <Badge
                    variant="outline"
                    className="border-red-400/20 bg-red-400/10 text-red-200"
                  >
                    {owner.risk} at risk
                  </Badge>
                ) : null}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className={cn(inset, "p-3")}>
                  <p className="text-xs text-zinc-600">Pipeline</p>
                  <p className="mt-1 font-medium text-white">
                    {money(owner.value)}
                  </p>
                </div>
                <div className={cn(inset, "p-3")}>
                  <p className="text-xs text-zinc-600">Predicted</p>
                  <p className="mt-1 font-medium text-violet-200">
                    {money(Math.round(owner.predicted))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

export function MeetingsScreen({
  workspace,
  onSelectLead,
  refresh,
}: ScreenProps) {
  const [leadId, setLeadId] = useState(workspace.leads[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const meetings = workspace.activities.filter((activity) =>
    ["meeting", "call", "call_signal", "intent"].some((term) =>
      `${activity.type} ${activity.title}`.toLowerCase().includes(term),
    ),
  );
  async function logMeeting() {
    if (!title.trim()) return;
    const lead = workspace.leads.find((candidate) => candidate.id === leadId);
    setBusy(true);
    try {
      await crmRequest("/api/crm/activities", {
        method: "POST",
        body: JSON.stringify({
          leadId,
          type: "meeting",
          title,
          body: notes,
          companyName: lead?.companyName,
          personName: lead?.primaryPersonName,
        }),
      });
      setTitle("");
      setNotes("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-5">
      <ScreenHeader
        eyebrow="Customer evidence"
        title="Meetings"
        description="Log the decision, objection, and next step. Halvex turns that evidence into deal intelligence."
      />
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className={cn(surface, "gap-0 py-0")}>
          <CardHeader className="border-b border-white/[0.07] px-5 py-4">
            <CardTitle className="text-base">Recent conversations</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-white/[0.06] p-2">
            {meetings.map((activity) => {
              const lead = findLeadForRecord(workspace, activity);
              return (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => lead && onSelectLead(lead.id)}
                  className="w-full rounded-lg px-3 py-3 text-left transition hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">
                      {activity.title}
                    </p>
                    <span className="text-xs text-zinc-600">
                      {shortDate(activity.occurredAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {activity.companyName}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-300">
                    {activity.body}
                  </p>
                </button>
              );
            })}
          </CardContent>
        </Card>
        <Card className={cn(surface, "h-fit gap-0 py-0")}>
          <CardHeader className="border-b border-white/[0.07] px-5 py-4">
            <CardTitle className="text-base">Log meeting</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-5">
            <select
              value={leadId}
              onChange={(event) => setLeadId(event.target.value)}
              className="h-9 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
            >
              {workspace.leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.companyName}
                </option>
              ))}
            </select>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Decision, objection, or outcome"
              className="border-white/10 bg-black/20 text-white"
            />
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What changed? What happens next?"
              className="min-h-32 border-white/10 bg-black/20 text-white"
            />
            <Button
              type="button"
              onClick={() => void logMeeting()}
              disabled={busy || !title.trim()}
              className="bg-violet-500 text-white hover:bg-violet-400"
            >
              <CalendarPlus className="size-4" />
              Log meeting
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export function ChannelsScreen({ workspace, refresh }: ScreenProps) {
  const [busy, setBusy] = useState<ChannelId | null>(null);
  async function toggle(provider: ChannelId, connected: boolean) {
    setBusy(provider);
    try {
      await crmRequest(`/api/crm/channels/${provider}`, {
        method: "PATCH",
        body: JSON.stringify({ connected }),
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="grid gap-5">
      <ScreenHeader
        eyebrow="Integrations"
        title="Channels"
        description="Connect only the sources that create useful sales evidence. Everything lands in one inbox."
      />
      <section className="grid gap-3 md:grid-cols-2">
        {workspace.channels.map((channel) => (
          <Card key={channel.id} className={cn(surface, "gap-0 py-0")}>
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-violet-400/10 text-violet-300">
                  <PlugZap className="size-4" />
                </span>
                <div>
                  <p className="font-medium text-white">{channel.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {channel.connected
                      ? "Sending activity to Halvex"
                      : "Not connected"}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy === channel.id}
                onClick={() => void toggle(channel.id, !channel.connected)}
                className={cn(
                  "border-white/10",
                  channel.connected
                    ? "bg-emerald-400/10 text-emerald-200"
                    : "bg-white/[0.03] text-zinc-300",
                )}
              >
                {channel.connected ? "Connected" : "Connect"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
