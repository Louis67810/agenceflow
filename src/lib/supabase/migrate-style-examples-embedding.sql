create extension if not exists vector;

alter table public.linkedin_style_examples add column if not exists embedding vector(3072);

drop index if exists idx_linkedin_style_examples_embedding;

create index idx_linkedin_style_examples_embedding on public.linkedin_style_examples using hnsw (embedding vector_cosine_ops);

create or replace function search_style_examples(query_embedding vector(3072), match_style_id text, match_limit int default 5)
returns table (id uuid, style_id text, content text, similarity float)
language sql stable
as $$
select id, style_id, content, 1 - (embedding <=> query_embedding) as similarity
from linkedin_style_examples
where style_id = match_style_id and embedding is not null
order by embedding <=> query_embedding
limit match_limit;
$$;
