"use client";

import { useEffect, useState } from "react";
import {
  fetchRemoteLinkedInSettings,
  flushPendingRemoteLinkedInSettings,
  hasMeaningfulLinkedInSettings,
  loadLinkedInSettings,
  persistRemoteLinkedInSettings,
} from "@/lib/linkedin/settings";
import {
  DEFAULT_LINKEDIN_WORKSPACE,
  fetchRemoteLinkedInWorkspace,
  flushPendingRemoteLinkedInWorkspace,
  hasMeaningfulLinkedInWorkspaceData,
  loadLinkedInWorkspaceCache,
  saveRemoteLinkedInWorkspace,
} from "@/lib/linkedin/workspace";
import { loadLinkedInPosts, saveLinkedInPosts } from "@/lib/linkedin/posts";
import {
  fetchRemoteLinkedInPosts,
  flushPendingRemoteLinkedInPosts,
  persistRemoteLinkedInPosts,
} from "@/lib/linkedin/remote";

export default function LinkedInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const localSettings = loadLinkedInSettings();
        const localWorkspace = loadLinkedInWorkspaceCache();
        const localPosts = loadLinkedInPosts();

        await Promise.allSettled([
          flushPendingRemoteLinkedInSettings(),
          flushPendingRemoteLinkedInWorkspace(),
          flushPendingRemoteLinkedInPosts(),
        ]);

        const [remoteSettingsResult, remoteWorkspaceResult, remotePostsResult] =
          await Promise.allSettled([
            fetchRemoteLinkedInSettings(),
            fetchRemoteLinkedInWorkspace(),
            fetchRemoteLinkedInPosts(),
          ]);

        if (
          remoteSettingsResult.status !== "fulfilled" &&
          hasMeaningfulLinkedInSettings(localSettings)
        ) {
          await persistRemoteLinkedInSettings(localSettings);
        }

        if (remoteWorkspaceResult.status !== "fulfilled") {
          if (hasMeaningfulLinkedInWorkspaceData(localWorkspace)) {
            await saveRemoteLinkedInWorkspace(localWorkspace);
          } else {
            await saveRemoteLinkedInWorkspace(DEFAULT_LINKEDIN_WORKSPACE);
          }
        }

        if (remotePostsResult.status === "fulfilled") {
          saveLinkedInPosts(remotePostsResult.value);
        } else if (localPosts.length > 0) {
          await persistRemoteLinkedInPosts(localPosts, true);
        }
      } catch (error) {
        console.error("LinkedIn layout bootstrap failed", error);
      } finally {
        if (!cancelled) {
          setBootstrapped(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="linkedin-responsive-shell flex h-[100dvh] flex-col overflow-hidden bg-[#fbfbfb] lg:h-screen">
      <div className="min-h-0 flex-1 overflow-hidden">
        {bootstrapped ? (
          children
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[#7b8495]">
            Chargement de l&apos;espace LinkedIn...
          </div>
        )}
      </div>
    </div>
  );
}
