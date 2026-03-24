"use client";

import { useState } from "react";
import { Check, CreditCard, Lock } from "lucide-react";

type Step = "payment" | "form" | "done";

const PAYMENT_OPTIONS = [
  {
    id: "full",
    label: "Paiement en une fois",
    description: "Payez la totalité maintenant",
    discount: "Économisez 5%",
    price: 4275,
    originalPrice: 4500,
  },
  {
    id: "split",
    label: "Paiement en deux fois",
    description: "50% maintenant, 50% à la livraison",
    price: 2250,
    note: "puis 2 250 € à la livraison",
  },
];

export default function ClientOnboardingPage() {
  const [step, setStep] = useState<Step>("payment");
  const [selectedPayment, setSelectedPayment] = useState("full");
  const [formData, setFormData] = useState({
    company: "",
    description: "",
    sector: "",
    hasCharte: "",
    inspirations: [] as string[],
  });

  const inspirationStyles = [
    { id: "minimal", label: "Minimaliste", emoji: "⬜" },
    { id: "colorful", label: "Coloré & Vivant", emoji: "🎨" },
    { id: "dark", label: "Dark & Premium", emoji: "🌑" },
    { id: "corporate", label: "Corporate", emoji: "💼" },
    { id: "playful", label: "Playful", emoji: "🎉" },
    { id: "elegant", label: "Élégant", emoji: "✨" },
  ];

  const toggleInspiration = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      inspirations: prev.inspirations.includes(id)
        ? prev.inspirations.filter((i) => i !== id)
        : [...prev.inspirations, id],
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[
            { key: "payment", label: "Paiement" },
            { key: "form", label: "Brief projet" },
            { key: "done", label: "Confirmation" },
          ].map((s, i) => {
            const steps = ["payment", "form", "done"];
            const currentIndex = steps.indexOf(step);
            const stepIndex = steps.indexOf(s.key);
            const isDone = currentIndex > stepIndex;
            const isCurrent = step === s.key;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 ${i > 0 ? "ml-2" : ""}`}>
                  {i > 0 && <div className={`h-px w-8 ${isDone ? "bg-indigo-400" : "bg-gray-200"}`} />}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      isDone
                        ? "bg-indigo-500 text-white"
                        : isCurrent
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {isDone ? <Check size={12} /> : i + 1}
                  </div>
                  <span className={`text-sm font-medium ${isCurrent ? "text-indigo-600" : "text-gray-400"}`}>
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Payment Step */}
        {step === "payment" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Finalisez votre commande</h1>
            <p className="text-gray-500 mb-6">Choisissez votre modalité de paiement pour démarrer votre projet.</p>

            <div className="space-y-3 mb-6">
              {PAYMENT_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    selectedPayment === option.id
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={option.id}
                    checked={selectedPayment === option.id}
                    onChange={() => setSelectedPayment(option.id)}
                    className="sr-only"
                  />
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedPayment === option.id ? "border-indigo-500" : "border-gray-300"
                    }`}
                  >
                    {selectedPayment === option.id && (
                      <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{option.label}</p>
                    <p className="text-sm text-gray-500">{option.description}</p>
                    {option.note && <p className="text-xs text-gray-400 mt-0.5">{option.note}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">{option.price.toLocaleString("fr-FR")} €</p>
                    {option.originalPrice && (
                      <p className="text-xs text-gray-400 line-through">{option.originalPrice.toLocaleString("fr-FR")} €</p>
                    )}
                    {option.discount && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        {option.discount}
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 flex items-center gap-3 text-sm text-gray-600">
              <Lock size={16} className="text-gray-400 shrink-0" />
              Paiement sécurisé par Stripe. Vos données sont protégées.
            </div>

            <button
              onClick={() => setStep("form")}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
            >
              <CreditCard size={18} />
              Procéder au paiement →
            </button>
          </div>
        )}

        {/* Brief Form Step */}
        {step === "form" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Brief de projet</h1>
            <p className="text-gray-500 mb-6">Ces informations nous permettent de mieux comprendre votre projet.</p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nom de votre entreprise <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData((p) => ({ ...p, company: e.target.value }))}
                  placeholder="Ex : Startup XYZ"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Décrivez votre projet <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Ex : Site vitrine moderne pour présenter nos services SaaS..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Secteur d&apos;activité <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.sector}
                  onChange={(e) => setFormData((p) => ({ ...p, sector: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  <option value="">Sélectionnez...</option>
                  {["Tech / SaaS", "E-commerce", "Consulting", "Santé", "Éducation", "Autre"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Styles d&apos;inspiration (choisissez plusieurs)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {inspirationStyles.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => toggleInspiration(style.id)}
                      className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl text-sm font-medium transition-all ${
                        formData.inspirations.includes(style.id)
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-2xl">{style.emoji}</span>
                      {style.label}
                      {formData.inspirations.includes(style.id) && (
                        <span className="text-xs text-indigo-500">✓ Sélectionné</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep("done")}
              className="w-full mt-6 bg-indigo-600 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
            >
              Envoyer mon brief →
            </button>
          </div>
        )}

        {/* Done Step */}
        {step === "done" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <Check size={28} className="text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">C&apos;est parti !</h1>
            <p className="text-gray-500 mb-6">
              Votre paiement a été confirmé et votre brief a bien été reçu. Notre équipe démarre votre projet dans les 24h.
            </p>
            <div className="bg-indigo-50 rounded-xl p-4 mb-6 text-left space-y-2">
              <p className="text-sm font-semibold text-indigo-900">Prochaines étapes :</p>
              <p className="text-sm text-indigo-700">✅ Vous recevrez un email de confirmation</p>
              <p className="text-sm text-indigo-700">📞 Un call de démarrage sera planifié</p>
              <p className="text-sm text-indigo-700">🚀 Le projet démarrera sous 24-48h</p>
            </div>
            <a
              href="/client"
              className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors"
            >
              Accéder à mon espace →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
