"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Mail,
  Star,
  FolderKanban,
  X,
  Check,
  ChevronRight,
  Code2,
  Pen,
  ArrowLeft,
  ClipboardList,
} from "lucide-react";
import type { Designer } from "@/types/agency";

interface ExtendedDesigner extends Designer {
  rating?: number;
  projects_done?: number;
  bio?: string;
}

const mockPrestataires: ExtendedDesigner[] = [
  {
    id: "d1",
    name: "Sarah Kimura",
    email: "sarah@agency.com",
    speciality: "UI/UX Design",
    hourly_rate: 65,
    role: "designer",
    rating: 4.9,
    projects_done: 12,
    bio: "Designer UI/UX spécialisée dans les interfaces SaaS et les expériences web haut de gamme.",
    created_at: "2025-06-01",
  },
  {
    id: "d2",
    name: "Tom Andersson",
    email: "tom@agency.com",
    speciality: "Motion Design",
    hourly_rate: 60,
    role: "designer",
    rating: 4.7,
    projects_done: 8,
    bio: "Spécialiste motion design et animations Framer. Donne vie aux interfaces.",
    created_at: "2025-08-15",
  },
  {
    id: "d3",
    name: "Léa Moreau",
    email: "lea@agency.com",
    speciality: "Branding & Identité",
    hourly_rate: 70,
    role: "designer",
    rating: 5.0,
    projects_done: 15,
    bio: "Experte en identité visuelle, logotype et charte graphique pour startups.",
    created_at: "2025-10-01",
  },
  {
    id: "dev1",
    name: "Karim Benali",
    email: "karim@agency.com",
    speciality: "Next.js / Framer",
    hourly_rate: 75,
    role: "developer",
    rating: 4.8,
    projects_done: 10,
    bio: "Développeur full-stack React/Next.js avec une forte appétence pour Framer et les animations web.",
    created_at: "2025-07-10",
  },
  {
    id: "dev2",
    name: "Nina Jobert",
    email: "nina@agency.com",
    speciality: "React / TypeScript",
    hourly_rate: 70,
    role: "developer",
    rating: 4.6,
    projects_done: 7,
    bio: "Développeuse front-end React/TypeScript, intégration pixel-perfect de maquettes Figma.",
    created_at: "2025-11-20",
  },
];

const assignedProjects: Record<string, number> = {
  d1: 2,
  d2: 1,
  d3: 1,
  dev1: 2,
  dev2: 0,
};

const mockProjects = [
  { id: "1", name: "Site web Startup XYZ", client: "Martin Dupont" },
  { id: "2", name: "Identité visuelle Brand Co", client: "Sophie L." },
  { id: "3", name: "App mobile TechStart", client: "Pierre M." },
  { id: "4", name: "Dashboard SaaS Metrics", client: "Anna R." },
];

const recentProjectsByPrestataire: Record<string, { name: string; status: string; year: string }[]> = {
  d1: [
    { name: "Refonte Startup XYZ", status: "Terminé", year: "2026" },
    { name: "App mobile TechStart", status: "En cours", year: "2026" },
    { name: "Dashboard SaaS Metrics", status: "Terminé", year: "2025" },
  ],
  d2: [
    { name: "Identité visuelle Brand Co", status: "En cours", year: "2026" },
    { name: "Landing page EcoStore", status: "Terminé", year: "2025" },
  ],
  d3: [
    { name: "Logo & Charte NovaBrand", status: "Terminé", year: "2025" },
    { name: "Identité visuelle Brand Co", status: "En cours", year: "2026" },
  ],
  dev1: [
    { name: "Intégration Framer XYZ", status: "En cours", year: "2026" },
    { name: "Dashboard SaaS Metrics", status: "Terminé", year: "2025" },
  ],
  dev2: [
    { name: "App mobile TechStart", status: "Terminé", year: "2025" },
  ],
};

type FilterRole = "all" | "designer" | "developer";

