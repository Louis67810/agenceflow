"use client";

import { useState, useEffect, useRef } from "react";
import {
  PenLine,
  Plus,
  Trash2,
  Loader2,
  Wand2,
  FileText,
  Copy,
  Check,
  Globe,
  Layers,
  ExternalLink,
  Settings,
  X,
  MessageSquare,
  Minus,
  GripVertical,
  RefreshCw,
  StickyNote,
  Type,
  AlignLeft,
  Square,
  List,
  MousePointerClick,
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

type ElementType = "title" | "subtitle" | "body" | "cta" | "items" | "image";

interface SectionElement {
  id: string;
  type: ElementType;
  content: string;
  note?: string;
  count?: number; // items only
}

interface Section {
  id: string;
  type: SectionType;
  notes: string;
  elements: SectionElement[];
  generating: boolean;
}

interface Page {
  id: string;
  name: string;
  sections: Section[];
}

interface SelectedElement {
  sectionId: string;
  elementId: string;
  elementType: ElementType;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SECTION_TYPES: SectionType[] = [
  "Hero","À propos","Services","Réalisations","Cible","Processus","FAQ","Équipe",
  "Fonctionnalités","Problématiques","Témoignages","Avantages","Tarifs",
  "CTA Principal","Chiffres clés","Comparatif","Contact",
];

const SECTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Hero: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  "À propos": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  Services: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  Réalisations: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200" },
  Cible: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  Processus: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  FAQ: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  Équipe: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  Fonctionnalités: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  Problématiques: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  Témoignages: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  Avantages: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  Tarifs: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "CTA Principal": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  "Chiffres clés": { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  Comparatif: { bg: "bg-lime-50", text: "text-lime-700", border: "border-lime-200" },
  Contact: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
};

const DEFAULT_PROMPTS: Record<string, string> = {
  Hero: "Écris le contenu pour la section Hero du site. Titre accrocheur, sous-titre percutant.",
  "À propos": "Rédige le contenu de présentation de l'entreprise, ses valeurs et sa mission.",
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

const ELEMENT_LABELS: Record<ElementType, string> = {
  title: "Titre",
  subtitle: "Sous-titre",
  body: "Texte",
  cta: "CTA",
  items: "Éléments",
  image: "Image",
};

// ─── Default elements per section type ───────────────────────────────────────

function el(type: ElementType, extras?: Partial<SectionElement>): SectionElement {
  return { id: crypto.randomUUID(), type, content: "", ...extras };
}

const DEFAULT_ELEMENTS: Record<SectionType, () => SectionElement[]> = {
  Hero: () => [el("title"), el("subtitle"), el("body"), el("cta"), el("image")],
  "À propos": () => [el("title"), el("subtitle"), el("body"), el("image"), el("cta")],
  Services: () => [el("title"), el("subtitle"), el("items", { count: 3 }), el("cta")],
  Réalisations: () => [el("title"), el("subtitle"), el("items", { count: 4 })],
  Cible: () => [el("title"), el("subtitle"), el("items", { count: 3 }), el("cta")],
  Processus: () => [el("title"), el("subtitle"), el("items", { count: 4 })],
  FAQ: () => [el("title"), el("subtitle"), el("items", { count: 5 })],
  Équipe: () => [el("title"), el("subtitle"), el("items", { count: 3 }), el("cta")],
  Fonctionnalités: () => [el("title"), el("subtitle"), el("items", { count: 4 }), el("cta")],
  Problématiques: () => [el("title"), el("subtitle"), el("items", { count: 3 }), el("cta")],
  Témoignages: () => [el("title"), el("subtitle"), el("items", { count: 3 }), el("cta")],
  Avantages: () => [el("title"), el("subtitle"), el("items", { count: 4 }), el("cta")],
  Tarifs: () => [el("title"), el("subtitle"), el("items", { count: 3 }), el("cta")],
  "CTA Principal": () => [el("title"), el("subtitle"), el("cta")],
  "Chiffres clés": () => [el("title"), el("subtitle"), el("items", { count: 4 })],
  Comparatif: () => [el("title"), el("subtitle"), el("items", { count: 5 }), el("cta")],
  Contact: () => [el("title"), el("subtitle"), el("body"), el("cta")],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSection(type: SectionType, notes = ""): Section {
  return {
    id: crypto.randomUUID(),
    type,
    notes,
    elements: DEFAULT_ELEMENTS[type]?.() ?? [],
    generating: false,
  };
}

function makePage(name: string): Page {
  return { id: crypto.randomUUID(), name, sections: [] };
}

function parseContent(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw) return result;
  let currentKey = "";
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z][A-Z0-9_]*):\s*(.*)$/);
    if (m) {
      currentKey = m[1];
      result[currentKey] = m[2].trim();
    } else if (currentKey && line.trim()) {
      result[currentKey] = (result[currentKey] ?? "") + "\n" + line.trim();
    }
  }
  return result;
}

function mapContentToElements(rawContent: string, elements: SectionElement[]): SectionElement[] {
  const parsed = parseContent(rawContent);
  return elements.map((e) => {
    if (e.type === "image") return e;
    switch (e.type) {
      case "title":
        return parsed["TITLE"] ? { ...e, content: parsed["TITLE"] } : e;
      case "subtitle":
        return parsed["SUBTITLE"] ? { ...e, content: parsed["SUBTITLE"] } : e;
      case "body":
        return parsed["BODY"] ? { ...e, content: parsed["BODY"] } : e;
      case "cta":
        return parsed["CTA"] ? { ...e, content: parsed["CTA"] } : e;
      case "items": {
        const itemLines = Object.entries(parsed)
          .filter(([k]) => k.startsWith("ITEM_"))
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");
        return itemLines ? { ...e, content: itemLines } : e;
      }
      default:
        return e;
    }
  });
}

