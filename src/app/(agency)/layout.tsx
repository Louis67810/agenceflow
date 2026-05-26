import type { ReactNode } from "react";
import { RoleAwareSidebar } from "@/components/agency/RoleAwareSidebar";
import AuthGuard from "@/components/agency/AuthGuard";

export default function AgencyLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <RoleAwareSidebar />
        <main className="agency-main-responsive min-h-screen pb-24 lg:ml-64 lg:pb-0">{children}</main>
      </div>
    </AuthGuard>
  );
}
