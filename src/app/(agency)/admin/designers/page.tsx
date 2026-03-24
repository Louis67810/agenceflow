"use client";

import { useState } from "react";
import { Plus, Search, Mail, Star } from "lucide-react";
import type { Designer } from "@/types/agency";

const mockDesigners: Designer[] = [
  { id: "d1", name: "Sarah Kimura", email: "sarah@agency.com", speciality: "UI/UX Design", hourly_rate: 65, created_at: "2025-06-01" },
  { id: "d2", name: "Tom Andersson", email: "tom@agency.com", speciality: "Motion Design", hourly_rate: 60, created_at: "2025-08-15" },
  { id: "d3", name: "Léa Moreau", email: "lea@agency.com", speciality: "Branding & Identité", hourly_rate: 70, created_at: "2025-10-01" },
];

const assignedProjects: Record<string, number> = {
  d1: 2,
  d2: 1,
  d3: 1,
};

export default function AdminDesignersPage() {
  const [search, setSearch] = useState("");

  const filtered = mockDesigners.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.speciality?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Designers</h1>
          <p className="text-gray-500 mt-1">{mockDesigners.length} designers dans l&apos;équipe</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus size={16} />
          Inviter un designer
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un designer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* Designers Grid */}
      <div className="grid grid-cols-3 gap-4">
        {filtered.map((designer) => (
          <div key={designer.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-lg font-bold text-purple-600">
                {designer.name.charAt(0)}
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full font-medium">
                <Star size={11} fill="currentColor" />
                4.9
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-0.5">{designer.name}</h3>
            {designer.speciality && (
              <p className="text-sm text-gray-500 mb-3">{designer.speciality}</p>
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
              <Mail size={12} />
              {designer.email}
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div>
                <p className="text-xs text-gray-400">Projets actifs</p>
                <p className="font-bold text-gray-900 text-lg">{assignedProjects[designer.id] || 0}</p>
              </div>
              {designer.hourly_rate && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">TJM</p>
                  <p className="font-bold text-gray-900 text-lg">{designer.hourly_rate * 8}€</p>
                </div>
              )}
            </div>
            <button className="mt-4 w-full text-sm py-2 border border-gray-200 rounded-lg text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
              Voir les projets
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
