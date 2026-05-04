-- Ajoute une icone personnalisable aux objectifs.
ALTER TABLE agenda_objectives
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'target';
