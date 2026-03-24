import Link from "next/link";
import {
  FolderKanban,
  Users,
  Palette,
  TrendingUp,
  Clock,
  AlertCircle,
  ArrowRight,
  Plus,
} from "lucide-react";

export default function AdminDashboard() {
  // Mock stats - in production, fetch from Supabase
  const stats = [
    {
      label: "Projets actifs",
      value: "12",
      icon: <FolderKanban size={20} />,
      color: "bg-indigo-50 text-indigo-600",
      href: "/admin/projects",
    },
    {
      label: "Clients",
      value: "8",
      icon: <Users size={20} />,
      color: "bg-blue-50 text-blue-600",
      href: "/admin/clients",
    },
    {
      label: "Designers",
      value: "3",
      icon: <Palette size={20} />,
      color: "bg-purple-50 text-purple-600",
      href: "/admin/designers",
    },
    {
      label: "Taux de completion",
      value: "87%",
      icon: <TrendingUp size={20} />,
      color: "bg-green-50 text-green-600",
      href: "/admin/projects",
    },
  ];

  const urgentProjects = [
    {
      id: "1",
      name: "Site web Startup XYZ",
      client: "Martin D.",
      deadline: "2026-03-28",
      status: "in_progress",
      daysLeft: 4,
    },
    {
      id: "2",
      name: "Identité visuelle Brand Co",
      client: "Sophie L.",
      deadline: "2026-03-30",
      status: "review",
      daysLeft: 6,
    },
    {
      id: "3",
      name: "App mobile TechStart",
      client: "Pierre M.",
      deadline: "2026-04-02",
      status: "design",
      daysLeft: 9,
    },
  ];

  const recentActivity = [
    {
      project: "Site web Startup XYZ",
      action: "Nouveau message client",
      time: "Il y a 2h",
    },
    {
      project: "App mobile TechStart",
      action: "Maquette V2 partagée",
      time: "Il y a 5h",
    },
    {
      project: "Identité visuelle Brand Co",
      action: "Étape design validée",
      time: "Hier",
    },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Bienvenue ! Voici un aperçu de votre activité.
          </p>
        </div>
        <Link
          href="/admin/projects/new"
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Nouveau projet
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${stat.color}`}>{stat.icon}</div>
                <ArrowRight
                  size={16}
                  className="text-gray-300 group-hover:text-gray-500 transition-colors"
                />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Projets urgents */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-orange-500" />
              <h2 className="font-semibold text-gray-900">Projets urgents</h2>
            </div>
            <Link
              href="/admin/projects"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {urgentProjects.map((project) => (
              <Link key={project.id} href={`/admin/projects/${project.id}`}>
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                  <div>
                    <p className="font-medium text-gray-900 text-sm group-hover:text-indigo-600 transition-colors">
                      {project.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{project.client}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                      <Clock size={12} />
                      {project.daysLeft}j restants
                    </div>
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Activité récente */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Activité récente</h2>
          <div className="space-y-4">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-2 h-2 mt-1.5 bg-indigo-400 rounded-full shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{activity.project}</p>
                  <p className="text-xs text-gray-500">{activity.action}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
