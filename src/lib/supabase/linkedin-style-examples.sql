-- LinkedIn style examples table with vector embeddings
-- Run this in your Supabase SQL editor

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table if not exists
CREATE TABLE IF NOT EXISTS linkedin_style_examples (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  style_id text NOT NULL,
  content text NOT NULL,
  embedding vector(3072),  -- text-embedding-3-large produces 3072 dimensions
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast lookup by style
CREATE INDEX IF NOT EXISTS idx_linkedin_style_examples_style_id
  ON linkedin_style_examples(style_id);

-- HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_linkedin_style_examples_embedding
  ON linkedin_style_examples
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Function to search similar examples by embedding
CREATE OR REPLACE FUNCTION search_style_examples(
  query_embedding vector(3072),
  match_style_id text,
  match_limit int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  style_id text,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    style_id,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM linkedin_style_examples
  WHERE style_id = match_style_id
    AND embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_limit;
$$;

-- No RLS needed (single-user admin tool)
-- If you want RLS later:
-- ALTER TABLE linkedin_style_examples ENABLE ROW LEVEL SECURITY;
