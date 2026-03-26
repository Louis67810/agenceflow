import type { ReactNode } from "react";
import { AgencySidebar } from "@/components/agency/AgencySidebar";
import AuthGuard from "@/components/agency/AuthGuard";

export default function AgencyLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <AgencySidebar role="admin" userName="Admin" />
        <main className="ml-64 min-h-screen">{children}</main>
      </div>
    </AuthGuard>
  );
}
