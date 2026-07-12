import type {
  CrmLeadDto,
  CrmWorkspacePayload,
  TaskMutationInput,
} from "@/lib/sme-crm";

type CrmAutomationRuleId =
  "stale_deal_rescue" | "hot_risk_proof" | "commit_close_plan";

export type CrmAutomationRule = {
  id: CrmAutomationRuleId;
  name: string;
  description: string;
  cadence: string;
  priority: "high" | "medium";
};

export type CrmAutomationRecommendation = {
  id: string;
  ruleId: CrmAutomationRuleId;
  ruleName: string;
  leadId: string;
  companyName: string;
  personName: string;
  title: string;
  description: string;
  priority: "high" | "medium";
  reason: string;
  estimatedValue: number;
};

export const crmAutomationRules: CrmAutomationRule[] = [
  {
    id: "stale_deal_rescue",
    name: "Stale deal rescue",
    description:
      "Create a recovery task when an open deal has no recent activity.",
    cadence: "Daily at 09:00",
    priority: "high",
  },
  {
    id: "hot_risk_proof",
    name: "Risk proof pack",
    description:
      "Create proof and stakeholder tasks for hot-risk opportunities.",
    cadence: "When risk changes",
    priority: "high",
  },
  {
    id: "commit_close_plan",
    name: "Commit close plan",
    description:
      "Create a close-plan task for high-probability forecast deals.",
    cadence: "Before forecast review",
    priority: "medium",
  },
];

function daysSince(value?: string | Date | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  return Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 86_400_000),
  );
}

function isOpen(lead: CrmLeadDto) {
  return lead.status !== "won" && lead.status !== "lost";
}

function taskExists(
  workspace: CrmWorkspacePayload,
  lead: CrmLeadDto,
  title: string,
) {
  return workspace.tasks.some(
    (task) =>
      task.companyName === lead.companyName &&
      (task.title ?? "").toLowerCase() === title.toLowerCase(),
  );
}

function recommendation(input: {
  rule: CrmAutomationRule;
  lead: CrmLeadDto;
  title: string;
  description: string;
  reason: string;
}): CrmAutomationRecommendation {
  return {
    id: `${input.rule.id}:${input.lead.id}`,
    ruleId: input.rule.id,
    ruleName: input.rule.name,
    leadId: input.lead.id,
    companyName:
      input.lead.companyName ?? input.lead.title ?? "Untitled account",
    personName: input.lead.primaryPersonName ?? "Primary contact",
    title: input.title,
    description: input.description,
    priority: input.rule.priority,
    reason: input.reason,
    estimatedValue: Number(input.lead.valueAmount ?? 0),
  };
}

export function buildAutomationRecommendations(workspace: CrmWorkspacePayload) {
  const recommendations: CrmAutomationRecommendation[] = [];
  const staleRule = crmAutomationRules.find(
    (rule) => rule.id === "stale_deal_rescue",
  )!;
  const riskRule = crmAutomationRules.find(
    (rule) => rule.id === "hot_risk_proof",
  )!;
  const commitRule = crmAutomationRules.find(
    (rule) => rule.id === "commit_close_plan",
  )!;

  for (const lead of workspace.leads.filter(isOpen)) {
    const staleTitle = `Rescue stale deal: ${lead.companyName}`;
    if (
      daysSince(lead.latestActivityAt) >= 7 &&
      !taskExists(workspace, lead, staleTitle)
    ) {
      recommendations.push(
        recommendation({
          rule: staleRule,
          lead,
          title: staleTitle,
          description: `No recent activity for ${daysSince(lead.latestActivityAt)} days. Reconfirm pain, timeline, and the next buyer action.`,
          reason: `${daysSince(lead.latestActivityAt)} days since last activity`,
        }),
      );
    }

    const riskTitle = `Send proof pack: ${lead.companyName}`;
    if (
      (lead.risk === "hot" || Number(lead.probability ?? 0) < 45) &&
      !taskExists(workspace, lead, riskTitle)
    ) {
      recommendations.push(
        recommendation({
          rule: riskRule,
          lead,
          title: riskTitle,
          description:
            "Send relevant proof, security notes, ROI context, and ask who else needs confidence before the next step.",
          reason: `${lead.risk} risk with ${lead.probability}% probability`,
        }),
      );
    }

    const commitTitle = `Build close plan: ${lead.companyName}`;
    if (
      Number(lead.probability ?? 0) >= 70 &&
      !taskExists(workspace, lead, commitTitle)
    ) {
      recommendations.push(
        recommendation({
          rule: commitRule,
          lead,
          title: commitTitle,
          description:
            "Confirm mutual close date, buyer owner, legal/security path, and final business outcome.",
          reason: `${lead.probability}% forecast probability`,
        }),
      );
    }
  }

  return recommendations.sort((a, b) => b.estimatedValue - a.estimatedValue);
}

export function recommendationToTask(
  input: CrmAutomationRecommendation,
): TaskMutationInput {
  return {
    leadId: input.leadId,
    title: input.title,
    description: `${input.description}\n\nAutomation: ${input.ruleName}. Reason: ${input.reason}.`,
    priority: input.priority,
    companyName: input.companyName,
    personName: input.personName,
  };
}