export default function AdminDesignersPage() {
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<FilterRole>("all");
  const [selectedProfile, setSelectedProfile] = useState<ExtendedDesigner | null>(null);
  const [assignModal, setAssignModal] = useState<ExtendedDesigner | null>(null);
  const [assignedTo, setAssignedTo] = useState<Record<string, string[]>>({
    d1: ["1", "3"],
    dev1: ["1", "4"],
  });

  const filtered = mockPrestataires.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.speciality?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || p.role === filterRole;
    return matchSearch && matchRole;
  });

  const toggleAssign = (prestaId: string, projectId: string) => {
    setAssignedTo((prev) => {
      const current = prev[prestaId] ?? [];
      if (current.includes(projectId)) {
        return { ...prev, [prestaId]: current.filter((id) => id !== projectId) };
      }
      return { ...prev, [prestaId]: [...current, projectId] };
    });
  };

  const roleColor = (role: "designer" | "developer") =>
    role === "designer"
      ? "bg-purple-50 text-purple-700"
      : "bg-blue-50 text-blue-700";

  const roleIcon = (role: "designer" | "developer") =>
    role === "designer" ? <Pen size={10} /> : <Code2 size={10} />;

  const roleLabel = (role: "designer" | "developer") =>
    role === "designer" ? "Designer" : "Développeur";

  return (
    <div className="p-8">
      {/* Profile slide-over */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/30"
            onClick={() => setSelectedProfile(null)}
          />
          <div className="w-[440px] bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
              <button
                onClick={() => setSelectedProfile(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={16} className="text-gray-500" />
              </button>
              <h2 className="font-semibold text-gray-900">Profil prestataire</h2>
            </div>

            {/* Body */}
            <div className="p-6 flex-1">
              {/* Avatar + identity */}
              <div className="flex items-start gap-4 mb-6">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0 ${
                    selectedProfile.role === "designer"
                      ? "bg-purple-100 text-purple-600"
                      : "bg-blue-100 text-blue-600"
                  }`}
                >
                  {selectedProfile.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900">
                    {selectedProfile.name}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${roleColor(selectedProfile.role)}`}
                  >
                    {roleIcon(selectedProfile.role)}
                    {roleLabel(selectedProfile.role)}
                  </span>
                  {selectedProfile.speciality && (
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedProfile.speciality}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                    <Mail size={12} />
                    {selectedProfile.email}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {assignedProjects[selectedProfile.id] || 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Projets actifs</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedProfile.projects_done ?? 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Terminés</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <p className="text-2xl font-bold text-gray-900">
                      {selectedProfile.rating ?? "-"}
                    </p>
                    <Star size={14} className="text-yellow-500 fill-yellow-500" />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Note</p>
                </div>
              </div>

              {/* Bio */}
              {selectedProfile.bio && (
                <div className="mb-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Bio
                  </p>
                  <p className="text-sm text-gray-700">{selectedProfile.bio}</p>
                </div>
              )}

              {/* Recent projects */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Projets récents
                </p>
                <div className="space-y-2">
                  {(recentProjectsByPrestataire[selectedProfile.id] ?? []).map(
                    (proj) => (
                      <div
                        key={proj.name}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <FolderKanban size={14} className="text-gray-400" />
                          <span className="text-sm text-gray-800">
                            {proj.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              proj.status === "Terminé"
                                ? "bg-green-50 text-green-700"
                                : "bg-indigo-50 text-indigo-700"
                            }`}
                          >
                            {proj.status}
                          </span>
                          <span className="text-xs text-gray-400">
                            {proj.year}
                          </span>
                        </div>
                      </div>
                    )
                  )}
                  {!(recentProjectsByPrestataire[selectedProfile.id]?.length) && (
                    <p className="text-sm text-gray-400">Aucun projet</p>
                  )}
                </div>
              </div>

              {/* Onboarding test placeholder */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Test d&apos;onboarding prestataire
                </p>
                <div className="flex items-start gap-3 p-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl">
                  <ClipboardList size={16} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-500">
                      Le test prestataire sera disponible prochainement. Vous pourrez évaluer les compétences techniques et créatives avant l&apos;assignation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setAssignModal(selectedProfile);
                  setSelectedProfile(null);
                }}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <FolderKanban size={15} />
                Assigner à un projet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setAssignModal(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900">Assigner à un projet</h3>
                <p className="text-xs text-gray-500 mt-0.5">{assignModal.name}</p>
              </div>
              <button
                onClick={() => setAssignModal(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {mockProjects.map((project) => {
                const isAssigned = (assignedTo[assignModal.id] ?? []).includes(project.id);
                return (
                  <button
                    key={project.id}
                    onClick={() => toggleAssign(assignModal.id, project.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                      isAssigned
                        ? "border-indigo-300 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FolderKanban
                        size={15}
                        className={isAssigned ? "text-indigo-500" : "text-gray-400"}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {project.name}
                        </p>
                        <p className="text-xs text-gray-500">{project.client}</p>
                      </div>
                    </div>
                    {isAssigned && (
                      <Check size={15} className="text-indigo-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setAssignModal(null)}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prestataires</h1>
          <p className="text-gray-500 mt-1">
            {mockPrestataires.length} prestataires ·{" "}
            {mockPrestataires.filter((p) => p.role === "designer").length} designers ·{" "}
            {mockPrestataires.filter((p) => p.role === "developer").length} développeurs
          </p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus size={16} />
          Inviter un prestataire
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(["all", "designer", "developer"] as FilterRole[]).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filterRole === r
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {r === "all" ? "Tous" : r === "designer" ? "Designers" : "Développeurs"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-4">
        {filtered.map((presta) => (
          <div
            key={presta.id}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => setSelectedProfile(presta)}
          >
            {/* Top */}
            <div className="flex items-start justify-between mb-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                  presta.role === "designer"
                    ? "bg-purple-100 text-purple-600"
                    : "bg-blue-100 text-blue-600"
                }`}
              >
                {presta.name.charAt(0)}
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${roleColor(presta.role)}`}
                >
                  {roleIcon(presta.role)}
                  {roleLabel(presta.role)}
                </span>
                {presta.rating && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-full font-medium">
                    <Star size={10} className="fill-yellow-500" />
                    {presta.rating}
                  </span>
                )}
              </div>
            </div>

            {/* Info */}
            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors mb-0.5">
              {presta.name}
            </h3>
            {presta.speciality && (
              <p className="text-xs text-gray-500 mb-3">{presta.speciality}</p>
            )}

            {/* Stats */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 mb-4">
              <div>
                <p className="text-xs text-gray-400">Projets actifs</p>
                <p className="font-bold text-gray-900">
                  {assignedProjects[presta.id] || 0}
                </p>
              </div>
              {presta.hourly_rate && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">TJ</p>
                  <p className="font-bold text-gray-900">
                    {presta.hourly_rate * 8}€
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAssignModal(presta);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 border border-gray-200 rounded-lg text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors font-medium"
              >
                <FolderKanban size={12} />
                Assigner
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedProfile(presta);
                }}
                className="flex items-center gap-1 text-xs py-2 px-3 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Profil
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
