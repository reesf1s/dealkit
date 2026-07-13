"use client";

import { useCallback, useEffect, useState } from "react";
import type { CrmWorkspacePayload } from "@/lib/sme-crm";

export async function crmRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  return payload as T;
}

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<CrmWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setWorkspace(await crmRequest<CrmWorkspacePayload>("/api/crm/workspace"));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load workspace",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handleRefresh = () => void refresh();
    window.addEventListener("halvex:workspace-refresh", handleRefresh);
    return () =>
      window.removeEventListener("halvex:workspace-refresh", handleRefresh);
  }, [refresh]);

  return { workspace, loading, error, refresh };
}
