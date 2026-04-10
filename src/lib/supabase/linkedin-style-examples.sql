-- LinkedIn style examples table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS linkedin_style_examples (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  style_id text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast lookup by style
CREATE INDEX IF NOT EXISTS idx_linkedin_style_examples_style_id
  ON linkedin_style_examples(style_id);

-- No RLS needed (single-user admin tool)
-- If you want RLS later:
-- ALTER TABLE linkedin_style_examples ENABLE ROW LEVEL SECURITY;
