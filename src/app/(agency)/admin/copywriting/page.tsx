"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Minus,
  GripVertical,
  AlertCircle,
  RefreshCw,
  StickyNote,
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

const DEFAULT_ELEMENT_COUNTS: Record<string, number> = {
  Hero: 1,
  "À propos": 1,
  Services: 3,
  Réalisations: 4,
  Cible: 3,
  Processus: 4,
  FAQ: 5,
  Équipe: 3,
  Fonctionnalités: 4,
  Problématiques: 3,
  Témoignages: 3,
  Avantages: 4,
  Tarifs: 3,
  "CTA Principal": 1,
  "Chiffres clés": 4,
  Comparatif: 5,
  Contact: 1,
};

const MULTI_ITEM_TYPES: SectionType[] = [
  "Services",
  "Réalisations",
  "Processus",
  "FAQ",
  "Équipe",
  "Fonctionnalités",
  "Problématiques",
  "Témoignages",
  "Avantages",
  "Tarifs",
  "Chiffres clés",
  "Comparatif",
  "Cible",
];

interface Section {
  id: string;
  type: SectionType;
  notes: string;
  element_count: number;
  generated: string;
  generating: boolean;
}

interface Page {
  id: string;
  name: string;
  sections: Section[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSection(type: SectionType, notes = ""): Section {
  return {
    id: crypto.randomUUID(),
    type,
    notes,
    element_count: DEFAULT_ELEMENT_COUNTS[type] ?? 3,
    generated: "",
    generating: false,
  };
}

function makePage(name: string): Page {
  return { id: crypto.randomUUID(), name, sections: [] };
}

function isMultiItem(type: SectionType): boolean {
  return MULTI_ITEM_TYPES.includes(type);
}

/** Parse KEY: value structured content into a map */
function parseContent(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw) return result;
  const lines = raw.split("\n");
  let currentKey = "";
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+):\s*(.*)$/);
    if (m) {
      currentKey = m[1];
      result[currentKey] = m[2];
    } else if (currentKey && line.trim()) {
      result[currentKey] = (result[currentKey] ?? "") + "\n" + line.trim();
    }
  }
  return result;
}

/** Extract item fields: ITEM_1_TITLE, ITEM_1_DESC, etc. */
function getItems(
  parsed: Record<string, string>,
  count: number,
  fields: string[]
): Record<string, string>[] {
  return Array.from({ length: count }, (_, i) => {
    const item: Record<string, string> = {};
    for (const f of fields) {
      item[f] = parsed[`ITEM_${i + 1}_${f}`] ?? "";
    }
    return item;
  });
}

// ─── Wireframe Slot ───────────────────────────────────────────────────────────

function Slot({
  value,
  h = "h-3",
  w = "w-full",
  className = "",
  pulsing = false,
}: {
  value?: string;
  h?: string;
  w?: string;
  className?: string;
  pulsing?: boolean;
}) {
  if (value) {
    return (
      <span className={`text-gray-800 block text-xs leading-tight ${className}`}>
        {value}
      </span>
    );
  }
  return (
    <div
      className={`bg-gray-200 rounded ${h} ${w} ${className} ${pulsing ? "animate-pulse" : ""}`}
    />
  );
}

// ─── Section Wireframe Layouts ────────────────────────────────────────────────

function HeroWireframe({ parsed, pulsing }: { parsed: Record<string, string>; pulsing: boolean }) {
  return (
    <div className="space-y-2 py-2 text-center">
      <Slot value={parsed.TITLE} h="h-6" w="w-3/4" className="mx-auto font-bold text-sm" pulsing={pulsing} />
      <Slot value={parsed.SUBTITLE} h="h-4" w="w-1/2" className="mx-auto" pulsing={pulsing} />
      <Slot value={parsed.BODY} h="h-3" w="w-2/3" className="mx-auto" pulsing={pulsing} />
      <div className="flex justify-center pt-2">
        {parsed.BUTTON_TEXT ? (
          <span className="inline-block bg-indigo-100 text-indigo-700 text-xs px-4 py-1.5 rounded-lg font-medium">
            {parsed.BUTTON_TEXT}
          </span>
        ) : (
          <div className={`h-7 w-28 bg-gray-300 rounded-lg ${pulsing ? "animate-pulse" : ""}`} />
        )}
      </div>
    </div>
  );
}

