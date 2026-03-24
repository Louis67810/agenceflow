import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function daysUntil(dateString: string): number {
  const target = new Date(dateString);
  const today = new Date();
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isOverdue(dateString: string): boolean {
  return new Date(dateString) < new Date();
}

export function calculateProgress(stages: { completed: boolean }[]): number {
  if (stages.length === 0) return 0;
  const completed = stages.filter((s) => s.completed).length;
  return Math.round((completed / stages.length) * 100);
}
