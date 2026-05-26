import type { ReactNode } from "react";

export default function AgendaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="agenda-responsive-shell h-full overflow-auto">
      {children}
    </div>
  );
}
