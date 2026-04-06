"use client";

import { useState, useEffect, useRef } from "react";
import {
  PenLine,
  Plus,
  Trash2,
  ChevronDown,
  Loader2,
  GripVertical,
  Wand2,
  RefreshCw,
  FileText,
  Copy,
  Check,
  AlertCircle,
  Globe,
  Hash,
  StickyNote,
  Layers,
  ExternalLink,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  form_data?: Record<string, unknown>;
}

type SectionType =
  | "Hero"
  | "À propos"
  | "Services"
  | "Réalisations"
  | "Cible"
  | "Processus"
  | "FAQ"
  | "Équipe"
  | "Fonctionnalités"
  | "Problématiques"
  | "Témoignages"
  | "Avantages"
  | "Tarifs"
  | "CTA Principal"
  | "Chiffres clés"
  | "Comparatif"
  | "Contact";

const SECTION_TYPES: SectionType[] = [
  "Hero",
  "À propos",
  "Services",
  "Réalisations",
  "Cible",
  "Processus",
  "FAQ",
  "Équipe",
  "Fonctionnalités",
  "Problématiques",
  "Témoignages",
  "Avantages",
  "Tarifs",
  "CTA Principal",
  "Chiffres clés",
  "Comparatif",
  "Contact",
];

const SECTION_COLORS: Record<string, string> = {
  Hero: "bg-indigo-50 border-indigo-200 text-indigo-700",
  "À propos": "bg-blue-50 border-blue-200 text-blue-700",
  Services: "bg-violet-50 border-violet-200 text-violet-700",
  Réalisations: "bg-pink-50 border-pink-200 text-pink-700",
  Cible: "bg-orange-50 border-orange-200 text-orange-700",
  Processus: "bg-teal-50 border-teal-200 text-teal-700",
  FAQ: "bg-yellow-50 border-yellow-200 text-yellow-700",
  Équipe: "bg-cyan-50 border-cyan-200 text-cyan-700",
  Fonctionnalités: "bg-emerald-50 border-emerald-200 text-emerald-700",
  Problématiques: "bg-red-50 border-red-200 text-red-700",
  Témoignages: "bg-purple-50 border-purple-200 text-purple-700",
  Avantages: "bg-green-50 border-green-200 text-green-700",
  Tarifs: "bg-amber-50 border-amber-200 text-amber-700",
  "CTA Principal": "bg-rose-50 border-rose-200 text-rose-700",
  "Chiffres clés": "bg-sky-50 border-sky-200 text-sky-700",
  Comparatif: "bg-lime-50 border-lime-200 text-lime-700",
  Contact: "bg-slate-50 border-slate-200 text-slate-700",
};

const DEFAULT_PROMPTS: Record<string, string> = {
  Hero: "Écris un titre accrocheur et un sous-titre percutant pour la section Hero du site. Inclus un appel à l'action principal.",
  "À propos": "Rédige un texte de présentation de l'entreprise, ses valeurs et sa mission.",
  Services: "Décris les services proposés avec leurs bénéfices clés pour le client.",
  Réalisations: "Rédige des descriptions courtes pour les projets/réalisations mis en avant.",
  Cible: "Décris le profil du client idéal et ses problématiques principales.",
  Processus: "Explique le processus de travail étape par étape, de façon claire et rassurante.",
  FAQ: "Génère les questions fréquentes avec leurs réponses.",
  Équipe: "Présente les membres de l'équipe avec leurs rôles et expertises.",
  Fonctionnalités: "Liste les fonctionnalités principales du produit/service avec leurs bénéfices.",
  Problématiques: "Identifie et décris les problèmes que rencontrent les clients cibles.",
  Témoignages: "Génère des témoignages clients réalistes et convaincants.",
  Avantages: "Mets en avant les avantages concurrentiels et différenciateurs.",
  Tarifs: "Rédige les descriptions et argumentaires pour chaque offre tarifaire.",
  "CTA Principal": "Crée un call-to-action percutant avec titre, sous-titre et bouton.",
  "Chiffres clés": "Génère des chiffres clés et statistiques impactantes avec leurs libellés.",
  Comparatif: "Crée un comparatif clair entre les différentes offres ou par rapport à la concurrence.",
  Contact: "Rédige le texte d'invitation au contact avec les informations clés.",
};

