import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { logWorkspaceEvent } from "@/lib/audit";

const viewFiltersSchema = z.object({
  query: z.string().trim().optional(),
  stage: z.string().trim().optional(),
  owner: z.string().trim().optional(),
  risk: z.enum(["hot", "warm", "new"]).optional(),
  channel: z.enum(["mail", "linkedin", "webchat", "meetings"]).optional(),
  minProbability: z.coerce.number().min(0).max(100).optional(),
});

type CrmViewFilters = z.infer<typeof viewFiltersSchema>;

export type CrmSavedViewDto = {
  id: string;
  name: string;
  description: string;
  scope: "system" | "workspace";
  filters: CrmViewFilters;
  createdAt: string;
};

const systemViews: CrmSavedViewDto[] = [
  {
    id: "system-all-open",
    name: "All open",
    description: "Every active deal in the workspace.",
    scope: "system",
    filters: {},
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "system-at-risk",
    name: "At risk",
    description: "Low confidence or hot-risk opportunities.",
    scope: "system",
    filters: { risk: "hot" },
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "system-commit",
    name: "Commit",
    description: "Deals at 70%+ probability.",
    scope: "system",
    filters: { minProbability: 70 },
    createdAt: new Date(0).toISOString(),
  },
];

function metadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>;
  return {};
}

function eventToView(event: {
  id: string;
  metadata: unknown;
  createdAt: Date;
}): CrmSavedViewDto | null {
  const data = metadata(event.metadata);
  if (typeof data.name !== "string") return null;
  const filters = viewFiltersSchema.safeParse(data.filters ?? {});
  if (!filters.success) return null;

  return {
    id: event.id,
    name: data.name,
    description:
      typeof data.description === "string"
        ? data.description
        : "Workspace saved view.",
    scope: "workspace",
    filters: filters.data,
    createdAt: event.createdAt.toISOString(),
  };
}

export function getDemoCrmViews(): CrmSavedViewDto[] {
  return [
    ...systemViews,
    {
      id: "demo-view-enterprise-risk",
      name: "Enterprise risk",
      description: "Hot opportunities that need executive attention.",
      scope: "workspace",
      filters: { risk: "hot", minProbability: 40 },
      createdAt: new Date().toISOString(),
    },
  ];
}

export async function getWorkspaceCrmViews(
  workspaceId: string,
): Promise<CrmSavedViewDto[]> {
  const rows = await db
    .select({
      id: events.id,
      metadata: events.metadata,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(eq(events.workspaceId, workspaceId))
    .orderBy(desc(events.createdAt))
    .limit(100);

  const workspaceViews = rows
    .filter((row) => metadata(row.metadata).kind === "crm_saved_view")
    .map(eventToView)
    .filter(Boolean) as CrmSavedViewDto[];

  return [...systemViews, ...workspaceViews];
}

export async function saveWorkspaceCrmView(input: {
  workspaceId: string;
  userId: string;
  name: string;
  description?: string;
  filters: unknown;
}) {
  const filters = viewFiltersSchema.parse(input.filters);
  await logWorkspaceEvent({
    workspaceId: input.workspaceId,
    userId: input.userId,
    type: "crm.view.saved",
    metadata: {
      kind: "crm_saved_view",
      name: input.name.trim(),
      description: input.description?.trim() || "Workspace saved deal view.",
      filters,
    },
  });
}
