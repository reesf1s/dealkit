import type { CrmLeadDto, CrmMessageDto } from "@/lib/sme-crm";
import type { RecoveryTask } from "@/lib/recovery-intelligence";

export type DealPrediction = {
  probability: number;
  confidence: number;
  risk: "high" | "medium" | "low";
  signals: string[];
  nextAction: {
    type: "reply" | "task" | "review";
    title: string;
    reason: string;
  };
};

type Model = {
  weights: number[];
  samples: number;
  trained: boolean;
};

const STAGE_PROGRESS: Record<string, number> = {
  new: 0.08,
  discovery: 0.22,
  evaluation: 0.4,
  proposal: 0.58,
  negotiation: 0.78,
  commit: 0.9,
  "closed won": 1,
  "closed lost": 0,
};

// Prior learned from a generic SME sales funnel. Workspace outcomes replace it
// once there is enough labelled won/lost history to train a local model.
const PRIOR_WEIGHTS = [-2.05, 1.1, 1.35, 1.15, 0.8, 0.35, -0.75];

function daysSince(value?: string | Date | null, now = new Date()) {
  if (!value) return 90;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 90;
  return Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
}

function features(lead: CrmLeadDto, now = new Date()) {
  const stage =
    STAGE_PROGRESS[String(lead.stageName ?? lead.stage ?? "").toLowerCase()] ??
    0.18;
  const freshness = Math.exp(-daysSince(lead.latestActivityAt, now) / 21);
  const nextStep = lead.nextStep?.trim() ? 1 : 0;
  const taskLoad = Math.min(1, Number(lead.openTaskCount ?? 0) / 4);
  const riskPenalty = lead.risk === "hot" ? 0 : lead.risk === "warm" ? 0.45 : 1;
  return [
    1,
    Number(lead.probability ?? 0) / 100,
    stage,
    freshness,
    nextStep,
    taskLoad,
    riskPenalty,
  ];
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, value))));
}

function dot(left: number[], right: number[]) {
  return left.reduce(
    (sum, value, index) => sum + value * (right[index] ?? 0),
    0,
  );
}

export function trainDealModel(leads: CrmLeadDto[]): Model {
  const labelled = leads
    .filter((lead) => lead.status === "won" || lead.status === "lost")
    .map((lead) => ({ x: features(lead), y: lead.status === "won" ? 1 : 0 }));
  const hasBothOutcomes =
    labelled.some((row) => row.y === 1) && labelled.some((row) => row.y === 0);

  if (labelled.length < 6 || !hasBothOutcomes) {
    return { weights: PRIOR_WEIGHTS, samples: labelled.length, trained: false };
  }

  const weights = [...PRIOR_WEIGHTS];
  const learningRate = 0.16;
  const regularization = 0.01;

  for (let epoch = 0; epoch < 220; epoch += 1) {
    const gradients = Array.from({ length: weights.length }, () => 0);
    for (const row of labelled) {
      const error = sigmoid(dot(weights, row.x)) - row.y;
      row.x.forEach((value, index) => {
        gradients[index] += error * value;
      });
    }
    weights.forEach((weight, index) => {
      const penalty = index === 0 ? 0 : regularization * weight;
      weights[index] -=
        learningRate * (gradients[index] / labelled.length + penalty);
    });
  }

  return { weights, samples: labelled.length, trained: true };
}

function lastLeadMessage(lead: CrmLeadDto, messages: CrmMessageDto[]) {
  return messages
    .filter((message) => message.leadId === lead.id)
    .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
    .at(-1);
}

function dealSignals(
  lead: CrmLeadDto,
  prediction: number,
  lastMessage?: CrmMessageDto,
) {
  const signals: string[] = [];
  const staleDays = Math.round(daysSince(lead.latestActivityAt));
  if (lastMessage?.from === "customer")
    signals.push("Buyer is waiting for a reply");
  if (staleDays >= 7) signals.push(`No activity for ${staleDays} days`);
  if (!lead.nextStep?.trim()) signals.push("No next step recorded");
  if (Number(lead.openTaskCount ?? 0) === 0)
    signals.push("No follow-up task scheduled");
  if (Number(lead.valueAmount ?? 0) >= 25000)
    signals.push("High-value opportunity");
  if (prediction >= 0.7) signals.push("Strong win pattern");
  return signals.slice(0, 3);
}

function recommendAction(
  lead: CrmLeadDto,
  lastMessage: CrmMessageDto | undefined,
  signals: string[],
): DealPrediction["nextAction"] {
  if (lastMessage?.from === "customer") {
    return {
      type: "reply",
      title: `Reply to ${lead.primaryPersonName ?? lead.companyName}`,
      reason: "The buyer sent the latest message.",
    };
  }
  if (!lead.nextStep?.trim()) {
    return {
      type: "review",
      title: "Set the next milestone",
      reason: "Deals without a dated next step are less likely to close.",
    };
  }
  if (
    signals.some((signal) => signal.startsWith("No activity")) ||
    Number(lead.openTaskCount ?? 0) === 0
  ) {
    return {
      type: "task",
      title: lead.nextStep,
      reason: "Turn the next step into scheduled work.",
    };
  }
  return {
    type: "review",
    title: "Review deal evidence",
    reason:
      "Confirm stage, probability, and buying evidence before forecasting.",
  };
}

export function predictDeals(input: {
  leads: CrmLeadDto[];
  messages: CrmMessageDto[];
  tasks?: RecoveryTask[];
}) {
  const model = trainDealModel(input.leads);
  const predictions = Object.fromEntries(
    input.leads.map((lead) => {
      const probability = sigmoid(dot(model.weights, features(lead)));
      const lastMessage = lastLeadMessage(lead, input.messages);
      const signals = dealSignals(lead, probability, lastMessage);
      const risk =
        probability < 0.4 ||
        signals.some((signal) => signal.startsWith("No activity"))
          ? "high"
          : probability < 0.68
            ? "medium"
            : "low";
      const prediction: DealPrediction = {
        probability: Math.round(probability * 100),
        confidence: model.trained ? Math.min(94, 62 + model.samples * 2) : 58,
        risk,
        signals,
        nextAction: recommendAction(lead, lastMessage, signals),
      };
      return [lead.id, prediction];
    }),
  );

  const queue = input.leads
    .filter((lead) => lead.status !== "won" && lead.status !== "lost")
    .map((lead) => ({ lead, prediction: predictions[lead.id] }))
    .sort((a, b) => {
      const aPriority =
        (a.prediction.risk === "high"
          ? 100
          : a.prediction.risk === "medium"
            ? 50
            : 0) +
        Number(a.lead.valueAmount ?? 0) / 1000;
      const bPriority =
        (b.prediction.risk === "high"
          ? 100
          : b.prediction.risk === "medium"
            ? 50
            : 0) +
        Number(b.lead.valueAmount ?? 0) / 1000;
      return bPriority - aPriority;
    });

  return { model, predictions, queue };
}