function AboutWireframe({ parsed, pulsing }: { parsed: Record<string, string>; pulsing: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-1">
      <div className={`col-span-1 bg-gray-200 rounded-lg h-20 ${pulsing ? "animate-pulse" : ""}`} />
      <div className="col-span-2 space-y-1.5">
        <Slot value={parsed.TITLE} h="h-4" w="w-3/4" className="font-semibold" pulsing={pulsing} />
        <Slot value={parsed.BODY} h="h-3" w="w-full" pulsing={pulsing} />
        <Slot h="h-3" w="w-full" pulsing={pulsing} />
        <Slot h="h-3" w="w-4/5" pulsing={pulsing} />
      </div>
    </div>
  );
}

function CardsWireframe({
  parsed,
  count,
  titleField = "TITLE",
  descField = "DESC",
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  titleField?: string;
  descField?: string;
  pulsing: boolean;
}) {
  const items = getItems(parsed, count, [titleField, descField]);
  const cols = count <= 2 ? count : count <= 4 ? 2 : 3;
  return (
    <div
      className="py-1"
      style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "8px" }}
    >
      {items.map((item, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-2 space-y-1 bg-gray-50">
          <Slot value={item[titleField]} h="h-3" w="w-4/5" className="font-medium" pulsing={pulsing} />
          <Slot value={item[descField]} h="h-2.5" w="w-full" pulsing={pulsing} />
          <Slot h="h-2.5" w="w-4/5" pulsing={pulsing} />
        </div>
      ))}
    </div>
  );
}

