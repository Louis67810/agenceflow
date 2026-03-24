import { AgencySidebar } from "@/components/agency/AgencySidebar";
import type { AgencyRole } from "@/types/agency";

// In a real app, this would come from auth session
function getRoleFromPath(pathname: string): AgencyRole {
  if (pathname.startsWith("/client")) return "client";
  if (pathname.startsWith("/designer")) return "designer";
  return "admin";
}

export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: Replace with actual auth session
  const role: AgencyRole = "admin";

  return (
    <div className="min-h-screen bg-gray-50">
      <AgencySidebar role={role} userName="Admin" />
      <main className="ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
