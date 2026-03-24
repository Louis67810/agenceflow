"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types/agency";

export function useChat(projectId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (data) setMessages(data);
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`messages:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchMessages, supabase]);

  const sendMessage = useCallback(
    async (content: string, senderId: string, senderName: string, senderRole: string) => {
      const { error } = await supabase.from("messages").insert({
        project_id: projectId,
        sender_id: senderId,
        sender_name: senderName,
        sender_role: senderRole,
        content,
        source: "app",
      });
      return !error;
    },
    [projectId, supabase]
  );

  return { messages, loading, sendMessage };
}
