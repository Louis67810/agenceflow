"use client";

import { useEffect, useMemo, useState } from "react";
import type { LinkedInPost, LinkedInPostAnalytics } from "@/types/linkedin";
import {
  createImportedAnalyticsPost,
  findPostByAnalytics,
  loadLinkedInPosts,
  mergePostAnalytics,
  normalizeAnalytics,
  saveLinkedInPosts,
  computeLinkedInPostScore,
} from "@/lib/linkedin/posts";
import { fetchRemoteLinkedInPosts, saveRemoteLinkedInPosts } from "@/lib/linkedin/remote";

const jk = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

type EditableAnalytics = Omit<LinkedInPostAnalytics, "importedAt" | "sourceFileName">;

function emptyEditableAnalytics(): EditableAnalytics {
  return {
    postUrl: "",
    publishedDate: "",
    publishedTime: "",
    linkUrl: "",
    impressions: 0,
    reach: 0,
    profileViews: 0,
    followersGained: 0,
    socialEngagement: 0,
    reactions: 0,
    comments: 0,
    reposts: 0,
    saves: 0,
    sends: 0,
    linkClicks: 0,
    customButtonClicks: 0,
    engagementRate: 0,
  };
}

function toInputValue(value: string | number | undefined) {
  if (value === undefined || value === null) return "";
  return String(value);
}