interface Section {
  id: string;
  type: SectionType;
  prompt: string;
  notes: string;
  language: string;
  element_count: number;
  generated: string;
  variants: string[];
  generating: boolean;
  expanded: boolean;
}

interface Page {
  id: string;
  name: string;
  sections: Section[];
}

function makeSection(type: SectionType): Section {
  return {
    id: crypto.randomUUID(),
    type,
    prompt: DEFAULT_PROMPTS[type] ?? "",
    notes: "",
    language: "fr",
    element_count: 3,
    generated: "",
    variants: [],
    generating: false,
    expanded: true,
  };
}

function makePage(name: string): Page {
  return { id: crypto.randomUUID(), name, sections: [] };
}

// ─── Wireframe Block ──────────────────────────────────────────────────────────

function WireframeBlock({ section }: { section: Section }) {
  const color = SECTION_COLORS[section.type] ?? "bg-gray-50 border-gray-200 text-gray-600";
  return (
    <div className={`rounded border px-3 py-2 text-xs font-medium ${color}`}>
      {section.type}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CopywritingPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [newPageName, setNewPageName] = useState("");
  const [showNewPage, setShowNewPage] = useState(false);
  const [addSectionType, setAddSectionType] = useState<SectionType>("Hero");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "wireframe">("edit");
  const dragSrc = useRef<number | null>(null);

  const activePage = pages.find((p) => p.id === activePageId) ?? null;

  // Load projects on mount
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        setProjects(d.projects ?? []);
        setLoadingProjects(false);
      })
      .catch(() => setLoadingProjects(false));
  }, []);

  // Init default page when project selected
  function handleSelectProject(projectId: string) {
    const proj = projects.find((p) => p.id === projectId) ?? null;
    setSelectedProject(proj);
    if (proj) {
      const home = makePage("Page d'accueil");
      setPages([home]);
      setActivePageId(home.id);
    }
  }

  function updatePages(fn: (pages: Page[]) => Page[]) {
    setPages((prev) => fn(prev));
  }

  function updatePage(pageId: string, fn: (page: Page) => Page) {
    updatePages((pages) => pages.map((p) => (p.id === pageId ? fn(p) : p)));
  }

  function updateSection(pageId: string, sectionId: string, fn: (s: Section) => Section) {
    updatePage(pageId, (page) => ({
      ...page,
      sections: page.sections.map((s) => (s.id === sectionId ? fn(s) : s)),
    }));
  }

  function addPage() {
    if (!newPageName.trim()) return;
    const page = makePage(newPageName.trim());
    setPages((prev) => [...prev, page]);
    setActivePageId(page.id);
    setNewPageName("");
    setShowNewPage(false);
  }

  function deletePage(pageId: string) {
    setPages((prev) => {
      const filtered = prev.filter((p) => p.id !== pageId);
      if (activePageId === pageId) setActivePageId(filtered[0]?.id ?? null);
      return filtered;
    });
  }

  function addSection() {
    if (!activePage) return;
    const section = makeSection(addSectionType);
    updatePage(activePage.id, (p) => ({ ...p, sections: [...p.sections, section] }));
  }

  function removeSection(sectionId: string) {
    if (!activePage) return;
    updatePage(activePage.id, (p) => ({
      ...p,
      sections: p.sections.filter((s) => s.id !== sectionId),
    }));
  }

  async function generateSection(sectionId: string) {
    if (!activePage || !selectedProject) return;
    const section = activePage.sections.find((s) => s.id === sectionId);
    if (!section) return;

    updateSection(activePage.id, sectionId, (s) => ({ ...s, generating: true }));

    try {
      const res = await fetch("/api/copywriting/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_type: section.type,
          prompt: section.prompt,
          notes: section.notes,
          language: section.language,
          element_count: section.element_count,
          form_data: selectedProject.form_data ?? null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        updateSection(activePage.id, sectionId, (s) => ({
          ...s,
          generated: data.content ?? "",
          generating: false,
        }));
      } else {
        updateSection(activePage.id, sectionId, (s) => ({
          ...s,
          generating: false,
          generated: `Erreur: ${data.error}`,
        }));
      }
    } catch (e) {
      updateSection(activePage.id, sectionId, (s) => ({
        ...s,
        generating: false,
        generated: `Erreur: ${String(e)}`,
      }));
    }
  }

  async function generateVariants(sectionId: string) {
    if (!activePage || !selectedProject) return;
    const section = activePage.sections.find((s) => s.id === sectionId);
    if (!section || !section.generated) return;

    updateSection(activePage.id, sectionId, (s) => ({ ...s, generating: true }));

    const variantResults: string[] = [];
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch("/api/copywriting/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            section_type: section.type,
            prompt: section.prompt + " (variante alternative)",
            notes: section.notes,
            language: section.language,
            element_count: section.element_count,
            form_data: selectedProject.form_data ?? null,
          }),
        });
        const data = await res.json();
        if (res.ok) variantResults.push(data.content ?? "");
      } catch {
        variantResults.push("Erreur lors de la génération");
      }
    }

    updateSection(activePage.id, sectionId, (s) => ({
      ...s,
      variants: variantResults,
      generating: false,
    }));
  }

  function copyContent(sectionId: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(sectionId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function exportStructure() {
    if (!activePage) return;
    const lines: string[] = [`# ${activePage.name}\n`];
    activePage.sections.forEach((s, i) => {
      lines.push(`## ${i + 1}. ${s.type}`);
      if (s.generated) lines.push(`\n${s.generated}\n`);
      else lines.push("_(non généré)_\n");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activePage.name.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Drag & drop handlers
  function handleDragStart(idx: number) {
    dragSrc.current = idx;
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragSrc.current === null || dragSrc.current === idx || !activePage) return;
    const sections = [...activePage.sections];
    const [moved] = sections.splice(dragSrc.current, 1);
    sections.splice(idx, 0, moved);
    dragSrc.current = idx;
    updatePage(activePage.id, (p) => ({ ...p, sections }));
  }

  function handleDragEnd() {
    dragSrc.current = null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Left sidebar: Pages ── */}
      <div className="w-56 border-r border-gray-200 bg-gray-50 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <PenLine size={16} className="text-indigo-600" />
            <h2 className="font-semibold text-sm text-gray-900">Copywriting</h2>
          </div>

          {/* Project selector */}
          {loadingProjects ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 size={12} className="animate-spin" /> Chargement...
            </div>
          ) : (
            <select
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
              value={selectedProject?.id ?? ""}
              onChange={(e) => handleSelectProject(e.target.value)}
            >
              <option value="">— Choisir un projet —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Pages list */}
        {selectedProject && (
          <div className="flex-1 overflow-y-auto py-2">
            <p className="px-4 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide">Pages</p>
            {pages.map((page) => (
              <div
                key={page.id}
                className={`group flex items-center gap-2 px-4 py-2 cursor-pointer text-sm transition-colors ${
                  page.id === activePageId
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => setActivePageId(page.id)}
              >
                <FileText size={13} className="shrink-0" />
                <span className="flex-1 truncate">{page.name}</span>
                {pages.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePage(page.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}

            {/* New page */}
            {showNewPage ? (
              <div className="px-3 py-2 flex gap-1">
                <input
                  autoFocus
                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  placeholder="Nom de la page"
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addPage();
                    if (e.key === "Escape") setShowNewPage(false);
                  }}
                />
                <button
                  onClick={addPage}
                  className="text-xs bg-indigo-600 text-white px-2 rounded hover:bg-indigo-700"
                >
                  OK
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewPage(true)}
                className="w-full text-left px-4 py-2 text-xs text-gray-400 hover:text-indigo-600 flex items-center gap-1.5 hover:bg-gray-100"
              >
                <Plus size={12} /> Nouvelle page
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!selectedProject ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <PenLine size={40} className="text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Sélectionnez un projet</p>
              <p className="text-gray-400 text-sm mt-1">
                Choisissez un projet dans la barre latérale pour commencer.
              </p>
            </div>
          </div>
        ) : !activePage ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400">Aucune page sélectionnée.</p>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div className="border-b border-gray-200 px-6 py-3 flex items-center justify-between bg-white shrink-0">
              <div>
                <h1 className="font-semibold text-gray-900">{activePage.name}</h1>
                <p className="text-xs text-gray-400">
                  {selectedProject.name} · {activePage.sections.length} section
                  {activePage.sections.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* View toggle */}
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setView("edit")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      view === "edit" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
                    }`}
                  >
                    Éditeur
                  </button>
                  <button
                    onClick={() => setView("wireframe")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      view === "wireframe" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
                    }`}
                  >
                    Wireframe
                  </button>
                </div>

                {/* Export */}
                <button
                  onClick={exportStructure}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                >
                  <ExternalLink size={13} />
                  Exporter
                </button>

                {/* Google Docs placeholder */}
                <button
                  onClick={() => alert("Connexion Google Docs — fonctionnalité à venir.")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                >
                  <FileText size={13} className="text-blue-500" />
                  Google Docs
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {view === "wireframe" ? (
                /* ── Wireframe view ── */
                <div className="max-w-lg mx-auto space-y-2">
                  <div className="bg-gray-100 rounded-xl p-4 border border-gray-200 mb-4">
                    <p className="text-xs text-gray-500 text-center font-medium mb-3">
                      Aperçu wireframe — {activePage.name}
                    </p>
                    <div className="space-y-2">
                      {activePage.sections.length === 0 ? (
                        <div className="h-16 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-xs text-gray-400">
                          Aucune section
                        </div>
                      ) : (
                        activePage.sections.map((s) => (
                          <WireframeBlock key={s.id} section={s} />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Editor view ── */
                <div className="max-w-3xl mx-auto space-y-4">
                  {activePage.sections.length === 0 && (
                    <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
                      <Layers size={32} className="text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">Aucune section</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Ajoutez des sections ci-dessous pour construire votre page.
                      </p>
                    </div>
                  )}

                  {activePage.sections.map((section, idx) => (
                    <SectionCard
                      key={section.id}
                      section={section}
                      idx={idx}
                      pageId={activePage.id}
                      copiedId={copiedId}
                      onUpdate={(fn) => updateSection(activePage.id, section.id, fn)}
                      onRemove={() => removeSection(section.id)}
                      onGenerate={() => generateSection(section.id)}
                      onGenerateVariants={() => generateVariants(section.id)}
                      onCopy={(text) => copyContent(section.id, text)}
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                    />
                  ))}

                  {/* Add section bar */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                    <select
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                      value={addSectionType}
                      onChange={(e) => setAddSectionType(e.target.value as SectionType)}
                    >
                      {SECTION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={addSection}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
                    >
                      <Plus size={16} />
                      Ajouter section
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Section Card Component ───────────────────────────────────────────────────

interface SectionCardProps {
  section: Section;
  idx: number;
  pageId: string;
  copiedId: string | null;
  onUpdate: (fn: (s: Section) => Section) => void;
  onRemove: () => void;
  onGenerate: () => void;
  onGenerateVariants: () => void;
  onCopy: (text: string) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function SectionCard({
  section,
  idx,
  copiedId,
  onUpdate,
  onRemove,
  onGenerate,
  onGenerateVariants,
  onCopy,
  onDragStart,
  onDragOver,
  onDragEnd,
}: SectionCardProps) {
  const [activeVariant, setActiveVariant] = useState<number | null>(null);
  const color = SECTION_COLORS[section.type] ?? "bg-gray-50 border-gray-200 text-gray-600";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => onUpdate((s) => ({ ...s, expanded: !s.expanded }))}
      >
        <div className="text-gray-300 cursor-grab active:cursor-grabbing" onClick={(e) => e.stopPropagation()}>
          <GripVertical size={16} />
        </div>
        <span className="text-xs text-gray-400 font-mono w-5">{idx + 1}</span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${color}`}>
          {section.type}
        </span>
        <div className="flex-1" />
        {section.generated && (
          <span className="text-xs text-green-600 font-medium flex items-center gap-1">
            <Check size={12} /> Généré
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-gray-300 hover:text-red-500 transition-colors"
        >
          <Trash2 size={14} />
        </button>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform ${section.expanded ? "rotate-180" : ""}`}
        />
      </div>

      {/* Body */}
      {section.expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Prompt */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
              <Wand2 size={12} /> Prompt
            </label>
            <textarea
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              rows={3}
              value={section.prompt}
              onChange={(e) => onUpdate((s) => ({ ...s, prompt: e.target.value }))}
              placeholder="Décris ce que tu veux générer pour cette section..."
            />
          </div>

          {/* Row: notes + language + count */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                <Globe size={12} /> Langue
              </label>
              <select
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                value={section.language}
                onChange={(e) => onUpdate((s) => ({ ...s, language: e.target.value }))}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
            <div className="col-span-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                <Hash size={12} /> Éléments
              </label>
              <input
                type="number"
                min={1}
                max={20}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={section.element_count}
                onChange={(e) => onUpdate((s) => ({ ...s, element_count: Number(e.target.value) }))}
              />
            </div>
            <div className="col-span-1 flex flex-col">
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                <StickyNote size={12} /> Notes
              </label>
              <input
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="Notes..."
                value={section.notes}
                onChange={(e) => onUpdate((s) => ({ ...s, notes: e.target.value }))}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onGenerate}
              disabled={section.generating}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {section.generating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wand2 size={14} />
              )}
              {section.generated ? "Régénérer" : "Générer"}
            </button>

            {section.generated && (
              <>
                <button
                  onClick={onGenerateVariants}
                  disabled={section.generating}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={14} />3 variantes
                </button>
                <button
                  onClick={() => onCopy(section.generated)}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {copiedId === section.id ? (
                    <Check size={14} className="text-green-500" />
                  ) : (
                    <Copy size={14} />
                  )}
                  Copier
                </button>
              </>
            )}
          </div>

          {/* Generated content */}
          {section.generated && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Contenu généré</p>
                <textarea
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-gray-50"
                  rows={8}
                  value={section.generated}
                  onChange={(e) => onUpdate((s) => ({ ...s, generated: e.target.value }))}
                />
              </div>

              {/* Variants */}
              {section.variants.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    Variantes ({section.variants.length})
                  </p>
                  <div className="flex gap-2 mb-2">
                    {section.variants.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveVariant(activeVariant === i ? null : i)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          activeVariant === i
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "border-gray-200 text-gray-600 hover:border-indigo-300"
                        }`}
                      >
                        Variante {i + 1}
                      </button>
                    ))}
                  </div>
                  {activeVariant !== null && (
                    <div className="relative">
                      <textarea
                        className="w-full text-sm border border-indigo-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-indigo-50/30"
                        rows={8}
                        value={section.variants[activeVariant]}
                        onChange={(e) => {
                          const newVariants = [...section.variants];
                          newVariants[activeVariant] = e.target.value;
                          onUpdate((s) => ({ ...s, variants: newVariants }));
                        }}
                      />
                      <button
                        onClick={() => {
                          onUpdate((s) => ({
                            ...s,
                            generated: s.variants[activeVariant!],
                          }));
                          setActiveVariant(null);
                        }}
                        className="absolute top-2 right-2 text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                      >
                        Utiliser
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error display */}
          {section.generated.startsWith("Erreur:") && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <p>{section.generated}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
