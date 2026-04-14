"use client";

import { usePathname } from "next/navigation";
import { AgencySidebar } from "./AgencySidebar";
import type { AgencyRole } from "@/types/agency";

export function RoleAwareSidebar() {
  const pathname = usePathname();
  const role: AgencyRole = pathname.startsWith("/client")
    ? "client"
    : pathname.startsWith("/designer")
    ? "designer"
    : "admin";

  return <AgencySidebar role={role} />;
}
