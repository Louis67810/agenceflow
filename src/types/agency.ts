export type AgencyRole = "admin" | "client" | "designer";

export type ProjectStatus =
  | "pending"
  | "onboarding"
  | "in_progress"
  | "review"
  | "revision"
  | "completed"
  | "cancelled";

export type ProjectStage =
  | "copywriting"
  | "wireframe"
  | "design"
  | "development"
  | "revision"
  | "delivery";

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Client {
  id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  payment_status: "pending" | "partial" | "paid";
}

export interface Designer {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  speciality?: string;
  hourly_rate?: number;
  created_at: string;
}

export interface ProjectStageConfig {
  stage: ProjectStage;
  label: string;
  duration_days: number;
  start_date?: string;
  end_date?: string;
  completed: boolean;
  completed_at?: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assigned_to?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  project_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: AgencyRole;
  content: string;
  source: "app" | "whatsapp" | "figma" | "framer" | "email";
  created_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  name: string;
  url: string;
  type: "figma" | "google_doc" | "image" | "pdf" | "other";
  created_at: string;
}

export interface FormField {
  id: string;
  type: "text" | "textarea" | "select" | "radio" | "checkbox" | "file" | "inspiration";
  label: string;
  placeholder?: string;
  options?: string[];
  required: boolean;
  order: number;
}

export interface ProjectForm {
  id: string;
  name: string;
  fields: FormField[];
  created_at: string;
}

export interface FormResponse {
  id: string;
  project_id: string;
  client_id: string;
  form_id: string;
  answers: Record<string, string | string[]>;
  submitted_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  client_id: string;
  client?: Client;
  designer_id?: string;
  designer?: Designer;
  stages: ProjectStageConfig[];
  current_stage: ProjectStage;
  budget?: number;
  start_date?: string;
  deadline?: string;
  figma_url?: string;
  google_doc_url?: string;
  framer_url?: string;
  tasks?: Task[];
  messages?: Message[];
  files?: ProjectFile[];
  form_responses?: FormResponse[];
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  project_id?: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  created_at: string;
}

export const PROJECT_STAGE_LABELS: Record<ProjectStage, string> = {
  copywriting: "Copywriting",
  wireframe: "Wireframe",
  design: "Design",
  development: "Développement",
  revision: "Révisions",
  delivery: "Livraison",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  pending: "En attente",
  onboarding: "Onboarding",
  in_progress: "En cours",
  review: "En révision",
  revision: "Révisions",
  completed: "Terminé",
  cancelled: "Annulé",
};