function sectionIsGenerated(section: Section): boolean {
  return section.elements.some((e) => e.type !== "image" && e.content !== "");
}

// ─── Wireframe element components ────────────────────────────────────────────
// Style: pill shapes (rounded-full), dark CTA, light image placeholder

function PlaceholderBar({
  w,
  h = "h-4",
  color = "bg-gray-300",
  pulsing,
}: {
  w: string;
  h?: string;
  color?: string;
  pulsing: boolean;
}) {
  return (
    <div
      className={`${h} ${color} rounded-full ${pulsing ? "animate-pulse" : ""}`}
      style={{ width: w }}
    />
  );
}

function WireframeTitleEl({ content, pulsing }: { content: string; pulsing: boolean }) {
  if (content)
    return <p className="font-bold text-gray-900 text-sm leading-snug">{content}</p>;
  return (
    <div className="space-y-2">
      <PlaceholderBar w="76%" h="h-5" color="bg-gray-400" pulsing={pulsing} />
      <PlaceholderBar w="58%" h="h-4" color="bg-gray-300" pulsing={pulsing} />
    </div>
  );
}

function WireframeSubtitleEl({ content, pulsing }: { content: string; pulsing: boolean }) {
  if (content)
    return <p className="text-gray-700 text-xs leading-relaxed">{content}</p>;
  return <PlaceholderBar w="54%" h="h-3.5" color="bg-gray-300" pulsing={pulsing} />;
}

function WireframeBodyEl({ content, pulsing }: { content: string; pulsing: boolean }) {
  if (content)
    return <p className="text-gray-600 text-xs leading-relaxed line-clamp-4">{content}</p>;
  return (
    <div className="space-y-1.5">
      <PlaceholderBar w="100%" h="h-2.5" color="bg-gray-200" pulsing={pulsing} />
      <PlaceholderBar w="93%" h="h-2.5" color="bg-gray-200" pulsing={pulsing} />
      <PlaceholderBar w="78%" h="h-2.5" color="bg-gray-200" pulsing={pulsing} />
    </div>
  );
}

function WireframeCTAEl({ content, pulsing }: { content: string; pulsing: boolean }) {
  return (
    <div className="flex items-center">
      {content ? (
        <span className="inline-flex items-center justify-center h-8 px-5 bg-gray-800 text-white text-xs font-semibold rounded-full whitespace-nowrap">
          {content}
        </span>
      ) : (
        <div
          className={`h-8 bg-gray-800 rounded-full ${pulsing ? "animate-pulse opacity-60" : ""}`}
          style={{ width: "7.5rem" }}
        />
      )}
    </div>
  );
}

function WireframeImageEl({ pulsing }: { pulsing: boolean }) {
  return (
    <div
      className={`w-full h-28 bg-gray-100 rounded-2xl border border-gray-200 ${
        pulsing ? "animate-pulse" : ""
      }`}
    />
  );
}

// Items: per-section-type layouts

