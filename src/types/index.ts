export type Plan = "free" | "starter" | "pro";

export interface PlanLimits {
  workspaces: number | null;
  members: number | null;
  companies: number | null;
  people: number | null;
  deals: number | null;
  tasks: number | null;
  exports: boolean;
}

export interface PlanDefinition {
  id: Plan;
  name: string;
  description: string;
  priceMonthly: number;
  priceId: string | null;
  limits: PlanLimits;
  features: string[];
}
