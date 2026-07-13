import type {
  CrmLeadDto,
  TaskMutationInput,
  ActivityMutationInput,
} from "@/lib/sme-crm";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";

const callAnalysisSchema = z.object({
  summary: z.string().max(500),
  sentiment: z.enum(["positive", "mixed", "risk"]),
  risks: z.array(z.string().max(180)).max(4),
  objections: z.array(z.string().max(180)).max(4),
  competitors: z.array(z.string().max(80)).max(4),
  decisionSignals: z.array(z.string().max(180)).max(4),
  nextSteps: z.array(z.string().max(180)).max(4),
  recommendedTask: z.object({
    title: z.string().max(120),
    description: z.string().max(600),
    priority: z.enum(["high", "medium"]),
  }),
});

export type CallAnalysis = z.infer<typeof callAnalysisSchema>;

const riskTerms = [
  "risk",
  "legal",
  "security",
  "budget",
  "delay",
  "blocked",
  "concern",
  "procurement",
  "approval",
];
const objectionTerms = [
  "too expensive",
  "pricing",
  "cost",
  "heavy",
  "admin",
  "migration",
  "implementation",
  "not sure",
  "concern",
];
const competitorTerms = [
  "gong",
  "hubspot",
  "salesforce",
  "outreach",
  "salesloft",
  "pipedrive",
  "attio",
];
const decisionTerms = [
  "decision",
  "decide",
  "deadline",
  "friday",
  "monday",
  "owner",
  "sign",
  "approve",
  "legal review",
  "budget approved",
];
const positiveTerms = [
  "yes",
  "good",
  "great",
  "works",
  "interested",
  "budget approved",
  "move forward",
  "final",
];

function sentences(transcript: string) {
  return transcript
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function matchingSentences(
  transcript: string,
  terms: string[],
  fallback: string,
) {
  const lowerTerms = terms.map((term) => term.toLowerCase());
  const matches = sentences(transcript).filter((sentence) => {
    const lower = sentence.toLowerCase();
    return lowerTerms.some((term) => lower.includes(term));
  });
  return (
    [...new Set(matches)]
      .slice(0, 4)
      .map((item) =>
        item.length > 180 ? `${item.slice(0, 177)}...` : item,
      ) || [fallback]
  );
}

function mentionedTerms(transcript: string, terms: string[]) {
  const lower = transcript.toLowerCase();
  return terms
    .filter((term) => lower.includes(term))
    .map((term) => term[0].toUpperCase() + term.slice(1));
}

function analyzeCallTranscript(input: {
  transcript: string;
  lead?: CrmLeadDto | null;
}): CallAnalysis {
  const transcript = input.transcript.trim();
  const leadName = input.lead?.companyName ?? input.lead?.title ?? "this deal";
  const allSentences = sentences(transcript);
  const risks = matchingSentences(
    transcript,
    riskTerms,
    "No explicit commercial risk detected.",
  );
  const objections = matchingSentences(
    transcript,
    objectionTerms,
    "No clear objection captured.",
  );
  const competitors = mentionedTerms(transcript, competitorTerms);
  const decisionSignals = matchingSentences(
    transcript,
    decisionTerms,
    "No decision timing captured.",
  );
  const nextSteps = matchingSentences(
    transcript,
    ["next step", "send", "follow up", "book", "schedule", "share", "call"],
    "Confirm the next buyer action and owner.",
  );
  const positiveCount = mentionedTerms(transcript, positiveTerms).length;
  const riskCount =
    mentionedTerms(transcript, riskTerms).length + competitors.length;
  const sentiment =
    riskCount >= 3 ? "risk" : positiveCount > riskCount ? "positive" : "mixed";

  const summary =
    allSentences.slice(0, 2).join(" ") ||
    `Reviewed call transcript for ${leadName}.`;
  const taskTitle =
    sentiment === "risk"
      ? `Resolve call risks: ${leadName}`
      : `Follow up from call: ${leadName}`;

  return {
    summary,
    sentiment,
    risks,
    objections,
    competitors,
    decisionSignals,
    nextSteps,
    recommendedTask: {
      title: taskTitle,
      description: [
        `Call summary: ${summary}`,
        `Decision signal: ${decisionSignals[0]}`,
        `Next step: ${nextSteps[0]}`,
        competitors.length
          ? `Competitors mentioned: ${competitors.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
      priority: sentiment === "risk" ? "high" : "medium",
    },
  };
}

export async function analyzeCallTranscriptWithLlm(input: {
  transcript: string;
  lead?: CrmLeadDto | null;
}): Promise<{ analysis: CallAnalysis; model: string }> {
  const fallback = analyzeCallTranscript(input);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { analysis: fallback, model: "deterministic-fallback" };

  try {
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
    const openai = createOpenAI({ apiKey });
    const { output } = await generateText({
      model: openai(model),
      output: Output.object({ schema: callAnalysisSchema }),
      prompt: [
        "You are a rigorous B2B SaaS conversation intelligence analyst.",
        "Extract only evidence explicitly present in the transcript. Never invent dates, stakeholders, budgets, objections, competitors, or commitments.",
        "Write concise plain text without markdown. Quote or closely paraphrase evidence in risks, objections, and decision signals.",
        "Recommend one concrete seller task that advances the deal.",
        `Deal: ${input.lead?.companyName ?? input.lead?.title ?? "Unlinked deal"}`,
        `Buyer: ${input.lead?.primaryPersonName ?? "Unknown"}`,
        `Stage: ${input.lead?.stageName ?? input.lead?.stage ?? "Unknown"}`,
        `Transcript:\n${input.transcript.slice(0, 18_000)}`,
      ].join("\n"),
    });
    return { analysis: output ?? fallback, model };
  } catch (error) {
    console.error("[call intelligence]", error);
    return { analysis: fallback, model: "deterministic-fallback" };
  }
}

export function callAnalysisToActivity(input: {
  analysis: CallAnalysis;
  lead?: CrmLeadDto | null;
  transcript: string;
}): ActivityMutationInput {
  return {
    leadId: input.lead?.id,
    title: `Call review: ${input.lead?.companyName ?? "Unlinked deal"}`,
    type: "call_review",
    companyName: input.lead?.companyName ?? undefined,
    personName: input.lead?.primaryPersonName ?? undefined,
    body: [
      `Summary: ${input.analysis.summary}`,
      `Sentiment: ${input.analysis.sentiment}`,
      `Risks: ${input.analysis.risks.join(" | ")}`,
      `Objections: ${input.analysis.objections.join(" | ")}`,
      `Decision signals: ${input.analysis.decisionSignals.join(" | ")}`,
      `Next steps: ${input.analysis.nextSteps.join(" | ")}`,
      `Transcript excerpt: ${input.transcript.slice(0, 800)}`,
    ].join("\n\n"),
  };
}

export function callAnalysisToTask(input: {
  analysis: CallAnalysis;
  lead?: CrmLeadDto | null;
}): TaskMutationInput {
  return {
    leadId: input.lead?.id,
    title: input.analysis.recommendedTask.title,
    description: input.analysis.recommendedTask.description,
    priority: input.analysis.recommendedTask.priority,
    companyName: input.lead?.companyName ?? undefined,
    personName: input.lead?.primaryPersonName ?? undefined,
  };
}
