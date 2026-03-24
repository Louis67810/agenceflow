"use client";

import { useState } from "react";
import { Plus, Search, Mail, Phone, Building2, CheckCircle, Clock, AlertCircle } from "lucide-react";
import type { Client } from "@/types/agency";

const mockClients: Client[] = [
  { id: "c1", name: "Martin Dupont", email: "martin@startupxyz.com", company: "Startup XYZ", phone: "+33 6 12 34 56 78", created_at: "2026-01-10", payment_status: "paid" },
  { id: "c2", name: "Sophie Laurent", email: "sophie@brandco.fr", company: "Brand Co.", phone: "+33 6 98 76 54 32", created_at: "2026-02-01", payment_status: "paid" },
  { id: "c3", name: "Pierre Martin", email: "pierre@techstart.io", company: "TechStart", phone: "+33 7 11 22 33 44", created_at: "2026-02-20", payment_status: "partial" },
  { id: "c4", name: "Julie Bernard", email: "julie@creativestudio.fr", company: "Creative Studio", created_at: "2026-03-05", payment_status: "pending" },
  { id: "c5", name: "Alexandre Moreau", email: "alex@consulting.com", company: "AM Consulting", phone: "+33 6 55 44 33 22", created_at: "2026-03-10", payment_status: "paid" },
];

const paymentConfig = {
  paid: { label: "Payé", icon: <CheckCircle size={14} />, className: "text-green-600 bg-green-50" },
  partial: { label: "Partiel", icon: <Clock size={14} />, className: "text-orange-600 bg-orange-50" },
  pending: { label: "En attente", icon: <AlertCircle size={14} />, className: "text-red-600 bg-red-50" },
};

export default function AdminClientsPage() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const filtered = mockClients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.company?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 mt-1">{mockClients.length} clients enregistrés</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Nouveau client
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Entreprise</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Paiement</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Projets</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((client) => {
              const payment = paymentConfig[client.payment_status];
              return (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600">
                        {client.name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{client.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {client.company ? (
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Building2 size={14} className="text-gray-400" />
                        {client.company}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Mail size={12} />
                        {client.email}
                      </div>
                      {client.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Phone size={12} />
                          {client.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${payment.className}`}>
                      {payment.icon}
                      {payment.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600 font-medium">1 projet</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                      Envoyer lien
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
