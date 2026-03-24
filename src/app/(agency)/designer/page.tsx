import Link from "next/link";
import { CheckSquare, FolderKanban, Clock, ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/agency/StatusBadge";

export default function DesignerDashboard() {
  const tasks = [
    { id: "t1", title: "Design page accueil — Site XYZ", project: "Site web Startup XYZ", due: "2026-03-25", status: "in_progress" as const },
    { id: "t2", title: "Prototype animations Framer", project: "Site web Startup XYZ", due: "2026-03-28", status: "todo" as const },
    { id: "t3", title: "Logo V3 — TechStart", project: "App mobile TechStart", due: "2026-03-30", status: "todo" as const },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bonjour Sarah 👋</h1>
        <p className="text-gray-500 mt-1">Voici vos projets et tâches du moment.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Projets actifs", value: "2", icon: <FolderIcon />, color: "bg-indigo-50 text-indigo-600" },
          { label: "Tâches en cours", value: "3", icon: <CheckSquare size={20} />, color: "bg-orange-50 text-orange-600" },
          { label: "Heures ce mois", value: "86h", icon: <Clock size={20} />, color: "bg-green-50 text-green-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className={`p-2 rounded-lg inline-block mb-3 ${stat.color}`}>{stat.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tasks */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Mes tâches</h2>
          <Link href="/designer/tasks" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Voir tout
          </Link>
        </div>
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
              <div>
                <p className="font-medium text-gray-900 text-sm">{task.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{task.project}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={11} />
                  {new Date(task.due).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                </span>
                <StatusBadge status={task.status} type="task" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Projects quick access */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Mes projets</h2>
          <Link href="/designer/projects" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Voir tout
          </Link>
        </div>
        <div className="space-y-3">
          {[
            { id: "1", name: "Site web Startup XYZ", status: "in_progress" as const, stage: "Design" },
            { id: "3", name: "App mobile TechStart", status: "in_progress" as const, stage: "Wireframe" },
          ].map((project) => (
            <Link key={project.id} href={`/designer/projects/${project.id}`}>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                <div>
                  <p className="font-medium text-gray-900 text-sm group-hover:text-indigo-600 transition-colors">
                    {project.name}
                  </p>
                  <p className="text-xs text-gray-500">Étape : {project.stage}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={project.status} />
                  <ArrowRight size={14} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  );
}
