"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter } from "lucide-react";
import { ProjectCard } from "@/components/shared/ProjectCard";
import { StatusBadge } from "@/components/agency/StatusBadge";
import type { Project, ProjectStatus } from "@/types/agency";

// Mock data - remplacer par Supabase
const mockProjects: Project[] = [
  {
    id: "1",
    name: "Site web Startup XYZ",
    description: "Refonte complète du site vitrine avec Framer",
    status: "in_progress",
    client_id: "c1",
    client: { id: "c1", name: "Martin Dupont", email: "martin@xyz.com", created_at: "", payment_status: "paid" },
    designer_id: "d1",
    designer: { id: "d1", name: "Sarah K.", email: "sarah@agency.com", created_at: "" },
    current_stage: "design",
    stages: [
      { stage: "copywriting", label: "Copywriting", duration_days: 5, completed: true },
      { stage: "wireframe", label: "Wireframe", duration_days: 7, completed: true },
      { stage: "design", label: "Design", duration_days: 14, completed: false },
      { stage: "development", label: "Développement", duration_days: 10, completed: false },
      { stage: "revision", label: "Révisions", duration_days: 5, completed: false },
    ],
    deadline: "2026-03-28",
    created_at: "2026-01-15",
    updated_at: "2026-03-20",
  },
  {
    id: "2",
    name: "Identité visuelle Brand Co",
    description: "Logo, charte graphique, brand book",
    status: "review",
    client_id: "c2",
    client: { id: "c2", name: "Sophie Laurent", email: "sophie@brandco.fr", created_at: "", payment_status: "paid" },
    current_stage: "revision",
    stages: [
      { stage: "copywriting", label: "Copywriting", duration_days: 3, completed: true },
      { stage: "design", label: "Design", duration_days: 21, completed: true },
      { stage: "revision", label: "Révisions", duration_days: 7, completed: false },
    ],
    deadline: "2026-03-30",
    created_at: "2026-02-01",
    updated_at: "2026-03-18",
  },
  {
    id: "3",
    name: "App mobile TechStart",
    description: "Design UI/UX pour application de gestion",
    status: "in_progress",
    client_id: "c3",
    client: { id: "c3", name: "Pierre Martin", email: "pierre@techstart.io", created_at: "", payment_status: "partial" },
    designer_id: "d2",
    designer: { id: "d2", name: "Tom A.", email: "tom@agency.com", created_at: "" },
    current_stage: "wireframe",
    stages: [
      { stage: "copywriting", label: "Copywriting", duration_days: 3, completed: true },
      { stage: "wireframe", label: "Wireframe", duration_days: 10, completed: false },
      { stage: "design", label: "Design", duration_days: 20, completed: false },
      { stage: "revision", label: "Révisions", duration_days: 7, completed: false },
    ],
    deadline: "2026-04-15",
    created_at: "2026-02-20",
    updated_at: "2026-03-15",
  },
];

const filterStatuses: { label: string; value: ProjectStatus | "all" }[] = [
  { label: "Tous", value: "all" },
  { label: "En cours", value: "in_progress" },
  { label: "En révision", value: "review" },
  { label: "Terminés", value: "completed" },
  { label: "En attente", value: "pending" },
];

export default function AdminProjectsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");

  const filtered = mockProjects.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client?.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projets</h1>
          <p className="text-gray-500 mt-1">{mockProjects.length} projets au total</p>
        </div>
        <Link
          href="/admin/projects/new"
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Nouveau projet
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un projet ou client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          />
        </div>
        <div className="flex items-center gap-2">
          {filterStatuses.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} basePath="/admin/projects" />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <FolderKanban className="mx-auto mb-3 opacity-30" size={40} />
          <p className="font-medium">Aucun projet trouvé</p>
          <p className="text-sm mt-1">Modifiez vos filtres ou créez un nouveau projet</p>
        </div>
      )}
    </div>
  );
}

function FolderKanban(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size || 24}
      height={props.size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      <path d="M8 10v4" />
      <path d="M12 10v2" />
      <path d="M16 10v6" />
    </svg>
  );
}
