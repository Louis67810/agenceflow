import type { ReactNode } from "react";

export default function SetupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      {children}
    </div>
  );
}
