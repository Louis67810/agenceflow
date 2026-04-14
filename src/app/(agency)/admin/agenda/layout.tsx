import type { ReactNode } from "react";

export default function AgendaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-auto">
      {children}
    </div>
  );
}
