-- Drop existing table
DROP TABLE IF EXISTS knowledge_base CASCADE;

-- Create new table with correct structure
CREATE TABLE knowledge_base (
  id bigserial PRIMARY KEY,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add generated doc_id column for easier querying
ALTER TABLE knowledge_base 
ADD COLUMN doc_id text 
GENERATED ALWAYS AS (metadata->>'doc_id') STORED;

-- Create unique index for upserts
CREATE UNIQUE INDEX knowledge_base_doc_id_unique 
ON knowledge_base(doc_id);

-- Create vector similarity index
CREATE INDEX knowledge_base_embedding_idx 
ON knowledge_base USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create metadata indexes
CREATE INDEX knowledge_base_metadata_idx 
ON knowledge_base USING gin (metadata);

CREATE INDEX knowledge_base_metadata_category_idx 
ON knowledge_base USING gin ((metadata -> 'category'));

-- Create match function
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter jsonb DEFAULT '{}'
) 
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    id,
    content,
    metadata,
    1 - (knowledge_base.embedding <=> query_embedding) as similarity
  FROM knowledge_base
  WHERE (filter = '{}' OR metadata @> filter)
  ORDER BY knowledge_base.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;