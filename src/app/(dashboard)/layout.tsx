import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import SmeDashboardShell from "@/components/sme/SmeDashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY
  ) {
    await auth.protect();
  }
  return <SmeDashboardShell>{children}</SmeDashboardShell>;
}
