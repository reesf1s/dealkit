import type { CrmLeadDto, CrmWorkspacePayload } from "@/lib/sme-crm";

export function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function shortDate(value?: string | Date | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function initials(value?: string | null) {
  return (value ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function allMessages(workspace: CrmWorkspacePayload) {
  return Object.values(workspace.messages)
    .flat()
    .sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
    );
}

export function messagesForLead(
  workspace: CrmWorkspacePayload,
  leadId: string,
) {
  return allMessages(workspace).filter((message) => message.leadId === leadId);
}

export function totalValue(leads: CrmLeadDto[]) {
  return leads.reduce((sum, lead) => sum + Number(lead.valueAmount ?? 0), 0);
}
