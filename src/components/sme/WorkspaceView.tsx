"use client";

import { useMemo, useState, type ReactNode } from "react";

import { predictDeals } from "@/lib/deal-intelligence";
import { allMessages } from "@/components/sme/workspace/workspace-format";
import { useWorkspace } from "@/components/sme/workspace/use-workspace";
import {
  DealPanel,
  WorkspaceError,
  WorkspaceLoading,
} from "@/components/sme/workspace/workspace-ui";
import {
  DealsScreen,
  HomeScreen,
  InboxScreen,
  type ScreenProps,
} from "@/components/sme/workspace/core-screens";

export type WorkspaceViewName = "dashboard" | "inbox" | "deals";

const screens: Record<WorkspaceViewName, (props: ScreenProps) => ReactNode> = {
  dashboard: HomeScreen,
  deals: DealsScreen,
  inbox: InboxScreen,
};

export default function WorkspaceView({ view }: { view: WorkspaceViewName }) {
  const { workspace, loading, error, refresh } = useWorkspace();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const intelligence = useMemo(
    () =>
      workspace
        ? predictDeals({
            leads: workspace.leads,
            messages: allMessages(workspace),
            tasks: workspace.tasks,
          })
        : null,
    [workspace],
  );

  if (loading) return <WorkspaceLoading />;
  if (error || !workspace)
    return (
      <WorkspaceError
        message={error ?? "No workspace returned"}
        onRetry={() => void refresh()}
      />
    );

  const selectedLead = workspace.leads.find(
    (lead) => lead.id === selectedLeadId,
  );
  const Screen = screens[view];

  return (
    <>
      <Screen
        workspace={workspace}
        intelligence={intelligence!}
        onSelectLead={setSelectedLeadId}
        refresh={refresh}
      />
      <DealPanel
        lead={selectedLead}
        prediction={
          selectedLead && intelligence
            ? intelligence.predictions[selectedLead.id]
            : undefined
        }
        open={Boolean(selectedLead)}
        onOpenChange={(open) => {
          if (!open) setSelectedLeadId(null);
        }}
        onMutated={refresh}
      />
    </>
  );
}
