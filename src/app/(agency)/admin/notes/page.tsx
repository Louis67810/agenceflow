"use client";

import { useEffect, useState, useRef } from "react";
import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { Plus, Search, Pin, Trash2, Tag, Save, X, PinOff } from "lucide-react";

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  tags: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

const COLORS = [
  { value: "#ffffff", label: "Blanc" },
  { value: "#fef9c3", label: "Jaune" },
  { value: "#dbeafe", label: "Bleu" },
  { value: "#dcfce7", label: "Vert" },
  { value: "#fce7f3", label: "Rose" },
  { value: "#f3e8ff", label: "Violet" },
  { value: "#ffedd5", label: "Orange" },
];

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Note | null>(null);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadNotes = async (q = "") => {
    const res = await agendaFetch(`/api/notes${q ? `?search=${encodeURIComponent(q)}` : ""}`).then(r => r.json());
    setNotes(res.notes ?? []);
    setLoading(false);
  };

  useEffect(() => { loadNotes(); }, []);

  useEffect(() => {
    const t = setTimeout(() => loadNotes(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const createNote = async () => {
    const res = await agendaFetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Sans titre", content: "", color: "#ffffff" }),
    }).then(r => r.json());
    if (res.note) {
      setNotes(prev => [res.note, ...prev]);
      setSelected(res.note);
    }
  };

  const autoSave = (updated: Note) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      await agendaFetch(`/api/notes/${updated.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: updated.title, content: updated.content, color: updated.color, tags: updated.tags, pinned: updated.pinned }),
      });
      setSaving(false);
      setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
    }, 600);
  };

  const updateSelected = (changes: Partial<Note>) => {
    if (!selected) return;
    const updated = { ...selected, ...changes };
    setSelected(updated);
    autoSave(updated);
  };

  const deleteNote = async (id: string) => {
    await agendaFetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const addTag = () => {
    if (!tagInput.trim() || !selected) return;
    const tags = [...(selected.tags ?? []), tagInput.trim()];
    updateSelected({ tags });
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    if (!selected) return;
    updateSelected({ tags: selected.tags.filter(t => t !== tag) });
  };

  const pinned = notes.filter(n => n.pinned);
  const unpinned = notes.filter(n => !n.pinned);

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-gray-900">Notes & Idées</h1>
            <button onClick={createNote} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus size={16} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="text-sm text-gray-400 text-center p-4">Chargement...</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center p-4">Aucune note. Créez-en une !</p>
          ) : (
            <>
              {pinned.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-gray-400 font-medium px-2 py-1 flex items-center gap-1"><Pin size={10} />Épinglées</p>
                  {pinned.map(note => <NoteCard key={note.id} note={note} selected={selected?.id === note.id} onClick={() => setSelected(note)} />)}
                </div>
              )}
              {unpinned.length > 0 && (
                <div>
                  {pinned.length > 0 && <p className="text-xs text-gray-400 font-medium px-2 py-1 mt-2">Autres</p>}
                  {unpinned.map(note => <NoteCard key={note.id} note={note} selected={selected?.id === note.id} onClick={() => setSelected(note)} />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      {selected ? (
        <div className="flex-1 flex flex-col" style={{ backgroundColor: selected.color }}>
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-200/60 bg-white/70 backdrop-blur">
            <input
              value={selected.title}
              onChange={e => updateSelected({ title: e.target.value })}
              placeholder="Titre..."
              className="flex-1 text-lg font-semibold bg-transparent border-none outline-none text-gray-900 placeholder-gray-400"
            />
            <div className="flex items-center gap-1">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => updateSelected({ color: c.value })}
                  title={c.label}
                  className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${selected.color === c.value ? "border-gray-600 scale-110" : "border-gray-300"}`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
            <button
              onClick={() => updateSelected({ pinned: !selected.pinned })}
              className={`p-1.5 rounded-lg transition-colors ${selected.pinned ? "bg-amber-100 text-amber-600" : "hover:bg-gray-100 text-gray-400"}`}
              title={selected.pinned ? "Désépingler" : "Épingler"}
            >
              {selected.pinned ? <Pin size={15} /> : <PinOff size={15} />}
            </button>
            <button onClick={() => deleteNote(selected.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 size={15} />
            </button>
            {saving && <span className="text-xs text-gray-400 flex items-center gap-1"><Save size={11} />Sauvegarde...</span>}
          </div>

          {/* Content */}
          <textarea
            value={selected.content}
            onChange={e => updateSelected({ content: e.target.value })}
            placeholder="Écrivez vos idées ici... (Markdown supporté)"
            className="flex-1 p-6 bg-transparent border-none outline-none text-gray-800 text-sm leading-relaxed resize-none font-mono"
          />

          {/* Tags */}
          <div className="px-6 py-3 border-t border-gray-200/60 bg-white/50 backdrop-blur flex items-center gap-2 flex-wrap">
            <Tag size={13} className="text-gray-400 shrink-0" />
            {(selected.tags ?? []).map(tag => (
              <span key={tag} className="flex items-center gap-1 bg-gray-200 text-gray-700 text-xs rounded-full px-2 py-0.5">
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-red-500"><X size={10} /></button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTag()}
              placeholder="Ajouter un tag..."
              className="text-xs bg-transparent border-none outline-none text-gray-500 placeholder-gray-400 w-28"
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="text-5xl mb-4">💡</div>
            <p className="text-gray-500 font-medium">Sélectionnez une note ou créez-en une</p>
            <button onClick={createNote} className="mt-4 flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors mx-auto">
              <Plus size={15} />Nouvelle note
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, selected, onClick }: { note: Note; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg mb-1 transition-all hover:shadow-sm ${selected ? "ring-2 ring-indigo-400 shadow-sm" : "hover:bg-gray-50"}`}
      style={{ backgroundColor: note.color }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 truncate">{note.title || "Sans titre"}</p>
        {note.pinned && <Pin size={10} className="text-amber-500 shrink-0 mt-0.5" />}
      </div>
      {note.content && <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{note.content}</p>}
      <p className="text-xs text-gray-400 mt-1.5">{new Date(note.updated_at).toLocaleDateString("fr-FR")}</p>
    </button>
  );
}