function GridImagesWireframe({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  const items = getItems(parsed, count, ["TITLE", "DESC"]);
  return (
    <div className="flex gap-2 overflow-x-auto py-1">
      {items.map((item, i) => (
        <div key={i} className="shrink-0 w-24 space-y-1">
          <div className={`h-16 bg-gray-200 rounded-lg ${pulsing ? "animate-pulse" : ""}`} />
          <Slot value={item.TITLE} h="h-3" w="w-full" className="font-medium text-center" pulsing={pulsing} />
        </div>
      ))}
    </div>
  );
}

function ProcessWireframe({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  const items = getItems(parsed, count, ["TITLE", "DESC"]);
  return (
    <div className="py-2">
      <div className="flex items-start gap-1">
        {items.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className="flex items-center w-full">
              <div className="w-7 h-7 rounded-full bg-teal-100 border-2 border-teal-300 flex items-center justify-center shrink-0 text-xs font-bold text-teal-600">
                {i + 1}
              </div>
              {i < items.length - 1 && <div className="flex-1 h-0.5 bg-gray-200" />}
            </div>
            <div className="mt-1 w-full space-y-1">
              <Slot value={item.TITLE} h="h-3" w="w-full" className="font-medium text-center" pulsing={pulsing} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FAQWireframe({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  const items = getItems(parsed, count, ["QUESTION", "ANSWER"]);
  return (
    <div className="space-y-1.5 py-1">
      {items.map((item, i) => (
        <div key={i} className="border border-gray-200 rounded px-2 py-1.5 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 text-gray-400 shrink-0 text-xs">▶</div>
            <Slot value={item.QUESTION} h="h-3" w="w-full" className="font-medium" pulsing={pulsing} />
          </div>
          {item.ANSWER && (
            <p className="text-xs text-gray-600 mt-1 ml-5 line-clamp-2">{item.ANSWER}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function TeamWireframe({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  const items = getItems(parsed, count, ["NAME", "ROLE", "BIO"]);
  return (
    <div className="flex gap-3 py-1">
      {items.map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center space-y-1">
          <div className={`w-10 h-10 rounded-full bg-gray-200 ${pulsing ? "animate-pulse" : ""}`} />
          <Slot value={item.NAME} h="h-3" w="w-4/5" className="font-semibold text-center" pulsing={pulsing} />
          <Slot value={item.ROLE} h="h-2.5" w="w-3/5" className="text-center" pulsing={pulsing} />
        </div>
      ))}
    </div>
  );
}

function TestimonialsWireframe({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  const items = getItems(parsed, count, ["QUOTE", "NAME", "ROLE"]);
  return (
    <div className="flex gap-2 py-1 overflow-x-auto">
      {items.map((item, i) => (
        <div key={i} className="shrink-0 flex-1 min-w-0 border border-gray-200 rounded-lg p-2 bg-purple-50/30 space-y-1">
          <div className="text-purple-300 text-xs">"</div>
          <Slot value={item.QUOTE} h="h-3" w="w-full" pulsing={pulsing} />
          <Slot h="h-2.5" w="w-4/5" pulsing={pulsing} />
          <div className="flex items-center gap-1 mt-1">
            <div className={`w-5 h-5 rounded-full bg-gray-200 ${pulsing ? "animate-pulse" : ""}`} />
            <Slot value={item.NAME} h="h-2.5" w="w-16" className="font-medium" pulsing={pulsing} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PricingWireframe({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  const items = getItems(parsed, count, ["NAME", "PRICE", "FEATURES", "CTA"]);
  return (
    <div className="flex gap-2 py-1">
      {items.map((item, i) => (
        <div
          key={i}
          className={`flex-1 border rounded-lg p-2 space-y-1 ${
            i === Math.floor(count / 2)
              ? "border-amber-300 bg-amber-50/50 scale-105"
              : "border-gray-200 bg-gray-50"
          }`}
        >
          <Slot value={item.NAME} h="h-3.5" w="w-3/4" className="font-bold" pulsing={pulsing} />
          <Slot value={item.PRICE} h="h-6" w="w-1/2" className="font-black text-base" pulsing={pulsing} />
          {item.FEATURES
            ? item.FEATURES.split(";")
                .slice(0, 3)
                .map((f, j) => (
                  <p key={j} className="text-xs text-gray-600 flex items-center gap-1">
                    <span className="text-green-500">✓</span> {f.trim()}
                  </p>
                ))
            : [0, 1, 2].map((j) => <Slot key={j} h="h-2.5" w="w-full" pulsing={pulsing} />)}
          {item.CTA ? (
            <div className="bg-amber-100 text-amber-700 text-xs text-center py-1 rounded font-medium mt-1">
              {item.CTA}
            </div>
          ) : (
            <div className={`h-6 w-full bg-gray-200 rounded ${pulsing ? "animate-pulse" : ""}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function StatsWireframe({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  const items = getItems(parsed, count, ["NUMBER", "LABEL"]);
  return (
    <div className="flex gap-2 py-1">
      {items.map((item, i) => (
        <div key={i} className="flex-1 text-center border border-gray-100 rounded-lg p-2 bg-sky-50/40 space-y-1">
          <Slot value={item.NUMBER} h="h-7" w="w-3/5" className="mx-auto font-black text-base text-sky-700" pulsing={pulsing} />
          <Slot value={item.LABEL} h="h-2.5" w="w-4/5" className="mx-auto" pulsing={pulsing} />
        </div>
      ))}
    </div>
  );
}

function CtaWireframe({ parsed, pulsing }: { parsed: Record<string, string>; pulsing: boolean }) {
  return (
    <div className="bg-gray-800/5 rounded-xl py-4 px-4 text-center space-y-2">
      <Slot value={parsed.TITLE} h="h-6" w="w-2/3" className="mx-auto font-bold text-sm" pulsing={pulsing} />
      <Slot value={parsed.SUBTITLE} h="h-3.5" w="w-1/2" className="mx-auto" pulsing={pulsing} />
      <div className="flex justify-center pt-1">
        {parsed.BUTTON_TEXT ? (
          <span className="bg-rose-100 text-rose-700 text-xs px-6 py-2 rounded-lg font-bold">
            {parsed.BUTTON_TEXT}
          </span>
        ) : (
          <div className={`h-8 w-36 bg-gray-300 rounded-lg ${pulsing ? "animate-pulse" : ""}`} />
        )}
      </div>
    </div>
  );
}

function ComparativeWireframe({
  parsed,
  count,
  pulsing,
}: {
  parsed: Record<string, string>;
  count: number;
  pulsing: boolean;
}) {
  const items = getItems(parsed, count, ["FEATURE", "COL1", "COL2"]);
  return (
    <div className="py-1">
      <div className="flex gap-1 mb-1">
        <div className="flex-1" />
        <div className="w-16 text-center text-xs text-gray-500 font-medium">Option A</div>
        <div className="w-16 text-center text-xs text-gray-500 font-medium">Option B</div>
      </div>
      {items.map((item, i) => (
        <div key={i} className={`flex gap-1 items-center py-1 ${i % 2 === 0 ? "bg-gray-50" : ""} rounded px-1`}>
          <div className="flex-1">
            <Slot value={item.FEATURE} h="h-3" w="w-full" pulsing={pulsing} />
          </div>
          <div className="w-16 text-center text-xs text-gray-600">{item.COL1 || "—"}</div>
          <div className="w-16 text-center text-xs text-gray-600">{item.COL2 || "—"}</div>
        </div>
      ))}
    </div>
  );
}

function ContactWireframe({ parsed, pulsing }: { parsed: Record<string, string>; pulsing: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 py-1">
      <div className="space-y-1.5">
        <Slot value={parsed.TITLE} h="h-4" w="w-3/4" className="font-semibold" pulsing={pulsing} />
        <Slot value={parsed.SUBTITLE} h="h-3" w="w-full" pulsing={pulsing} />
        <Slot value={parsed.BODY} h="h-3" w="w-4/5" pulsing={pulsing} />
      </div>
      <div className="space-y-1.5">
        <div className={`h-6 w-full bg-gray-200 rounded ${pulsing ? "animate-pulse" : ""}`} />
        <div className={`h-6 w-full bg-gray-200 rounded ${pulsing ? "animate-pulse" : ""}`} />
        <div className={`h-10 w-full bg-gray-200 rounded ${pulsing ? "animate-pulse" : ""}`} />
        {parsed.BUTTON_TEXT ? (
          <div className="bg-slate-100 text-slate-700 text-xs text-center py-1.5 rounded font-medium">
            {parsed.BUTTON_TEXT}
          </div>
        ) : (
          <div className={`h-6 w-24 bg-gray-200 rounded ${pulsing ? "animate-pulse" : ""}`} />
        )}
      </div>
    </div>
  );
}

function SectionWireframe({ section }: { section: Section }) {
  const parsed = parseContent(section.generated);
  const pulsing = section.generating;

  switch (section.type) {
    case "Hero":
      return <HeroWireframe parsed={parsed} pulsing={pulsing} />;
    case "À propos":
      return <AboutWireframe parsed={parsed} pulsing={pulsing} />;
    case "Services":
      return (
        <CardsWireframe
          parsed={parsed}
          count={section.element_count}
          titleField="TITLE"
          descField="DESC"
          pulsing={pulsing}
        />
      );
    case "Réalisations":
      return <GridImagesWireframe parsed={parsed} count={section.element_count} pulsing={pulsing} />;
    case "Cible":
      return (
        <CardsWireframe
          parsed={parsed}
          count={section.element_count}
          titleField="TITLE"
          descField="DESC"
          pulsing={pulsing}
        />
      );
    case "Processus":
      return <ProcessWireframe parsed={parsed} count={section.element_count} pulsing={pulsing} />;
    case "FAQ":
      return <FAQWireframe parsed={parsed} count={section.element_count} pulsing={pulsing} />;
    case "Équipe":
      return <TeamWireframe parsed={parsed} count={section.element_count} pulsing={pulsing} />;
    case "Fonctionnalités":
      return (
        <CardsWireframe
          parsed={parsed}
          count={section.element_count}
          titleField="TITLE"
          descField="DESC"
          pulsing={pulsing}
        />
      );
    case "Problématiques":
      return (
        <CardsWireframe
          parsed={parsed}
          count={section.element_count}
          titleField="TITLE"
          descField="DESC"
          pulsing={pulsing}
        />
      );
    case "Témoignages":
      return <TestimonialsWireframe parsed={parsed} count={section.element_count} pulsing={pulsing} />;
    case "Avantages":
      return (
        <CardsWireframe
          parsed={parsed}
          count={section.element_count}
          titleField="TITLE"
          descField="DESC"
          pulsing={pulsing}
        />
      );
    case "Tarifs":
      return <PricingWireframe parsed={parsed} count={section.element_count} pulsing={pulsing} />;
    case "CTA Principal":
      return <CtaWireframe parsed={parsed} pulsing={pulsing} />;
    case "Chiffres clés":
      return <StatsWireframe parsed={parsed} count={section.element_count} pulsing={pulsing} />;
    case "Comparatif":
      return <ComparativeWireframe parsed={parsed} count={section.element_count} pulsing={pulsing} />;
    case "Contact":
      return <ContactWireframe parsed={parsed} pulsing={pulsing} />;
    default:
      return (
        <div className="space-y-2 py-1">
          <Slot h="h-4" w="w-2/3" pulsing={pulsing} />
          <Slot h="h-3" w="w-full" pulsing={pulsing} />
          <Slot h="h-3" w="w-4/5" pulsing={pulsing} />
        </div>
      );
  }
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

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // Drag & drop
  const dragSrc = useRef<number | null>(null);

  const activePage = pages.find((p) => p.id === activePageId) ?? null;
  const selectedSections = activePage?.sections.filter((s) => selectedIds.has(s.id)) ?? [];

  // Load projects
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        setProjects(d.projects ?? []);
        setLoadingProjects(false);
      })
      .catch(() => setLoadingProjects(false));
  }, []);

  // Load saved prompts
  useEffect(() => {
    try {
      const stored = localStorage.getItem("copywriting_custom_prompts");
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string>;
        const merged = { ...DEFAULT_PROMPTS, ...parsed };
        setCustomPrompts(merged);
        setDraftPrompts(merged);
      }
    } catch {}
  }, []);

  function handleSelectProject(projectId: string) {
    const proj = projects.find((p) => p.id === projectId) ?? null;
    setSelectedProject(proj);
    setSelectedIds(new Set());
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
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(sectionId);
      return next;
    });
  }

  function handleSectionClick(e: React.MouseEvent, sectionId: string) {
    if (e.shiftKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(sectionId)) next.delete(sectionId);
        else next.add(sectionId);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        if (prev.size === 1 && prev.has(sectionId)) return new Set();
        return new Set([sectionId]);
      });
    }
  }

  async function generateSection(sectionId: string) {
    if (!activePage || !selectedProject) return;
    const section = activePage.sections.find((s) => s.id === sectionId);
    if (!section) return;

    updateSection(activePage.id, sectionId, (s) => ({ ...s, generating: true }));

    try {
      const res = await fetch("/api/copywriting/generate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: [
            {
              id: section.id,
              type: section.type,
              notes: section.notes,
              element_count: section.element_count,
            },
          ],
          language: globalLanguage,
          form_data: selectedProject.form_data ?? null,
          custom_prompts: customPrompts,
        }),
      });
      const data = await res.json();
      if (res.ok && data.results?.length > 0) {
        updateSection(activePage.id, sectionId, (s) => ({
          ...s,
          generated: data.results[0].content ?? "",
          generating: false,
        }));
      } else {
        updateSection(activePage.id, sectionId, (s) => ({
          ...s,
          generating: false,
          generated: `TITLE: Erreur de génération\nBODY: ${data.error ?? "Erreur inconnue"}`,
        }));
      }
    } catch (e) {
      updateSection(activePage.id, sectionId, (s) => ({
        ...s,
        generating: false,
        generated: `TITLE: Erreur\nBODY: ${String(e)}`,
      }));
    }
  }

  async function generateAll() {
    if (!activePage || !selectedProject) return;
    const toGenerate = activePage.sections.filter((s) => !s.generated && !s.generating);
    if (toGenerate.length === 0) return;

    setGeneratingAll(true);

    // Mark all as generating
    updatePage(activePage.id, (p) => ({
      ...p,
      sections: p.sections.map((s) =>
        toGenerate.find((tg) => tg.id === s.id) ? { ...s, generating: true } : s
      ),
    }));

    try {
      const res = await fetch("/api/copywriting/generate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: toGenerate.map((s) => ({
            id: s.id,
            type: s.type,
            notes: s.notes,
            element_count: s.element_count,
          })),
          language: globalLanguage,
          form_data: selectedProject.form_data ?? null,
          custom_prompts: customPrompts,
        }),
      });

      const data = await res.json();

      if (res.ok && data.results) {
        const resultsMap: Record<string, string> = {};
        for (const r of data.results as { id: string; content: string }[]) {
          resultsMap[r.id] = r.content;
        }

        updatePage(activePage.id, (p) => ({
          ...p,
          sections: p.sections.map((s) => ({
            ...s,
            generating: false,
            generated: resultsMap[s.id] !== undefined ? resultsMap[s.id] : s.generated,
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
    if (!activePage || !selectedProject || selectedSections.length === 0) return;
    if (mode === "modify" && !aiInstruction.trim()) return;

    setAiLoading(true);

    // Mark selected as generating
    for (const s of selectedSections) {
      updateSection(activePage.id, s.id, (sec) => ({ ...sec, generating: true }));
    }

    try {
      const res = await fetch("/api/copywriting/generate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: selectedSections.map((s) => ({
            id: s.id,
            type: s.type,
            notes: s.notes,
            element_count: s.element_count,
            ai_instruction:
              mode === "variant"
                ? "Génère une variante alternative et créative"
                : aiInstruction,
            existing_content: s.generated || undefined,
          })),
          language: globalLanguage,
          form_data: selectedProject.form_data ?? null,
          custom_prompts: customPrompts,
        }),
      });

      const data = await res.json();

      if (res.ok && data.results) {
        const resultsMap: Record<string, string> = {};
        for (const r of data.results as { id: string; content: string }[]) {
          resultsMap[r.id] = r.content;
        }

        updatePage(activePage.id, (p) => ({
          ...p,
          sections: p.sections.map((s) => ({
            ...s,
            generating: false,
            generated: resultsMap[s.id] !== undefined ? resultsMap[s.id] : s.generated,
          })),
        }));
      } else {
        for (const s of selectedSections) {
          updateSection(activePage.id, s.id, (sec) => ({ ...sec, generating: false }));
        }
      }
    } catch {
      for (const s of selectedSections) {
        updateSection(activePage.id, s.id, (sec) => ({ ...sec, generating: false }));
      }
    }

    setAiLoading(false);
    if (mode === "modify") setAiInstruction("");
  }

  function copySection(sectionId: string) {
    const section = activePage?.sections.find((s) => s.id === sectionId);
    if (!section?.generated) return;
    navigator.clipboard.writeText(section.generated).then(() => {
      setCopiedId(sectionId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function exportPage() {
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

  function savePrompts() {
    setCustomPrompts(draftPrompts);
    try {
      localStorage.setItem("copywriting_custom_prompts", JSON.stringify(draftPrompts));
    } catch {}
    setSettingsOpen(false);
  }

  // Drag & drop
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

  const ungeneratedCount = activePage?.sections.filter((s) => !s.generated).length ?? 0;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── Left sidebar ── */}
      <div className="w-56 border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-200 space-y-3">
          <div className="flex items-center gap-2">
            <PenLine size={15} className="text-indigo-600" />
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

          {/* Global language */}
          {selectedProject && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1">
                <Globe size={11} /> Langue de la page
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
                onClick={() => {
                  setActivePageId(page.id);
                  setSelectedIds(new Set());
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

        {/* Settings button */}
        <div className="border-t border-gray-100 p-3">
          <button
            onClick={() => {
              setDraftPrompts({ ...customPrompts });
              setSettingsOpen(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings size={13} />
            Prompts par défaut
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
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
                    <span className="text-orange-500 ml-1">· {ungeneratedCount} non générée{ungeneratedCount > 1 ? "s" : ""}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Generate all */}
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

                {/* Export */}
                <button
                  onClick={exportPage}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                >
                  <ExternalLink size={12} />
                  Exporter
                </button>

                {/* Toggle right panel */}
                <button
                  onClick={() => setPanelOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                >
                  {panelOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
                  Sections
                </button>
              </div>
            </div>

            {/* Body: canvas + right panel */}
            <div className="flex flex-1 overflow-hidden">
              {/* Canvas */}
              <div
                className="flex-1 overflow-y-auto p-5 pb-28"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setSelectedIds(new Set());
                }}
              >
                <div className="max-w-3xl mx-auto space-y-3">
                  {activePage.sections.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
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
                      const isSelected = selectedIds.has(section.id);
                      const isGenerated = !!section.generated;

                      return (
                        <div
                          key={section.id}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => handleSectionClick(e, section.id)}
                          className={`bg-white rounded-xl border-2 cursor-pointer transition-all overflow-hidden ${
                            isSelected
                              ? "border-blue-500 shadow-lg shadow-blue-100"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {/* Section header */}
                          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
                            <div
                              className="text-gray-300 cursor-grab active:cursor-grabbing shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical size={14} />
                            </div>
                            <span className="text-xs text-gray-400 font-mono w-5 shrink-0">{idx + 1}</span>
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${color.bg} ${color.text} ${color.border}`}
                            >
                              {section.type}
                            </span>
                            {section.notes && (
                              <span className="text-xs text-gray-400 truncate italic flex items-center gap-1">
                                <StickyNote size={10} />
                                {section.notes}
                              </span>
                            )}
                            <div
                              className="ml-auto flex items-center gap-1.5 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Element count stepper */}
                              {isMultiItem(section.type) && (
                                <div className="flex items-center gap-0.5 bg-gray-100 rounded-md px-1.5 py-0.5">
                                  <button
                                    onClick={() =>
                                      updateSection(activePage.id, section.id, (s) => ({
                                        ...s,
                                        element_count: Math.max(1, s.element_count - 1),
                                      }))
                                    }
                                    className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-800"
                                  >
                                    <Minus size={10} />
                                  </button>
                                  <span className="text-xs text-gray-700 w-4 text-center font-medium">
                                    {section.element_count}
                                  </span>
                                  <button
                                    onClick={() =>
                                      updateSection(activePage.id, section.id, (s) => ({
                                        ...s,
                                        element_count: Math.min(10, s.element_count + 1),
                                      }))
                                    }
                                    className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-800"
                                  >
                                    <Plus size={10} />
                                  </button>
                                </div>
                              )}

                              {/* Status */}
                              {section.generating ? (
                                <span className="flex items-center gap-1 text-xs text-indigo-500">
                                  <Loader2 size={11} className="animate-spin" /> Génération...
                                </span>
                              ) : isGenerated ? (
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                  <Check size={11} /> Généré
                                </span>
                              ) : null}

                              {/* Generate button */}
                              <button
                                onClick={() => generateSection(section.id)}
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

                              {/* Copy */}
                              {isGenerated && (
                                <button
                                  onClick={() => copySection(section.id)}
                                  title="Copier le contenu brut"
                                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  {copiedId === section.id ? (
                                    <Check size={13} className="text-green-500" />
                                  ) : (
                                    <Copy size={13} />
                                  )}
                                </button>
                              )}

                              {/* Delete */}
                              <button
                                onClick={() => removeSection(section.id)}
                                className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Wireframe body */}
                          <div className="px-4 py-3">
                            <SectionWireframe section={section} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right panel */}
              {panelOpen && (
                <div className="w-60 border-l border-gray-200 bg-white flex flex-col shrink-0 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-700">Ajouter une section</p>
                    <button
                      onClick={() => setPanelOpen(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
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
                            <Plus size={12} className={isExpanded ? color.text : "text-gray-400"} />
                          </button>

                          {isExpanded && (
                            <div className="mx-1 mt-1 mb-2 p-2 border border-gray-200 rounded-lg bg-gray-50 space-y-2">
                              <label className="text-xs text-gray-500 flex items-center gap-1">
                                <StickyNote size={10} /> Note (optionnelle)
                              </label>
                              <input
                                autoFocus
                                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white"
                                placeholder="Ex: focus sur la qualité..."
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

            {/* AI modification bottom bar */}
            {selectedIds.size > 0 && (
              <div className="fixed bottom-0 left-56 right-0 z-40 bg-white border-t border-gray-200 shadow-lg px-5 py-3 flex items-center gap-3">
                <span className="text-xs font-medium text-blue-600 shrink-0">
                  {selectedIds.size} section{selectedIds.size > 1 ? "s" : ""} sélectionnée{selectedIds.size > 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-gray-400 hover:text-gray-600 shrink-0"
                >
                  <X size={14} />
                </button>
                <div className="w-px h-5 bg-gray-200 shrink-0" />
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 relative">
                    <MessageSquare
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                    <input
                      className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="Instruction IA… ex : rends le texte plus percutant"
                      value={aiInstruction}
                      onChange={(e) => setAiInstruction(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && aiInstruction.trim()) applyAIModification("modify");
                      }}
                    />
                  </div>
                  <button
                    onClick={() => applyAIModification("modify")}
                    disabled={!aiInstruction.trim() || aiLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                    Appliquer
                  </button>
                  <button
                    onClick={() => applyAIModification("variant")}
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors shrink-0"
                  >
                    <RefreshCw size={12} />
                    Variante
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Prompt Settings Modal ── */}
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
                    <label className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border mb-1.5 ${color.bg} ${color.text} ${color.border}`}>
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
