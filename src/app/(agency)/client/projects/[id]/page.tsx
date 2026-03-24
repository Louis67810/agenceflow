"use client";

import { useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Send, ExternalLink, CheckCircle, Clock } from "lucide-react";
import { StageTimeline } from "@/components/shared/StageTimeline";
import { StatusBadge } from "@/components/agency/StatusBadge";

const mockProject = {
  id: "1",
  name: "Site web Startup XYZ",
  description: "Refonte complète du site vitrine avec animations Framer",
  status: "in_progress" as const,
  current_stage: "design" as const,
  stages: [
    { stage: "copywriting" as const, label: "Copywriting", duration_days: 5, completed: true, completed_at: "2026-01-25" },
    { stage: "wireframe" as const, label: "Wireframe", duration_days: 7, completed: true, completed_at: "2026-02-05" },
    { stage: "design" as const, label: "Design", duration_days: 14, completed: false },
    { stage: "development" as const, label: "Développement", duration_days: 10, completed: false },
    { stage: "revision" as const, label: "Révisions", duration_days: 5, completed: false },
  ],
  deadline: "2026-03-28",
  figma_url: "https://figma.com/...",
};

const mockMessages = [
  { id: "m1", sender: "Équipe AgenceFlow", role: "admin" as const, content: "Bonjour Martin ! Le wireframe est terminé, vous pouvez le consulter sur Figma. N'hésitez pas si vous avez des retours !", time: "Il y a 2 jours" },
  { id: "m2", sender: "Martin Dupont", role: "client" as const, content: "Super ! J'ai regardé le wireframe, c'est exactement ce que j'imaginais. On peut commencer le design !", time: "Hier" },
  { id: "m3", sender: "Équipe AgenceFlow", role: "admin" as const, content: "Parfait ! Le design V1 sera prêt d'ici vendredi. On vous envoie un lien dès que c'est prêt.", time: "Hier" },
];

export default function ClientProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  use(params); // params resolved but id not used directly in this component
  const [message, setMessage] = useState("");
  const project = mockProject;

  return (
    <div className="p-8">
      <Link href="/client/projects" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition-colors">
        <ArrowLeft size={16} />
        Retour
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-gray-500">{project.description}</p>
        </div>
        {project.figma_url && (
          <a
            href={project.figma_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            <ExternalLink size={14} />
            Voir les maquettes
          </a>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Avancement</h2>
        <StageTimeline stages={project.stages} currentStage={project.current_stage} />
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Clock size={14} />
            Deadline : {new Date(project.deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Messages */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Messages avec l&apos;équipe</h2>
          </div>
          <div className="flex flex-col" style={{ height: "400px" }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {mockMessages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "client" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${msg.role === "admin" ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600"}`}>
                    {msg.sender.charAt(0)}
                  </div>
                  <div className={`flex flex-col ${msg.role === "client" ? "items-end" : "items-start"}`}>
                    <span className="text-xs text-gray-400 mb-1">{msg.sender}</span>
                    <div className={`px-3 py-2 rounded-lg text-sm max-w-xs ${msg.role === "client" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                      {msg.content}
                    </div>
                    <span className="text-xs text-gray-400 mt-1">{msg.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Votre message..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  onClick={() => setMessage("")}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Étapes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Détail des étapes</h3>
          <div className="space-y-3">
            {project.stages.map((stage) => (
              <div key={stage.stage} className="flex items-start gap-3">
                {stage.completed ? (
                  <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                ) : stage.stage === project.current_stage ? (
                  <div className="w-4 h-4 rounded-full bg-indigo-500 shrink-0 mt-0.5 animate-pulse" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-medium ${stage.completed ? "text-green-700" : stage.stage === project.current_stage ? "text-indigo-700" : "text-gray-400"}`}>
                    {stage.label}
                  </p>
                  <p className="text-xs text-gray-400">{stage.duration_days} jours</p>
                  {stage.completed && stage.completed_at && (
                    <p className="text-xs text-green-500">
                      Validé le {new Date(stage.completed_at).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
