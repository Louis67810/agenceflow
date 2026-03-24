import { ProjectCard } from "@/components/shared/ProjectCard";
import type { Project } from "@/types/agency";

const designerProjects: Project[] = [
  {
    id: "1",
    name: "Site web Startup XYZ",
    description: "Refonte complète du site vitrine avec animations Framer",
    status: "in_progress",
    client_id: "c1",
    client: { id: "c1", name: "Martin Dupont", email: "martin@xyz.com", created_at: "", payment_status: "paid" },
    current_stage: "design",
    stages: [
      { stage: "copywriting", label: "Copywriting", duration_days: 5, completed: true },
      { stage: "wireframe", label: "Wireframe", duration_days: 7, completed: true },
      { stage: "design", label: "Design", duration_days: 14, completed: false },
      { stage: "development", label: "Développement", duration_days: 10, completed: false },
    ],
    deadline: "2026-03-28",
    created_at: "2026-01-15",
    updated_at: "2026-03-20",
  },
  {
    id: "3",
    name: "App mobile TechStart",
    description: "Design UI/UX pour application de gestion de tâches",
    status: "in_progress",
    client_id: "c3",
    client: { id: "c3", name: "Pierre Martin", email: "pierre@techstart.io", created_at: "", payment_status: "partial" },
    current_stage: "wireframe",
    stages: [
      { stage: "wireframe", label: "Wireframe", duration_days: 10, completed: false },
      { stage: "design", label: "Design", duration_days: 20, completed: false },
      { stage: "revision", label: "Révisions", duration_days: 7, completed: false },
    ],
    deadline: "2026-04-15",
    created_at: "2026-02-20",
    updated_at: "2026-03-15",
  },
];

export default function DesignerProjectsPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mes projets</h1>
        <p className="text-gray-500 mt-1">{designerProjects.length} projets qui vous sont assignés</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {designerProjects.map((project) => (
          <ProjectCard key={project.id} project={project} basePath="/designer/projects" />
        ))}
      </div>
    </div>
  );
}
