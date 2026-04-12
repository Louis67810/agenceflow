"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";

interface TutorialStep {
  icon: string;
  title: string;
  description: string;
}

const ADMIN_STEPS: TutorialStep[] = [
  {
    icon: "👋",
    title: "Bienvenue sur AgenceFlow !",
    description: "Votre outil tout-en-un pour gérer votre agence créative. Projets, clients, contenu LinkedIn, leads CRM et productivité personnelle — tout est là.",
  },
  {
    icon: "📁",
    title: "Gestion de projets",
    description: "Créez et suivez vos projets avec des étapes personnalisées, assignez des prestataires, communiquez avec vos clients, et gardez une vue claire sur chaque deadline.",
  },
  {
    icon: "🤝",
    title: "Leads & CRM",
    description: "Gérez votre prospection avec notre CRM intégré. Analysez vos leads avec l'IA, générez des templates de messages A/B et enrichissez vos données via Google Maps.",
  },
  {
    icon: "✍️",
    title: "Copywriting & LinkedIn",
    description: "Générez du contenu web et des posts LinkedIn avec l'IA. Planifiez vos publications, gérez votre style éditorial et boostez votre prospection.",
  },
  {
    icon: "🔥",
    title: "Habits & Productivité",
    description: "Système gamifié de productivité personnelle. Gérez vos habitudes, objectifs, tâches et sessions Pomodoro. Gagnez des points et montez en niveau !",
  },
  {
    icon: "🤖",
    title: "Coach IA",
    description: "Votre coach business personnel. Il a accès à vos données (projets, leads, stats) et vous donne des conseils personnalisés et actionnables.",
  },
  {
    icon: "⚙️",
    title: "Paramètres & IA",
    description: "Configurez vos intégrations, choisissez vos modèles IA par fonctionnalité (Claude, GPT-4o, Gemini...) et définissez votre mémoire business globale.",
  },
];

const CLIENT_STEPS: TutorialStep[] = [
  {
    icon: "👋",
    title: "Bienvenue sur votre espace client !",
    description: "Retrouvez ici l'avancement de vos projets, les livrables, et communiquez directement avec votre agence.",
  },
  {
    icon: "📁",
    title: "Suivi de vos projets",
    description: "Consultez l'état d'avancement de chaque projet, les étapes terminées, et ce qui est en cours. Tout est transparent et mis à jour en temps réel.",
  },
  {
    icon: "✅",
    title: "Validation et feedback",
    description: "Validez les étapes clés directement depuis votre espace. Laissez vos retours, demandez des modifications, et approuvez les livrables en un clic.",
  },
  {
    icon: "💬",
    title: "Communication simplifiée",
    description: "Échangez avec votre équipe via la messagerie intégrée. Toutes les conversations sont centralisées par projet.",
  },
];

const STORAGE_KEY = "agenceflow_tutorial_seen";

interface OnboardingTutorialProps {
  role?: "admin" | "client" | "designer";
}

export default function OnboardingTutorial({ role = "admin" }: OnboardingTutorialProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  const steps = role === "client" ? CLIENT_STEPS : ADMIN_STEPS;
  const storageKey = `${STORAGE_KEY}_${role}`;

  useEffect(() => {
    const seen = localStorage.getItem(storageKey);
    if (!seen) setVisible(true);
  }, [storageKey]);

  const close = () => {
    localStorage.setItem(storageKey, "1");
    setVisible(false);
  };

  const next = () => {
    if (step < steps.length - 1) setStep(s => s + 1);
    else close();
  };

  const prev = () => setStep(s => Math.max(0, s - 1));

  if (!visible) return null;

  const current = steps[step];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 bg-indigo-500 transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {/* Close */}
          <div className="flex justify-end mb-4">
            <button onClick={close} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{current.icon}</div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">{current.title}</h2>
            <p className="text-gray-600 text-sm leading-relaxed">{current.description}</p>
          </div>

          {/* Dots */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`rounded-full transition-all ${i === step ? "w-4 h-2 bg-indigo-500" : "w-2 h-2 bg-gray-300"}`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            {step > 0 ? (
              <button onClick={prev} className="flex items-center gap-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 text-gray-600">
                <ChevronLeft size={15} />Précédent
              </button>
            ) : (
              <button onClick={close} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 text-gray-500">
                Passer
              </button>
            )}
            <button onClick={next} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
              {step === steps.length - 1 ? (
                <><Check size={15} />Commencer !</>
              ) : (
                <>Suivant<ChevronRight size={15} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