export default function LinkedInStatsPage() {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditableAnalytics>(emptyEditableAnalytics());
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    const loaded = loadLinkedInPosts();
    setPosts(loaded);
    if (loaded[0]) selectPost(loaded[0]);

    void (async () => {
      try {
        const remotePosts = await fetchRemoteLinkedInPosts();
        if (remotePosts.length > 0) {
          setPosts(remotePosts);
          saveLinkedInPosts(remotePosts);
          if (remotePosts[0]) selectPost(remotePosts[0]);
        } else if (loaded.length > 0) {
          await saveRemoteLinkedInPosts(loaded, true);
        }
      } catch {}
    })();
  }, []);

  const publishedPosts = useMemo(
    () => posts.filter((post) => post.status === "published"),
    [posts]
  );

  const rankedPosts = useMemo(
    () => [...publishedPosts].sort((a, b) => computeLinkedInPostScore(b) - computeLinkedInPostScore(a)),
    [publishedPosts]
  );

  const bestPost = rankedPosts[0] ?? null;
  const totalImpressions = publishedPosts.reduce((sum, post) => sum + (post.analytics?.impressions ?? post.impressions ?? 0), 0);
  const totalReach = publishedPosts.reduce((sum, post) => sum + (post.analytics?.reach ?? 0), 0);
  const totalProfileViews = publishedPosts.reduce((sum, post) => sum + (post.analytics?.profileViews ?? 0), 0);
  const averageEngagement = publishedPosts.length === 0
    ? 0
    : publishedPosts.reduce((sum, post) => sum + (post.analytics?.engagementRate ?? 0), 0) / publishedPosts.length;

  function persist(updatedPosts: LinkedInPost[]) {
    setPosts(updatedPosts);
    saveLinkedInPosts(updatedPosts);
    void saveRemoteLinkedInPosts(updatedPosts, true);
  }

  function selectPost(post: LinkedInPost) {
    setSelectedPostId(post.id);
    const analytics = normalizeAnalytics(post.analytics);
    setEditor({
      postUrl: analytics.postUrl ?? post.postUrl ?? "",
      publishedDate: analytics.publishedDate ?? post.publishedAt?.slice(0, 10) ?? "",
      publishedTime: analytics.publishedTime ?? post.publishedAt?.slice(11, 16) ?? "",
      linkUrl: analytics.linkUrl ?? "",
      impressions: analytics.impressions,
      reach: analytics.reach,
      profileViews: analytics.profileViews,
      followersGained: analytics.followersGained,
      socialEngagement: analytics.socialEngagement,
      reactions: analytics.reactions,
      comments: analytics.comments,
      reposts: analytics.reposts,
      saves: analytics.saves,
      sends: analytics.sends,
      linkClicks: analytics.linkClicks,
      customButtonClicks: analytics.customButtonClicks,
      engagementRate: analytics.engagementRate,
    });
  }

  function handleEditorChange<K extends keyof EditableAnalytics>(key: K, value: EditableAnalytics[K]) {
    setEditor((prev) => ({ ...prev, [key]: value }));
  }

  function saveEditor() {
    if (!selectedPostId) return;
    const updated = posts.map((post) =>
      post.id === selectedPostId
        ? mergePostAnalytics(post, {
            ...editor,
            importedAt: post.analytics?.importedAt ?? new Date().toISOString(),
          })
        : post
    );
    persist(updated);
    const selected = updated.find((post) => post.id === selectedPostId);
    if (selected) selectPost(selected);
    setImportMessage("Statistiques sauvegardées.");
  }

  async function handleImport(file: File) {
    setImporting(true);
    setImportMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/linkedin/import-analytics", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import impossible");

      const analytics = data.analytics as LinkedInPostAnalytics;
      const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;
      const preferredPublishedPost =
        selectedPost?.status === "published"
          ? selectedPost
          : publishedPosts.length === 1
          ? publishedPosts[0]
          : null;
      const match = findPostByAnalytics(posts, analytics) ?? preferredPublishedPost;

      let updatedPosts: LinkedInPost[];
      let targetPost: LinkedInPost;
      if (match) {
        updatedPosts = posts.map((post) => post.id === match.id ? mergePostAnalytics(post, analytics) : post);
        targetPost = updatedPosts.find((post) => post.id === match.id)!;
      } else {
        targetPost = createImportedAnalyticsPost(analytics);
        updatedPosts = [targetPost, ...posts];
      }

      persist(updatedPosts);
      selectPost(targetPost);
      setImportMessage(
        match
          ? "Statistiques mises à jour sur le post existant."
          : "Import ajouté comme nouveau post analytique."
      );
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Import impossible.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", ...jk }}>
      <div style={{ width: 360, borderRight: "1px solid rgba(0,0,0,0.08)", background: "#fff", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#121a2e" }}>Données LinkedIn</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(18,26,46,0.45)", lineHeight: 1.5 }}>
            Importe un export LinkedIn `.xlsx` ou `.csv`, puis enrichis chaque post avec ses vraies performances.
          </p>
        </div>

        <div style={{ padding: 20, borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px dashed #9fb4ff",
              background: "#f4f7ff",
              color: "#0147ff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {importing ? "Import en cours..." : "Importer un export LinkedIn"}
            <input
              type="file"
              accept=".xlsx,.csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImport(file);
                e.currentTarget.value = "";
              }}
            />
          </label>
          {importMessage && (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "rgba(18,26,46,0.55)" }}>{importMessage}</p>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {rankedPosts.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "rgba(18,26,46,0.4)", fontSize: 13 }}>
              Aucun post publié avec statistiques pour l’instant.
            </div>
          ) : (
            rankedPosts.map((post, index) => {
              const analytics = normalizeAnalytics(post.analytics);
              const active = selectedPostId === post.id;
              return (
                <button
                  key={post.id}
                  onClick={() => selectPost(post)}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    borderRadius: 14,
                    border: active ? "1px solid #9fb4ff" : "1px solid rgba(0,0,0,0.08)",
                    background: active ? "#f4f7ff" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#0147ff" : "rgba(18,26,46,0.4)" }}>
                      #{index + 1}
                    </span>
                    <span style={{ fontSize: 11, color: "rgba(18,26,46,0.4)" }}>
                      {analytics.publishedDate || post.publishedAt?.slice(0, 10) || "Non daté"}
                    </span>
                  </div>
                  <p style={{ margin: "8px 0", fontSize: 13, lineHeight: 1.55, color: "#121a2e", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {post.content}
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "rgba(18,26,46,0.55)" }}>
                    <span>{analytics.impressions.toLocaleString()} impr.</span>
                    <span>{analytics.reactions} réactions</span>
                    <span>{analytics.comments} com.</span>
                    <span>{analytics.engagementRate.toFixed(1)}% eng.</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", background: "#f7f8fc", padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 18 }}>
          {[
            { label: "Posts publiés", value: publishedPosts.length },
            { label: "Impressions totales", value: totalImpressions.toLocaleString() },
            { label: "Membres touchés", value: totalReach.toLocaleString() },
            { label: "Vues profil", value: totalProfileViews.toLocaleString() },
          ].map((card) => (
            <div key={card.label} style={{ background: "#fff", borderRadius: 16, padding: 18, border: "1px solid rgba(0,0,0,0.08)" }}>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(18,26,46,0.45)" }}>{card.label}</p>
              <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 700, color: "#121a2e" }}>{card.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.9fr", gap: 18 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 20, border: "1px solid rgba(0,0,0,0.08)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e" }}>Vue analytique</h3>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(18,26,46,0.45)" }}>
                  Taux d’engagement moyen: {averageEngagement.toFixed(2)}%
                </p>
              </div>
              {bestPost && (
                <span style={{ fontSize: 12, color: "#0147ff", fontWeight: 600 }}>
                  Meilleur post: {bestPost.analytics?.reactions ?? bestPost.likes} réactions
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {rankedPosts.slice(0, 8).map((post) => {
                const analytics = normalizeAnalytics(post.analytics);
                const maxValue = Math.max(...rankedPosts.map((entry) => normalizeAnalytics(entry.analytics).impressions), 1);
                const width = `${Math.max(12, (analytics.impressions / maxValue) * 100)}%`;
                return (
                  <div key={post.id}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: "#121a2e", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {post.content}
                      </span>
                      <span style={{ fontSize: 12, color: "rgba(18,26,46,0.45)", whiteSpace: "nowrap" }}>
                        {analytics.impressions.toLocaleString()} impr.
                      </span>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: "#eef1f8", overflow: "hidden" }}>
                      <div style={{ height: "100%", width, borderRadius: 999, background: "linear-gradient(90deg, #7ba6ff, #0147ff)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 18, padding: 20, border: "1px solid rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e" }}>Fiche post</h3>
            {selectedPostId ? (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  ["Lien du post", "postUrl"],
                  ["Date de publication", "publishedDate"],
                  ["Heure", "publishedTime"],
                  ["Lien cliqué", "linkUrl"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)" }}>{label}</label>
                    <input
                      value={toInputValue(editor[key as keyof EditableAnalytics])}
                      onChange={(e) => handleEditorChange(key as keyof EditableAnalytics, e.target.value as never)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                ))}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    ["impressions", "Impressions"],
                    ["reach", "Membres touchés"],
                    ["profileViews", "Vues profil"],
                    ["followersGained", "Abonnés gagnés"],
                    ["socialEngagement", "Engagement social"],
                    ["reactions", "Réactions"],
                    ["comments", "Commentaires"],
                    ["reposts", "Republications"],
                    ["saves", "Enregistrements"],
                    ["sends", "Envois LinkedIn"],
                    ["linkClicks", "Clics lien"],
                    ["customButtonClicks", "Clics bouton"],
                    ["engagementRate", "Taux engagement %"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)" }}>{label}</label>
                      <input
                        type="number"
                        min={0}
                        step={key === "engagementRate" ? "0.1" : "1"}
                        value={toInputValue(editor[key as keyof EditableAnalytics])}
                        onChange={(e) => handleEditorChange(key as keyof EditableAnalytics, Number(e.target.value) as never)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={saveEditor}
                  style={{
                    marginTop: 8,
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "1px solid #2f4d9d",
                    background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Sauvegarder les statistiques
                </button>
              </div>
            ) : (
              <p style={{ marginTop: 12, fontSize: 13, color: "rgba(18,26,46,0.45)" }}>
                Sélectionne un post à gauche pour éditer ses données.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
