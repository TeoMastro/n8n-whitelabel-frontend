-- Enable pgvector extension (must be done in Supabase Dashboard first:
-- Database > Extensions > vector, then this line is a no-op)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- workflows
-- ============================================================
CREATE TABLE public.workflows (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL,
  description        TEXT,
  type               TEXT        NOT NULL DEFAULT 'chat'
                                 CHECK (type IN ('chat', 'trigger')),
  webhook_url        TEXT        NOT NULL,
  has_knowledge_base BOOLEAN     NOT NULL DEFAULT false,
  -- config shape: { systemPrompt, params: [{key, label, type, options, required, default}], model, temperature, maxTokens }
  config             JSONB       NOT NULL DEFAULT '{}',
  is_active          BOOLEAN     NOT NULL DEFAULT true,
  created_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- user_workflows  (assignment junction)
-- ============================================================
CREATE TABLE public.user_workflows (
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workflow_id UUID        NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, workflow_id)
);

CREATE INDEX idx_user_workflows_user_id     ON public.user_workflows(user_id);
CREATE INDEX idx_user_workflows_workflow_id ON public.user_workflows(workflow_id);

-- ============================================================
-- documents  (per-workflow, uploaded by a user)
-- ============================================================
CREATE TABLE public.documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     UUID        NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  uploaded_by     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  file_type       TEXT        NOT NULL CHECK (file_type IN ('pdf', 'txt', 'docx', 'md')),
  storage_path    TEXT        NOT NULL,
  file_size_bytes BIGINT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message   TEXT,
  chunk_count     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_workflow_id ON public.documents(workflow_id);
CREATE INDEX idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX idx_documents_status      ON public.documents(status);

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- knowledge_base  (n8n Supabase Vector Store compatible format)
-- ============================================================
CREATE TABLE public.knowledge_base (
  id          BIGSERIAL   PRIMARY KEY,
  content     TEXT        NOT NULL,
  metadata    JSONB       DEFAULT '{}'::jsonb,
  embedding   VECTOR(1536),
  workflow_id UUID        NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generated column so n8n's built-in doc_id dedup still works
ALTER TABLE public.knowledge_base
  ADD COLUMN doc_id TEXT GENERATED ALWAYS AS (metadata->>'doc_id') STORED;

-- Unique index on doc_id (only where non-null to allow rows without doc_id)
CREATE UNIQUE INDEX kb_doc_id_unique  ON public.knowledge_base(doc_id) WHERE doc_id IS NOT NULL;
CREATE INDEX        kb_workflow_id_idx ON public.knowledge_base(workflow_id);
CREATE INDEX        kb_metadata_idx    ON public.knowledge_base USING gin(metadata);

-- IVFFlat vector index — tune `lists` to sqrt(row_count) after bulk inserts
-- Run: CREATE INDEX CONCURRENTLY ... after data load if you prefer zero-downtime
CREATE INDEX kb_embedding_idx ON public.knowledge_base
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- Row Level Security
-- ============================================================

-- workflows
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage workflows" ON public.workflows
  FOR ALL USING (public.is_admin());

CREATE POLICY "Users view assigned workflows" ON public.workflows
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_workflows
      WHERE user_workflows.workflow_id = workflows.id
        AND user_workflows.user_id = auth.uid()
    )
  );

-- user_workflows
ALTER TABLE public.user_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage user_workflows" ON public.user_workflows
  FOR ALL USING (public.is_admin());

CREATE POLICY "Users view own assignments" ON public.user_workflows
  FOR SELECT USING (auth.uid() = user_id);

-- documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage documents" ON public.documents
  FOR ALL USING (public.is_admin());

CREATE POLICY "Users manage own workflow documents" ON public.documents
  FOR ALL USING (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM public.user_workflows
      WHERE user_workflows.workflow_id = documents.workflow_id
        AND user_workflows.user_id = auth.uid()
    )
  );

-- knowledge_base
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage knowledge_base" ON public.knowledge_base
  FOR ALL USING (public.is_admin());

CREATE POLICY "Users view assigned workflow kb" ON public.knowledge_base
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_workflows
      WHERE user_workflows.workflow_id = knowledge_base.workflow_id
        AND user_workflows.user_id = auth.uid()
    )
  );

-- ============================================================
-- Vector search helper function
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_knowledge_base(
  query_embedding    VECTOR(1536),
  workflow_id_filter UUID,
  match_count        INTEGER DEFAULT 5,
  match_threshold    FLOAT   DEFAULT 0.7,
  filter             JSONB   DEFAULT '{}'
)
RETURNS TABLE (id BIGINT, content TEXT, metadata JSONB, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT kb.id, kb.content, kb.metadata,
         1 - (kb.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base kb
  WHERE kb.workflow_id = workflow_id_filter
    AND kb.embedding IS NOT NULL
    AND (filter = '{}' OR kb.metadata @> filter)
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
