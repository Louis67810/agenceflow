"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }

      const role = session.user.app_metadata?.role as string | undefined;

      // Enforce role-based access
      if (role === "client") {
        if (!pathname.startsWith("/client")) {
          router.replace("/client");
          return;
        }
      } else if (role === "designer") {
        if (!pathname.startsWith("/designer")) {
          router.replace("/designer");
          return;
        }
      }
      // No role = admin, can access everything

      setChecked(true);
    });
  }, [router, pathname]);

  if (!checked) return null;

  return <>{children}</>;
}
