"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/linkedin/posts", label: "Posts" },
  { href: "/admin/linkedin/planification", label: "Planification" },
  { href: "/admin/linkedin/style", label: "Style" },
  { href: "/admin/linkedin/idees", label: "Idées" },
  { href: "/admin/linkedin/prospection", label: "Prospection" },
];

export default function LinkedInLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Sub-navigation */}
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center px-6">
          <div className="flex items-center gap-2.5 mr-8 py-3.5">
            <div className="w-7 h-7 bg-[#0A66C2] rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-black">in</span>
            </div>
            <h1 className="font-bold text-gray-900">LinkedIn</h1>
          </div>
          <div className="flex items-center gap-0">
            {tabs.map((tab) => {
              const isActive = pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "border-[#0A66C2] text-[#0A66C2]"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
