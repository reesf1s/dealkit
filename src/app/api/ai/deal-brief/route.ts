export const dynamic = "force-dynamic";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getWorkspaceContext } from "@/lib/workspace";
import {
  getCrmWorkspacePayload,
  getDemoCrmWorkspaceState,
  recordAiDraft,
  type CrmLeadDto,
  type CrmWorkspacePayload,
} from "@/lib/sme-crm";

const briefSchema = z.object({
  summary: z.string().max(320),
  buyerIntent: z.enum(["strong", "mixed", "weak", "unknown"]),
  risks: z.array(z.string().max(140)).max(3),
  positiveSignals: z.array(z.string().max(140)).max(3),
  nextBestAction: z.object({
    title: z.string().max(120),
    reason: z.string().max(220),
    suggestedMessage: z.string().max(600),
  }),
  probabilityAdjustment: z.number().min(-20).max(20),
});

export type DealBrief = z.infer<typeof briefSchema>;

function fallbackBrief(lead: CrmLeadDto): DealBrief {
  const weak = lead.risk === "hot" || Number(lead.probability ?? 0) < 45;
  return {
    summary: `${lead.companyName ?? lead.title} is in ${lead.stageName ?? lead.stage}. ${lead.description ?? "The deal needs a clearer evidence trail."}`,
    buyerIntent: weak ? "mixed" : "strong",
    risks: weak
      ? [
          "Current probability and activity pattern need stronger buyer evidence.",
        ]
      : [],
    positiveSignals:
      Number(lead.valueAmount ?? 0) > 0
        ? ["Commercial value and a live opportunity are recorded."]
        : [],
    nextBestAction: {
      title: lead.nextStep || "Confirm the next milestone",
      reason:
        "The best action is the smallest step that produces new buyer evidence.",
      suggestedMessage: `Hi ${lead.primaryPersonName ?? "there"}, I wanted to make the next step easy. ${lead.nextStep || "Could we confirm the next milestone and owner?"} Would a short call this week work?`,
    },
    probabilityAdjustment: 0,
  };
}

function dealContext(workspace: CrmWorkspacePayload, lead: CrmLeadDto) {
  const messages = Object.values(workspace.messages)
    .flat()
    .filter((message) => message.leadId === lead.id)
    .slice(-8)
    .map((message) => `${message.from}: ${message.text}`);
  const activities = workspace.activities
    .filter(
      (activity) =>
        activity.companyName === lead.companyName ||
        activity.dealTitle === lead.title,
    )
    .slice(0, 8)
    .map(
      (activity) => `${activity.type}: ${activity.title} — ${activity.body}`,
    );
  const tasks = workspace.tasks
    .filter((task) => task.companyName === lead.companyName)
    .slice(0, 6)
    .map((task) => `${task.priority}: ${task.title}`);
  return { messages, activities, tasks };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      leadId?: unknown;
    };
    if (typeof body.leadId !== "string")
      return NextResponse.json(
        { error: "leadId is required" },
        { status: 400 },
      );

    let workspace: CrmWorkspacePayload;
    let workspaceId = "local-demo";
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.HALVEX_LOCAL_DATABASE !== "1"
    ) {
      workspace = getDemoCrmWorkspaceState();
    } else {
      const { userId } = await auth();
      if (!userId)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const user = await currentUser();
      const context = await getWorkspaceContext(
        userId,
        user?.emailAddresses[0]?.emailAddress,
      );
      workspaceId = context.workspaceId;
      workspace = await getCrmWorkspacePayload(workspaceId);
    }

    const lead = workspace.leads.find(
      (candidate) => candidate.id === body.leadId,
    );
    if (!lead)
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    const fallback = fallbackBrief(lead);
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey || workspace.demo)
      return NextResponse.json({
        brief: fallback,
        model: "deterministic-fallback",
      });

    const context = dealContext(workspace, lead);
    const openai = createOpenAI({ apiKey });
    const prompt = [
      "Act as a rigorous B2B sales deal analyst for a small business CRM.",
      "Use only the evidence supplied. Never invent stakeholders, dates, competitors, objections, or commitments.",
      "Recommend one action a seller can complete now. The message must be natural, specific, and concise.",
      `Deal: ${lead.companyName ?? lead.title}`,
      `Buyer: ${lead.primaryPersonName ?? "Unknown"}`,
      `Stage: ${lead.stageName ?? lead.stage}`,
      `Current probability: ${lead.probability ?? 0}%`,
      `Value: ${lead.valueAmount ?? 0}`,
      `Description: ${lead.description ?? ""}`,
      `Recorded next step: ${lead.nextStep ?? ""}`,
      `Notes: ${lead.notes ?? ""}`,
      `Recent messages:\n${context.messages.join("\n") || "None"}`,
      `Recent activities:\n${context.activities.join("\n") || "None"}`,
      `Open tasks:\n${context.tasks.join("\n") || "None"}`,
    ].join("\n");

    const { output } = await generateText({
      model: openai(process.env.OPENAI_MODEL?.trim() || "gpt-5-mini"),
      output: Output.object({ schema: briefSchema }),
      prompt,
    });
    const brief = output ?? fallback;
    await recordAiDraft({
      workspaceId,
      leadId: lead.id,
      prompt,
      result: JSON.stringify(brief),
      model: process.env.OPENAI_MODEL?.trim() || "gpt-5-mini",
    });
    return NextResponse.json({
      brief,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-5-mini",
    });
  } catch (error) {
    console.error("[POST /api/ai/deal-brief]", error);
    return NextResponse.json(
      { error: "Unable to analyse deal" },
      { status: 500 },
    );
  }
}
