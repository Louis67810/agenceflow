import type { ReactNode } from "react";
import { RoleAwareSidebar } from "@/components/agency/RoleAwareSidebar";
import AuthGuard from "@/components/agency/AuthGuard";

export default function AgencyLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <RoleAwareSidebar />
        <main className="ml-64 min-h-screen">{children}</main>
      </div>
    </AuthGuard>
  );
}