function DefaultCardItems({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  const cols = count <= 2 ? count : count <= 4 ? 2 : 3;
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "8px" }}
    >
      {Array.from({ length: count }, (_, i) => {
        const title = parsed[`ITEM_${i + 1}_TITLE`];
        const desc = parsed[`ITEM_${i + 1}_DESC`];
        return (
          <div key={i} className="border border-gray-100 rounded-xl p-2.5 bg-gray-50 space-y-1.5">
            {title ? (
              <p className="text-xs font-semibold text-gray-800 line-clamp-1">{title}</p>
            ) : (
              <PlaceholderBar w="80%" h="h-3" color="bg-gray-300" pulsing={pulsing} />
            )}
            {desc ? (
              <p className="text-xs text-gray-600 line-clamp-2">{desc}</p>
            ) : (
              <div className="space-y-1">
                <PlaceholderBar w="100%" h="h-2.5" color="bg-gray-200" pulsing={pulsing} />
                <PlaceholderBar w="72%" h="h-2.5" color="bg-gray-200" pulsing={pulsing} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FAQItems({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: count }, (_, i) => {
        const q = parsed[`ITEM_${i + 1}_QUESTION`];
        const a = parsed[`ITEM_${i + 1}_ANSWER`];
        return (
          <div key={i} className="border border-gray-100 rounded-lg px-2.5 py-2 bg-gray-50">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs shrink-0">▶</span>
              {q ? (
                <p className="text-xs font-medium text-gray-800 line-clamp-1">{q}</p>
              ) : (
                <PlaceholderBar w="75%" h="h-3" color="bg-gray-300" pulsing={pulsing} />
              )}
            </div>
            {a && <p className="text-xs text-gray-500 mt-1 ml-4 line-clamp-2">{a}</p>}
          </div>
        );
      })}
    </div>
  );
}

function TeamItems({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  return (
    <div className="flex gap-3">
      {Array.from({ length: count }, (_, i) => {
        const name = parsed[`ITEM_${i + 1}_NAME`];
        const role = parsed[`ITEM_${i + 1}_ROLE`];
        return (
          <div key={i} className="flex-1 flex flex-col items-center space-y-1.5">
            <div
              className={`w-10 h-10 rounded-full bg-gray-200 ${pulsing ? "animate-pulse" : ""}`}
            />
            {name ? (
              <p className="text-xs font-semibold text-gray-800 text-center">{name}</p>
            ) : (
              <PlaceholderBar w="80%" h="h-3" color="bg-gray-300" pulsing={pulsing} />
            )}
            {role ? (
              <p className="text-xs text-gray-500 text-center">{role}</p>
            ) : (
              <PlaceholderBar w="60%" h="h-2.5" color="bg-gray-200" pulsing={pulsing} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TestimonialItems({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  return (
    <div className="flex gap-2 overflow-x-hidden">
      {Array.from({ length: Math.min(count, 3) }, (_, i) => {
        const quote = parsed[`ITEM_${i + 1}_QUOTE`];
        const name = parsed[`ITEM_${i + 1}_NAME`];
        const role = parsed[`ITEM_${i + 1}_ROLE`];
        return (
          <div
            key={i}
            className="flex-1 min-w-0 border border-gray-100 rounded-xl p-2.5 bg-purple-50/30 space-y-1.5"
          >
            <span className="text-purple-300 text-lg leading-none block">"</span>
            {quote ? (
              <p className="text-xs text-gray-700 line-clamp-3 italic">{quote}</p>
            ) : (
              <div className="space-y-1">
                <PlaceholderBar w="100%" h="h-2.5" color="bg-gray-200" pulsing={pulsing} />
                <PlaceholderBar w="85%" h="h-2.5" color="bg-gray-200" pulsing={pulsing} />
                <PlaceholderBar w="70%" h="h-2.5" color="bg-gray-200" pulsing={pulsing} />
              </div>
            )}
            <div className="flex items-center gap-1.5 pt-0.5">
              <div
                className={`w-5 h-5 rounded-full bg-gray-200 shrink-0 ${
                  pulsing ? "animate-pulse" : ""
                }`}
              />
              <div className="min-w-0">
                {name ? (
                  <p className="text-xs font-semibold text-gray-800 truncate">{name}</p>
                ) : (
                  <PlaceholderBar w="4rem" h="h-2.5" color="bg-gray-300" pulsing={pulsing} />
                )}
                {role && (
                  <p className="text-xs text-gray-400 truncate">{role}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PricingItems({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: count }, (_, i) => {
        const highlight = i === Math.floor(count / 2);
        const name = parsed[`ITEM_${i + 1}_NAME`];
        const price = parsed[`ITEM_${i + 1}_PRICE`];
        const features = parsed[`ITEM_${i + 1}_FEATURES`];
        const cta = parsed[`ITEM_${i + 1}_CTA`];
        return (
          <div
            key={i}
            className={`flex-1 rounded-xl p-2.5 space-y-1.5 ${
              highlight
                ? "border-2 border-amber-300 bg-amber-50/50 scale-105"
                : "border border-gray-100 bg-gray-50"
            }`}
          >
            {name ? (
              <p className="text-xs font-bold text-gray-800">{name}</p>
            ) : (
              <PlaceholderBar w="65%" h="h-3" color="bg-gray-300" pulsing={pulsing} />
            )}
            {price ? (
              <p className="text-sm font-black text-gray-900">{price}</p>
            ) : (
              <PlaceholderBar w="45%" h="h-5" color="bg-gray-400" pulsing={pulsing} />
            )}
            {features ? (
              features
                .split(";")
                .slice(0, 3)
                .map((f, j) => (
                  <p key={j} className="text-xs text-gray-600 flex items-center gap-1">
                    <span className="text-green-500">✓</span> {f.trim()}
                  </p>
                ))
            ) : (
              [0, 1, 2].map((j) => (
                <PlaceholderBar key={j} w="100%" h="h-2.5" color="bg-gray-200" pulsing={pulsing} />
              ))
            )}
            {cta ? (
              <div className="bg-gray-800 text-white text-xs text-center py-1.5 rounded-full font-medium mt-1">
                {cta}
              </div>
            ) : (
              <div
                className={`h-6 w-full bg-gray-700 rounded-full ${
                  pulsing ? "animate-pulse opacity-60" : ""
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatsItems({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: count }, (_, i) => {
        const num = parsed[`ITEM_${i + 1}_NUMBER`];
        const label = parsed[`ITEM_${i + 1}_LABEL`];
        return (
          <div
            key={i}
            className="flex-1 text-center border border-gray-100 rounded-xl p-2 bg-sky-50/40 space-y-1"
          >
            {num ? (
              <p className="text-base font-black text-sky-700">{num}</p>
            ) : (
              <div className="flex justify-center">
                <PlaceholderBar w="3rem" h="h-6" color="bg-sky-200" pulsing={pulsing} />
              </div>
            )}
            {label ? (
              <p className="text-xs text-gray-600">{label}</p>
            ) : (
              <div className="flex justify-center">
                <PlaceholderBar w="70%" h="h-2.5" color="bg-gray-200" pulsing={pulsing} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProcessItems({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  return (
    <div className="flex items-start">
      {Array.from({ length: count }, (_, i) => {
        const title = parsed[`ITEM_${i + 1}_TITLE`];
        return (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className="flex items-center w-full">
              <div className="w-7 h-7 rounded-full bg-teal-100 border-2 border-teal-300 flex items-center justify-center shrink-0 text-xs font-bold text-teal-600">
                {i + 1}
              </div>
              {i < count - 1 && <div className="flex-1 h-0.5 bg-gray-200" />}
            </div>
            <div className="mt-1.5 w-full text-center">
              {title ? (
                <p className="text-xs font-medium text-gray-700 line-clamp-2">{title}</p>
              ) : (
                <div className="flex justify-center">
                  <PlaceholderBar w="85%" h="h-2.5" color="bg-gray-200" pulsing={pulsing} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ComparativeItems({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  return (
    <div>
      <div className="flex gap-1 mb-1.5 px-1">
        <div className="flex-1" />
        <div className="w-16 text-center text-xs text-gray-400 font-medium">Option A</div>
        <div className="w-16 text-center text-xs text-gray-400 font-medium">Option B</div>
      </div>
      {Array.from({ length: count }, (_, i) => {
        const feature = parsed[`ITEM_${i + 1}_FEATURE`];
        const col1 = parsed[`ITEM_${i + 1}_COL1`];
        const col2 = parsed[`ITEM_${i + 1}_COL2`];
        return (
          <div
            key={i}
            className={`flex gap-1 items-center py-1.5 px-1 rounded ${
              i % 2 === 0 ? "bg-gray-50" : ""
            }`}
          >
            <div className="flex-1">
              {feature ? (
                <p className="text-xs text-gray-700">{feature}</p>
              ) : (
                <PlaceholderBar w="75%" h="h-2.5" color="bg-gray-200" pulsing={pulsing} />
              )}
            </div>
            <div className="w-16 text-center text-xs text-gray-600">{col1 || "—"}</div>
            <div className="w-16 text-center text-xs text-gray-600">{col2 || "—"}</div>
          </div>
        );
      })}
    </div>
  );
}

function WireframeItemsDispatch({
  sectionType,
  element,
  pulsing,
}: {
  sectionType: SectionType;
  element: SectionElement;
  pulsing: boolean;
}) {
  const count = element.count ?? 3;
  const parsed = element.content ? parseContent(element.content) : {};
  const hasItems = Object.keys(parsed).length > 0;

  const common = { parsed: hasItems ? parsed : {}, count, pulsing };

  switch (sectionType) {
    case "FAQ":
      return <FAQItems {...common} />;
    case "Équipe":
      return <TeamItems {...common} />;
    case "Témoignages":
      return <TestimonialItems {...common} />;
    case "Tarifs":
      return <PricingItems {...common} />;
    case "Chiffres clés":
      return <StatsItems {...common} />;
    case "Processus":
      return <ProcessItems {...common} />;
    case "Comparatif":
      return <ComparativeItems {...common} />;
    default:
      return <DefaultCardItems {...common} />;
  }
}

// ─── Add Element Inline UI ────────────────────────────────────────────────────

const ADDABLE_ELEMENTS: { type: ElementType; label: string; icon: React.ReactNode }[] = [
  { type: "title", label: "Titre", icon: <Type size={11} /> },
  { type: "subtitle", label: "Sous-titre", icon: <AlignLeft size={11} /> },
  { type: "body", label: "Texte", icon: <AlignLeft size={11} /> },
  { type: "cta", label: "CTA", icon: <MousePointerClick size={11} /> },
  { type: "items", label: "Éléments", icon: <List size={11} /> },
  { type: "image", label: "Image", icon: <Square size={11} /> },
];

function AddElementInline({ onAdd }: { onAdd: (type: ElementType, note?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ElementType>("body");
  const [note, setNote] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
      >
        <Plus size={11} /> Ajouter un élément
      </button>
    );
  }

  return (
    <div className="border border-dashed border-indigo-200 rounded-xl p-2.5 bg-indigo-50/30 space-y-2">
      <div className="flex flex-wrap gap-1">
        {ADDABLE_ELEMENTS.map((e) => (
          <button
            key={e.type}
            onClick={() => setSelectedType(e.type)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
              selectedType === e.type
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
            }`}
          >
            {e.icon} {e.label}
          </button>
        ))}
      </div>
      <input
        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
        placeholder="Note optionnelle (ex: focus sur l'urgence)..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onAdd(selectedType, note.trim() || undefined);
            setOpen(false);
            setNote("");
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="flex gap-1.5">
        <button
          onClick={() => {
            onAdd(selectedType, note.trim() || undefined);
            setOpen(false);
            setNote("");
          }}
          className="flex-1 text-xs bg-indigo-600 text-white py-1.5 rounded-lg hover:bg-indigo-700 font-medium"
        >
          Ajouter
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-2.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <X size={11} />
        </button>
      </div>
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
  const [globalLanguage, setGlobalLanguage] = useState<"fr" | "en" | "es">("fr");

  // Section-level selection (click)
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set());
  // Element-level selection (ctrl+click)
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);

  // Right panel
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelNoteTarget, setPanelNoteTarget] = useState<SectionType | null>(null);
  const [panelNote, setPanelNote] = useState("");

  // AI bar
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Batch generation
  const [generatingAll, setGeneratingAll] = useState(false);

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({ ...DEFAULT_PROMPTS });
  const [draftPrompts, setDraftPrompts] = useState<Record<string, string>>({ ...DEFAULT_PROMPTS });

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Ctrl key tracking for visual affordance
  const [ctrlHeld, setCtrlHeld] = useState(false);

  const dragSrc = useRef<number | null>(null);

  const activePage = pages.find((p) => p.id === activePageId) ?? null;

  const selectedSections = activePage?.sections.filter((s) =>
    selectedSectionIds.has(s.id)
  ) ?? [];

  const selectedEl =
    selectedElement && activePage
      ? activePage.sections
          .find((s) => s.id === selectedElement.sectionId)
          ?.elements.find((e) => e.id === selectedElement.elementId)
      : null;

  const hasAITarget = selectedSectionIds.size > 0 || selectedElement !== null;
  const ungeneratedCount =
    activePage?.sections.filter((s) => !sectionIsGenerated(s)).length ?? 0;

  // ── Effects ──

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        setProjects(d.projects ?? []);
        setLoadingProjects(false);
      })
      .catch(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("copywriting_custom_prompts");
      if (stored) {
        const p = JSON.parse(stored) as Record<string, string>;
        const merged = { ...DEFAULT_PROMPTS, ...p };
        setCustomPrompts(merged);
        setDraftPrompts(merged);
      }
    } catch {}
  }, []);

  // Persist pages to localStorage whenever they change
  useEffect(() => {
    if (!selectedProject || pages.length === 0) return;
    try {
      localStorage.setItem(
        `copywriting_pages_${selectedProject.id}`,
        JSON.stringify(pages)
      );
    } catch {}
  }, [pages, selectedProject]);

  // Track Ctrl key
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) setCtrlHeld(true);
    };
    const up = () => setCtrlHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", up);
    };
  }, []);

  // ── Project & page helpers ──

  function handleSelectProject(projectId: string) {
    const proj = projects.find((p) => p.id === projectId) ?? null;
    setSelectedProject(proj);
    setSelectedSectionIds(new Set());
    setSelectedElement(null);

    if (proj) {
      try {
        const saved = localStorage.getItem(`copywriting_pages_${proj.id}`);
        if (saved) {
          const savedPages = JSON.parse(saved) as Page[];
          if (savedPages.length > 0) {
            setPages(savedPages);
            setActivePageId(savedPages[0].id);
            return;
          }
        }
      } catch {}
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

  function addSectionFromPanel(type: SectionType) {
    if (!activePage) return;
    const section = makeSection(type, panelNote.trim());
    updatePage(activePage.id, (p) => ({ ...p, sections: [...p.sections, section] }));
    setPanelNoteTarget(null);
    setPanelNote("");
  }

  function removeSection(sectionId: string) {
    if (!activePage) return;
    updatePage(activePage.id, (p) => ({
      ...p,
      sections: p.sections.filter((s) => s.id !== sectionId),
    }));
    setSelectedSectionIds((prev) => {
      const next = new Set(prev);
      next.delete(sectionId);
      return next;
    });
    if (selectedElement?.sectionId === sectionId) setSelectedElement(null);
  }

  // ── Element management ──

  function addElementToSection(
    sectionId: string,
    type: ElementType,
    note?: string
  ) {
    if (!activePage) return;
    const newEl: SectionElement = {
      id: crypto.randomUUID(),
      type,
      content: "",
      note,
      count: type === "items" ? 3 : undefined,
    };
    updateSection(activePage.id, sectionId, (s) => ({
      ...s,
      elements: [...s.elements, newEl],
    }));
  }

  function removeElement(sectionId: string, elementId: string) {
    if (!activePage) return;
    updateSection(activePage.id, sectionId, (s) => ({
      ...s,
      elements: s.elements.filter((e) => e.id !== elementId),
    }));
    if (selectedElement?.elementId === elementId) setSelectedElement(null);
  }

  function changeElementCount(sectionId: string, elementId: string, delta: number) {
    if (!activePage) return;
    updateSection(activePage.id, sectionId, (s) => ({
      ...s,
      elements: s.elements.map((e) =>
        e.id === elementId
          ? { ...e, count: Math.max(1, Math.min(10, (e.count ?? 3) + delta)) }
          : e
      ),
    }));
  }

  // ── Selection ──

  function handleSectionClick(e: React.MouseEvent, sectionId: string) {
    if (e.ctrlKey || e.metaKey) return;
    setSelectedElement(null);
    if (e.shiftKey) {
      setSelectedSectionIds((prev) => {
        const next = new Set(prev);
        if (next.has(sectionId)) next.delete(sectionId);
        else next.add(sectionId);
        return next;
      });
    } else {
      setSelectedSectionIds((prev) => {
        if (prev.size === 1 && prev.has(sectionId)) return new Set();
        return new Set([sectionId]);
      });
    }
  }

  function handleElementCtrlClick(
    e: React.MouseEvent,
    sectionId: string,
    elementId: string,
    elementType: ElementType
  ) {
    e.stopPropagation();
    setSelectedSectionIds(new Set());
    setSelectedElement((prev) =>
      prev?.elementId === elementId ? null : { sectionId, elementId, elementType }
    );
  }

  // ── Generation ──

  async function generateSectionElements(
    sectionId: string,
    instruction?: string,
    specificElementIds?: string[]
  ) {
    if (!activePage || !selectedProject) return;
    const section = activePage.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const elementsToSend = section.elements.filter((e) => {
      if (e.type === "image") return false;
      if (specificElementIds) return specificElementIds.includes(e.id);
      if (instruction) return true;
      return e.content === "";
    });

    if (elementsToSend.length === 0) return;

    updateSection(activePage.id, sectionId, (s) => ({ ...s, generating: true }));

    try {
      const res = await fetch("/api/copywriting/generate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: [
            {
              id: sectionId,
              type: section.type,
              notes: section.notes,
              elements: elementsToSend.map((e) => ({
                id: e.id,
                type: e.type,
                note: e.note,
                count: e.count,
              })),
              ai_instruction: instruction,
              existing_elements: instruction
                ? elementsToSend.map((e) => ({ id: e.id, type: e.type, content: e.content }))
                : undefined,
            },
          ],
          language: globalLanguage,
          form_data: selectedProject.form_data ?? null,
          custom_prompts: customPrompts,
        }),
      });

      const data = await res.json();

      if (res.ok && data.results?.length > 0) {
        const rawContent = data.results[0].content as string;
        updateSection(activePage.id, sectionId, (s) => ({
          ...s,
          generating: false,
          elements: mapContentToElements(rawContent, s.elements),
        }));
      } else {
        updateSection(activePage.id, sectionId, (s) => ({ ...s, generating: false }));
      }
    } catch {
      updateSection(activePage.id, sectionId, (s) => ({ ...s, generating: false }));
    }
  }

  async function generateAll() {
    if (!activePage || !selectedProject) return;

    const sectionsToGen = activePage.sections.filter((s) => !sectionIsGenerated(s));
    if (sectionsToGen.length === 0) return;

    setGeneratingAll(true);

    // Mark all as generating
    updatePage(activePage.id, (p) => ({
      ...p,
      sections: p.sections.map((s) =>
        sectionsToGen.find((tg) => tg.id === s.id) ? { ...s, generating: true } : s
      ),
    }));

    try {
      const res = await fetch("/api/copywriting/generate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: sectionsToGen.map((s) => ({
            id: s.id,
            type: s.type,
            notes: s.notes,
            elements: s.elements
              .filter((e) => e.type !== "image" && e.content === "")
              .map((e) => ({ id: e.id, type: e.type, note: e.note, count: e.count })),
          })),
          language: globalLanguage,
          form_data: selectedProject.form_data ?? null,
          custom_prompts: customPrompts,
        }),
      });

      const data = await res.json();

      if (res.ok && data.results) {
        const map: Record<string, string> = {};
        for (const r of data.results as { id: string; content: string }[]) {
          map[r.id] = r.content;
        }
        updatePage(activePage.id, (p) => ({
          ...p,
          sections: p.sections.map((s) => ({
            ...s,
            generating: false,
            elements: map[s.id] !== undefined ? mapContentToElements(map[s.id], s.elements) : s.elements,
          })),
        }));
      } else {
        updatePage(activePage.id, (p) => ({
          ...p,
          sections: p.sections.map((s) => ({ ...s, generating: false })),
        }));
      }
    } catch {
      updatePage(activePage.id, (p) => ({
        ...p,
        sections: p.sections.map((s) => ({ ...s, generating: false })),
      }));
    }

    setGeneratingAll(false);
  }

  async function applyAIModification(mode: "modify" | "variant") {
    if (!activePage || !selectedProject) return;
    if (mode === "modify" && !aiInstruction.trim()) return;

    setAiLoading(true);
    const instruction =
      mode === "variant" ? "Génère une variante alternative et créative" : aiInstruction;

    if (selectedElement) {
      // Single element operation
      const section = activePage.sections.find((s) => s.id === selectedElement.sectionId);
      const targetEl = section?.elements.find((e) => e.id === selectedElement.elementId);
      if (section && targetEl) {
        await generateSectionElements(section.id, instruction, [targetEl.id]);
      }
    } else {
      // Section-level: operate on all selected sections
      for (const section of selectedSections) {
        await generateSectionElements(section.id, instruction);
      }
    }

    setAiLoading(false);
    if (mode === "modify") setAiInstruction("");
  }

  function copyContent(sectionId: string) {
    const section = activePage?.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const text = section.elements
      .filter((e) => e.content)
      .map((e) => `[${ELEMENT_LABELS[e.type]}]\n${e.content}`)
      .join("\n\n");
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(sectionId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function exportPage() {
    if (!activePage) return;
    const lines: string[] = [`# ${activePage.name}\n`];
    activePage.sections.forEach((s, i) => {
      lines.push(`## ${i + 1}. ${s.type}`);
      s.elements.forEach((e) => {
        if (e.content)
          lines.push(`### ${ELEMENT_LABELS[e.type]}\n${e.content}`);
      });
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activePage.name.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function savePrompts() {
    setCustomPrompts(draftPrompts);
    try {
      localStorage.setItem("copywriting_custom_prompts", JSON.stringify(draftPrompts));
    } catch {}
    setSettingsOpen(false);
  }

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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── Left sidebar ── */}
      <div className="w-56 border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            <PenLine size={15} className="text-indigo-600" />
            <h2 className="font-semibold text-sm text-gray-900">Copywriting</h2>
          </div>
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
          {selectedProject && (
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-gray-400 mb-1">
                <Globe size={10} /> Langue de la page
              </label>
              <select
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                value={globalLanguage}
                onChange={(e) => setGlobalLanguage(e.target.value as "fr" | "en" | "es")}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
          )}
        </div>

        {selectedProject && (
          <div className="flex-1 overflow-y-auto py-2">
            <p className="px-4 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
              Pages
            </p>
            {pages.map((page) => (
              <div
                key={page.id}
                className={`group flex items-center gap-2 px-4 py-2 cursor-pointer text-sm transition-colors ${
                  page.id === activePageId
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => {
                  setActivePageId(page.id);
                  setSelectedSectionIds(new Set());
                  setSelectedElement(null);
                }}
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

        <div className="border-t border-gray-100 p-3">
          <button
            onClick={() => {
              setDraftPrompts({ ...customPrompts });
              setSettingsOpen(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings size={13} /> Prompts par défaut
          </button>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
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
            <div className="border-b border-gray-200 px-5 py-3 flex items-center justify-between bg-white shrink-0">
              <div>
                <h1 className="font-semibold text-gray-900 text-sm">{activePage.name}</h1>
                <p className="text-xs text-gray-400">
                  {selectedProject.name} · {activePage.sections.length} section
                  {activePage.sections.length !== 1 ? "s" : ""}
                  {ungeneratedCount > 0 && (
                    <span className="text-orange-500 ml-1">
                      · {ungeneratedCount} non générée{ungeneratedCount > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {ctrlHeld && (
                  <span className="text-xs text-blue-500 font-medium animate-pulse">
                    ⌃ Cliquer sur un élément pour le sélectionner
                  </span>
                )}
                {ungeneratedCount > 0 && (
                  <button
                    onClick={generateAll}
                    disabled={generatingAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  >
                    {generatingAll ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Wand2 size={12} />
                    )}
                    Générer tout ({ungeneratedCount})
                  </button>
                )}
                <button
                  onClick={exportPage}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                >
                  <ExternalLink size={12} /> Exporter
                </button>
                <button
                  onClick={() => setPanelOpen((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                    panelOpen
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Plus size={12} /> Sections
                </button>
              </div>
            </div>

            {/* Canvas + right panel */}
            <div className="flex flex-1 overflow-hidden">
              {/* Canvas */}
              <div
                className="flex-1 overflow-y-auto p-5 pb-28"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setSelectedSectionIds(new Set());
                    setSelectedElement(null);
                  }
                }}
              >
                <div className="max-w-2xl mx-auto space-y-4">
                  {activePage.sections.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                      <Layers size={32} className="text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">Aucune section</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Ajoutez des sections depuis le panneau droit.
                      </p>
                      {!panelOpen && (
                        <button
                          onClick={() => setPanelOpen(true)}
                          className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                        >
                          Ouvrir le panneau
                        </button>
                      )}
                    </div>
                  ) : (
                    activePage.sections.map((section, idx) => {
                      const color = SECTION_COLORS[section.type] ?? {
                        bg: "bg-gray-50",
                        text: "text-gray-600",
                        border: "border-gray-200",
                      };
                      const isSectionSelected = selectedSectionIds.has(section.id);
                      const isGenerated = sectionIsGenerated(section);

                      return (
                        <div
                          key={section.id}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => handleSectionClick(e, section.id)}
                          className={`bg-white rounded-2xl border-2 transition-all overflow-hidden cursor-pointer ${
                            isSectionSelected
                              ? "border-blue-500 shadow-lg shadow-blue-100"
                              : "border-gray-100 hover:border-gray-200"
                          }`}
                        >
                          {/* Section header */}
                          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50">
                            <div
                              className="text-gray-300 cursor-grab active:cursor-grabbing shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical size={14} />
                            </div>
                            <span className="text-xs text-gray-400 font-mono w-4 shrink-0">
                              {idx + 1}
                            </span>
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${color.bg} ${color.text} ${color.border}`}
                            >
                              {section.type}
                            </span>
                            {section.notes && (
                              <span className="text-xs text-gray-400 truncate italic">
                                {section.notes}
                              </span>
                            )}
                            <div
                              className="ml-auto flex items-center gap-1.5 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {section.generating ? (
                                <span className="flex items-center gap-1 text-xs text-indigo-500">
                                  <Loader2 size={11} className="animate-spin" /> Génération...
                                </span>
                              ) : isGenerated ? (
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                  <Check size={11} /> Généré
                                </span>
                              ) : null}
                              <button
                                onClick={() => generateSectionElements(section.id)}
                                disabled={section.generating}
                                title={isGenerated ? "Régénérer" : "Générer"}
                                className="p-1 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
                              >
                                {section.generating ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : isGenerated ? (
                                  <RefreshCw size={13} />
                                ) : (
                                  <Wand2 size={13} />
                                )}
                              </button>
                              {isGenerated && (
                                <button
                                  onClick={() => copyContent(section.id)}
                                  title="Copier"
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                  {copiedId === section.id ? (
                                    <Check size={13} className="text-green-500" />
                                  ) : (
                                    <Copy size={13} />
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => removeSection(section.id)}
                                className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Elements */}
                          <div className="px-5 py-4 space-y-3.5">
                            {section.elements.map((element) => {
                              const isElSelected =
                                selectedElement?.elementId === element.id;

                              return (
                                <div
                                  key={element.id}
                                  className={`relative group/el ${
                                    ctrlHeld && !isElSelected
                                      ? "hover:ring-1 hover:ring-blue-200 hover:rounded-lg cursor-pointer"
                                      : ""
                                  } ${
                                    isElSelected
                                      ? "ring-2 ring-blue-400 ring-offset-2 rounded-lg p-1 -m-1 bg-blue-50/30"
                                      : ""
                                  }`}
                                  onClick={(e) =>
                                    handleElementCtrlClick(
                                      e,
                                      section.id,
                                      element.id,
                                      element.type
                                    )
                                  }
                                >
                                  {/* Delete element on hover */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeElement(section.id, element.id);
                                    }}
                                    className="absolute -top-1.5 -right-1.5 z-10 opacity-0 group-hover/el:opacity-100 bg-white border border-red-200 text-red-400 hover:text-red-600 rounded-full w-4 h-4 flex items-center justify-center shadow-sm transition-opacity"
                                  >
                                    <X size={9} />
                                  </button>

                                  {/* Element visual */}
                                  {element.type === "title" && (
                                    <WireframeTitleEl
                                      content={element.content}
                                      pulsing={section.generating}
                                    />
                                  )}
                                  {element.type === "subtitle" && (
                                    <WireframeSubtitleEl
                                      content={element.content}
                                      pulsing={section.generating}
                                    />
                                  )}
                                  {element.type === "body" && (
                                    <WireframeBodyEl
                                      content={element.content}
                                      pulsing={section.generating}
                                    />
                                  )}
                                  {element.type === "cta" && (
                                    <WireframeCTAEl
                                      content={element.content}
                                      pulsing={section.generating}
                                    />
                                  )}
                                  {element.type === "image" && (
                                    <WireframeImageEl pulsing={section.generating} />
                                  )}
                                  {element.type === "items" && (
                                    <div>
                                      <div
                                        className="flex items-center gap-2 mb-2"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <span className="text-xs text-gray-400 font-medium">
                                          Éléments
                                        </span>
                                        <div className="flex items-center gap-0.5 bg-gray-100 rounded-md px-1.5 py-0.5 ml-auto">
                                          <button
                                            onClick={() =>
                                              changeElementCount(section.id, element.id, -1)
                                            }
                                            className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-800"
                                          >
                                            <Minus size={9} />
                                          </button>
                                          <span className="text-xs text-gray-700 w-4 text-center font-medium">
                                            {element.count ?? 3}
                                          </span>
                                          <button
                                            onClick={() =>
                                              changeElementCount(section.id, element.id, 1)
                                            }
                                            className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-800"
                                          >
                                            <Plus size={9} />
                                          </button>
                                        </div>
                                      </div>
                                      <WireframeItemsDispatch
                                        sectionType={section.type}
                                        element={element}
                                        pulsing={section.generating}
                                      />
                                    </div>
                                  )}

                                  {/* Note badge */}
                                  {element.note && (
                                    <p className="text-xs text-gray-400 italic mt-1 flex items-center gap-0.5">
                                      <StickyNote size={9} /> {element.note}
                                    </p>
                                  )}
                                </div>
                              );
                            })}

                            {/* Add element button */}
                            <div onClick={(e) => e.stopPropagation()}>
                              <AddElementInline
                                onAdd={(type, note) =>
                                  addElementToSection(section.id, type, note)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right panel */}
              {panelOpen && (
                <div className="w-56 border-l border-gray-200 bg-white flex flex-col shrink-0 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-700">Ajouter une section</p>
                    <button
                      onClick={() => setPanelOpen(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
                    {SECTION_TYPES.map((type) => {
                      const color = SECTION_COLORS[type] ?? {
                        bg: "bg-gray-50",
                        text: "text-gray-600",
                        border: "border-gray-200",
                      };
                      const isExpanded = panelNoteTarget === type;
                      return (
                        <div key={type}>
                          <button
                            onClick={() => {
                              if (isExpanded) {
                                setPanelNoteTarget(null);
                                setPanelNote("");
                              } else {
                                setPanelNoteTarget(type);
                                setPanelNote("");
                              }
                            }}
                            disabled={!activePage}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                              isExpanded
                                ? `${color.bg} ${color.text} ${color.border} border`
                                : "hover:bg-gray-50 text-gray-700"
                            } disabled:opacity-40`}
                          >
                            <span>{type}</span>
                            <Plus
                              size={11}
                              className={isExpanded ? color.text : "text-gray-400"}
                            />
                          </button>
                          {isExpanded && (
                            <div className="mx-1 mt-1 mb-2 p-2 border border-gray-200 rounded-lg bg-gray-50 space-y-2">
                              <input
                                autoFocus
                                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white"
                                placeholder="Note optionnelle..."
                                value={panelNote}
                                onChange={(e) => setPanelNote(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") addSectionFromPanel(type);
                                  if (e.key === "Escape") {
                                    setPanelNoteTarget(null);
                                    setPanelNote("");
                                  }
                                }}
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={() => addSectionFromPanel(type)}
                                  className="flex-1 text-xs bg-indigo-600 text-white py-1.5 rounded hover:bg-indigo-700 font-medium"
                                >
                                  Ajouter
                                </button>
                                <button
                                  onClick={() => {
                                    setPanelNoteTarget(null);
                                    setPanelNote("");
                                  }}
                                  className="px-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded"
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* AI modification bar */}
            {hasAITarget && (
              <div className="fixed bottom-0 left-56 right-0 z-40 bg-white border-t border-gray-200 shadow-lg px-5 py-3 flex items-center gap-3">
                <span
                  className={`text-xs font-medium shrink-0 ${
                    selectedElement ? "text-blue-600" : "text-indigo-600"
                  }`}
                >
                  {selectedElement
                    ? `${ELEMENT_LABELS[selectedElement.elementType]} sélectionné`
                    : `${selectedSectionIds.size} section${
                        selectedSectionIds.size > 1 ? "s" : ""
                      } sélectionnée${selectedSectionIds.size > 1 ? "s" : ""}`}
                </span>
                <button
                  onClick={() => {
                    setSelectedSectionIds(new Set());
                    setSelectedElement(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 shrink-0"
                >
                  <X size={14} />
                </button>
                <div className="w-px h-5 bg-gray-200 shrink-0" />
                <div className="flex-1 relative">
                  <MessageSquare
                    size={12}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                  <input
                    className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="Instruction IA… ex : rends le texte plus percutant"
                    value={aiInstruction}
                    onChange={(e) => setAiInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && aiInstruction.trim())
                        applyAIModification("modify");
                    }}
                  />
                </div>
                <button
                  onClick={() => applyAIModification("modify")}
                  disabled={!aiInstruction.trim() || aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  {aiLoading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Wand2 size={12} />
                  )}
                  Appliquer
                </button>
                <button
                  onClick={() => applyAIModification("variant")}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors shrink-0"
                >
                  <RefreshCw size={12} /> Variante
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Prompt settings modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="font-semibold text-gray-900">Prompts par défaut</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Configurez les instructions envoyées à l'IA pour chaque type de section.
                </p>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {SECTION_TYPES.map((type) => {
                const color = SECTION_COLORS[type] ?? {
                  bg: "bg-gray-50",
                  text: "text-gray-600",
                  border: "border-gray-200",
                };
                return (
                  <div key={type}>
                    <label
                      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border mb-1.5 ${color.bg} ${color.text} ${color.border}`}
                    >
                      {type}
                    </label>
                    <textarea
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                      rows={2}
                      value={draftPrompts[type] ?? ""}
                      onChange={(e) =>
                        setDraftPrompts((prev) => ({ ...prev, [type]: e.target.value }))
                      }
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setDraftPrompts({ ...DEFAULT_PROMPTS })}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Restaurer les défauts
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={savePrompts}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
