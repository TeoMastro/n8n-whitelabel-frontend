# Implementation Plan: n8n Workflow Frontend

## Overview

This plan adds a multi-tenant **n8n workflow management** system on top of the existing Next.js/Supabase SaaS starter.

- **Admins** create workflows, assign them to users, and manage knowledge bases
- **Users** see only their assigned workflows, can edit system prompts, trigger workflows, and manage the workflow's knowledge base (KB)

---

## Key Architectural Decisions

### Terminology: "Workflows" (not "agents")
Everything exposed to users are n8n **workflows** communicating via webhooks. The term "agent" from the prior plan is replaced with "workflow".

### Two Workflow Types
| Type | Behaviour |
|------|-----------|
| `chat` | Full chat UI — messages sent/received via webhook POST |
| `trigger` | One-shot call — user fills optional params, clicks button, sees response |

### Knowledge Base: Single Table, n8n-Compatible
The `vector-store.sql` format is what n8n's **Supabase Vector Store** node already uses. We extend it with a `workflow_id` column instead of creating per-workflow dynamic tables. This is simpler, supports RLS, and n8n can filter by `workflow_id` via the metadata filter param.

When the admin "creates a KB for a workflow" it means:
1. Setting `has_knowledge_base = true` on the workflow row
2. n8n's vector store node is pointed at the shared `knowledge_base` table and filters by `workflow_id`

> Dynamic per-workflow tables (`knowledge_base_{id}`) can still be created manually in Supabase Dashboard if needed for isolation. The app supports both approaches because the webhook URL and config are fully admin-controlled.

### Documents are Per-Workflow
A user uploads a document to a **specific workflow's KB** (not globally). The `documents` table has a `workflow_id` FK. Users can only upload/delete documents for workflows assigned to them.

### Params Passing
`workflows.config` JSONB includes a `params` array defining the inputs a user must/can provide before triggering. For chat workflows this is sent as context in every message.

### Webhook Communication
All n8n calls go through a thin Next.js API proxy (`/api/workflows/trigger`, `/api/workflows/chat`) to avoid exposing webhook URLs to the browser and to attach auth context.

---

## Database Migration — `supabase/migrations/002_workflows_knowledge_base.sql`

> Prerequisites: enable `pgvector` extension in Supabase Dashboard (Database › Extensions › vector).

### workflows table
```sql
CREATE TABLE public.workflows (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  description   TEXT,
  type          TEXT        NOT NULL DEFAULT 'chat'
                            CHECK (type IN ('chat', 'trigger')),
  webhook_url   TEXT        NOT NULL,
  has_knowledge_base BOOLEAN NOT NULL DEFAULT false,
  -- config shape: { systemPrompt, params: [{key, label, type, required, default}], model, temperature, maxTokens }
  config        JSONB       NOT NULL DEFAULT '{}',
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_by    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER workflows_updated_at BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

### user_workflows table (assignment junction)
```sql
CREATE TABLE public.user_workflows (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workflow_id   UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, workflow_id)
);
CREATE INDEX idx_user_workflows_user_id     ON public.user_workflows(user_id);
CREATE INDEX idx_user_workflows_workflow_id ON public.user_workflows(workflow_id);
```

### documents table (per-workflow)
```sql
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
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

### knowledge_base table (n8n Supabase Vector Store compatible)
```sql
CREATE EXTENSION IF NOT EXISTS vector;

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

CREATE UNIQUE INDEX kb_doc_id_unique        ON public.knowledge_base(doc_id);
CREATE INDEX        kb_workflow_id_idx      ON public.knowledge_base(workflow_id);
CREATE INDEX        kb_metadata_idx         ON public.knowledge_base USING gin(metadata);
CREATE INDEX        kb_embedding_idx        ON public.knowledge_base
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

### RLS Policies
```sql
-- workflows
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage workflows" ON public.workflows FOR ALL USING (public.is_admin());
CREATE POLICY "Users view assigned workflows" ON public.workflows FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_workflows
    WHERE user_workflows.workflow_id = workflows.id
      AND user_workflows.user_id = auth.uid()
  ));

-- user_workflows
ALTER TABLE public.user_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage user_workflows" ON public.user_workflows FOR ALL USING (public.is_admin());
CREATE POLICY "Users view own assignments" ON public.user_workflows FOR SELECT
  USING (auth.uid() = user_id);

-- documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage documents" ON public.documents FOR ALL USING (public.is_admin());
CREATE POLICY "Users manage own workflow documents" ON public.documents FOR ALL
  USING (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM public.user_workflows
      WHERE user_workflows.workflow_id = documents.workflow_id
        AND user_workflows.user_id = auth.uid()
    )
  );

-- knowledge_base
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage knowledge_base" ON public.knowledge_base FOR ALL USING (public.is_admin());
CREATE POLICY "Users view assigned workflow kb" ON public.knowledge_base FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_workflows
    WHERE user_workflows.workflow_id = knowledge_base.workflow_id
      AND user_workflows.user_id = auth.uid()
  ));
```

### Vector search function (n8n compatible)
```sql
CREATE OR REPLACE FUNCTION public.match_knowledge_base(
  query_embedding  VECTOR(1536),
  workflow_id_filter UUID,
  match_count      INTEGER DEFAULT 5,
  match_threshold  FLOAT   DEFAULT 0.7,
  filter           JSONB   DEFAULT '{}'
) RETURNS TABLE (id BIGINT, content TEXT, metadata JSONB, similarity FLOAT)
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
```

---

## Supabase Storage Bucket

Create bucket `workflow-documents` (private). Add RLS so users can only access files under `{workflow_id}/{user_id}/` prefix.

---

## New Files to Create

| Path | Purpose |
|------|---------|
| `supabase/migrations/002_workflows_knowledge_base.sql` | Full schema above |
| `src/types/workflow.d.ts` | Workflow, UserWorkflow, WorkflowDocument, WorkflowParam types |
| `src/server-actions/workflow.ts` | Admin CRUD + assignments; User: updateSystemPrompt, updateParams |
| `src/server-actions/document.ts` | initiateUpload, triggerProcessing, deleteDocument, getDocuments |
| `src/app/api/documents/process/route.ts` | Parse → chunk → embed → store pipeline |
| `src/app/api/documents/status/route.ts` | GET: poll document status |
| `src/app/api/workflows/trigger/route.ts` | POST: proxy trigger call to n8n webhook |
| `src/app/api/workflows/chat/route.ts` | POST: proxy chat message to n8n webhook (streaming optional) |
| `src/app/admin/workflow/layout.tsx` | SidebarLayout wrapper |
| `src/app/admin/workflow/page.tsx` | List all workflows |
| `src/app/admin/workflow/create/page.tsx` | WorkflowForm in create mode |
| `src/app/admin/workflow/[id]/page.tsx` | Workflow detail + assignment management |
| `src/app/admin/workflow/[id]/update/page.tsx` | WorkflowForm in update mode |
| `src/app/dashboard/workflow/layout.tsx` | SidebarLayout wrapper |
| `src/app/dashboard/workflow/page.tsx` | User workflow view (selector + type-specific UI + KB) |
| `src/components/admin/workflow-table.tsx` | Sortable/filterable workflow list |
| `src/components/admin/workflow-form.tsx` | Create/update form (name, type, webhook_url, has_kb, config) |
| `src/components/admin/workflow-view.tsx` | Workflow detail + assignment management UI |
| `src/components/workflow/workflow-selector.tsx` | Dropdown to switch between assigned workflows |
| `src/components/workflow/trigger-workflow.tsx` | Params form + Trigger button + response display |
| `src/components/workflow/chat-interface.tsx` | Full chat UI (message history, input, send) |
| `src/components/workflow/system-prompt-form.tsx` | User-editable system prompt textarea |
| `src/components/workflow/document-manager.tsx` | Upload + list + delete documents with status polling |

---

## Files to Modify

| Path | Change |
|------|--------|
| `src/lib/constants.ts` | Add `WorkflowType`, `DocumentStatus`, `SUPPORTED_FILE_TYPES`, `MAX_FILE_SIZE_BYTES` |
| `src/lib/validation-schemas.ts` | Add `createWorkflowSchema`, `updateWorkflowSchema`, `assignWorkflowSchema`, `ingestDocumentSchema`, `triggerWorkflowSchema` |
| `src/components/layout/sidebar.tsx` | Add `Bot` icon; add `/admin/workflow` for admins; add `/dashboard/workflow` for all users |
| `messages/en.json` | ~60 new keys (see Translation Keys section) |
| `messages/el.json` | Same keys in Greek |

---

## Server Actions Detail

### `src/server-actions/workflow.ts`
- `createWorkflowAction(prevState, formData)` — admin only
- `updateWorkflowAction(workflowId, prevState, formData)` — admin only; full update
- `deleteWorkflowAction(workflowId)` — admin only; cascades to assignments, documents, KB
- `assignWorkflowToUserAction(prevState, formData)` — admin only; upsert user_workflows
- `unassignWorkflowFromUserAction(userId, workflowId)` — admin only
- `getWorkflowById(workflowId)` — admin data fetch
- `getWorkflowsWithPagination(params)` — admin data fetch
- `getWorkflowAssignments(workflowId)` — admin; join user_workflows + profiles
- `getUserWorkflows()` — **no admin check**; RLS-safe; returns all workflows assigned to current user
- `updateSystemPromptAction(workflowId, prevState, formData)` — user action; verifies assignment, JSON-merges only `config.systemPrompt`

### `src/server-actions/document.ts`
- `initiateDocumentUploadAction(prevState, formData)` — user; validates file + workflow assignment, creates document record (status=pending), returns signed upload URL
- `triggerDocumentProcessingAction(documentId)` — user; sets status=processing, fires POST to `/api/documents/process`
- `deleteDocumentAction(documentId)` — user; deletes storage file + document row (cascades KB rows where `metadata->>'file_id' = documentId`)
- `getDocumentsForWorkflow(workflowId)` — user data fetch; verifies assignment

---

## API Routes Detail

### `POST /api/workflows/trigger`
Body: `{ workflowId, params: Record<string, unknown> }`
1. Authenticate + verify assignment via user_workflows
2. Fetch workflow row to get `webhook_url` and `config`
3. Merge config (systemPrompt) + user params into request body
4. `fetch(webhook_url, { method: 'POST', body: JSON.stringify(payload) })`
5. Return n8n response JSON to client

### `POST /api/workflows/chat`
Body: `{ workflowId, message, history?: Message[] }`
1. Authenticate + verify assignment
2. Fetch workflow `webhook_url` + `config`
3. POST `{ message, history, systemPrompt, ...params }` to webhook
4. Stream or return response

### `POST /api/documents/process`
Body: `{ documentId }`
1. Authenticate user, verify document ownership
2. Download file from Supabase Storage (admin client)
3. Parse to text: `pdf-parse` for PDF, `mammoth` for DOCX, direct read for TXT/MD
4. Chunk: ~1000 chars with 100-char overlap (matching user story spec)
5. Embed: `openai.embeddings.create({ model: 'text-embedding-3-small', input: chunks })`
6. Insert rows into `knowledge_base`: `{ content, metadata: { doc_id, file_id: documentId, chunk_index, name }, embedding, workflow_id }`
7. Update document: `status='ready'`, `chunk_count=N`
8. On error: `status='error'`, `error_message=err.message`

**Dependencies:** `npm install openai pdf-parse mammoth`

### `GET /api/documents/status?id={documentId}`
Returns `{ status, chunk_count, error_message }` — for client polling.

---

## Dashboard — User Experience

`/dashboard/workflow` page:
- If user has **no workflows**: show Card "No workflows assigned. Contact your administrator."
- If user has **one workflow**: auto-selected (no dropdown)
- If user has **multiple workflows**: show `WorkflowSelector` dropdown driven by `?workflow=uuid` searchParam

Per selected workflow, the page adapts to type:

### Chat workflow (`type = 'chat'`)
1. **Chat** — `ChatInterface`: scrollable message history, input box, send button. Each send POSTs to `/api/workflows/chat`.
2. **Settings** — `SystemPromptForm`: editable system prompt + save.
3. **Knowledge Base** (if `has_knowledge_base`) — `DocumentManager`: upload + list + delete.

### Trigger workflow (`type = 'trigger'`)
1. **Run** — `TriggerWorkflow`: dynamically renders param inputs from `config.params`, Trigger button, response area.
2. **Settings** — `SystemPromptForm` (if workflow has a system prompt concept).
3. **Knowledge Base** (if `has_knowledge_base`) — `DocumentManager`.

---

## Document Upload Flow

1. User selects file → client validates size (< 10 MB) and type
2. `initiateDocumentUploadAction()` → `{ documentId, signedUploadUrl }`
3. Client `PUT`s file directly to Supabase Storage (bypasses Next.js body limit)
4. `triggerDocumentProcessingAction(documentId)` — fire-and-forget
5. Client polls `GET /api/documents/status?id=documentId` every 3 s
6. On `status=ready/error`: `router.refresh()` to re-render server component

Document deletion cascade:
- Deletes storage file
- Deletes `documents` row → `knowledge_base` rows where `metadata->>'file_id' = documentId` must be cleaned up in the delete action (no FK cascade possible on JSONB field)

---

## WorkflowForm — Config Fields

| Field | Admin only | User editable |
|-------|-----------|---------------|
| name | ✓ | |
| description | ✓ | |
| type (chat/trigger) | ✓ | |
| webhook_url | ✓ | |
| has_knowledge_base | ✓ | |
| is_active | ✓ | |
| config.systemPrompt | ✓ (default) | ✓ (override) |
| config.model | ✓ | |
| config.temperature | ✓ | |
| config.params | ✓ (define schema) | ✓ (fill values) |

`config.params` schema (admin defines):
```json
[
  { "key": "language", "label": "Response Language", "type": "select", "options": ["English","Greek"], "required": true, "default": "English" },
  { "key": "tone", "label": "Tone", "type": "text", "required": false }
]
```

---

## Translation Keys to Add (`en.json` / `el.json`)

```
workflows, workflow, createWorkflow, updateWorkflow, deleteWorkflow,
workflowName, workflowType, workflowTypeChat, workflowTypeTrigger,
workflowWebhookUrl, workflowHasKnowledgeBase, workflowActive,
workflowSystemPrompt, workflowParams, workflowConfig,
workflowCreatedSuccess, workflowUpdatedSuccess, workflowDeletedSuccess, noWorkflowsFound,
assignedUsers, assignUser, unassignUser, workflowAssignedSuccess, workflowUnassignedSuccess,
knowledgeBase, uploadDocument, documentName, documentType, documentSize, documentChunks,
documentStatus, documentStatusPending, documentStatusProcessing, documentStatusReady, documentStatusError,
documentDeletedSuccess, noDocumentsFound, uploadDocumentHint, uploadDocumentDropzone,
noWorkflowsAssigned, selectWorkflow, myWorkflows,
triggerWorkflow, triggering, triggerSuccess, triggerError, triggerResponse,
chatPlaceholder, sendMessage, chatHistory, clearChat,
systemPromptSaved, saveSystemPrompt, systemPromptHint
```

---

## Proxy/Middleware

No changes needed. Existing matchers cover:
- `/admin/workflow/*` — ADMIN role required
- `/dashboard/workflow/*` — authenticated + ACTIVE
- `/api/workflows/*`, `/api/documents/*` — existing API auth check

---

## Verification Plan

1. **DB**: Run migration; verify tables, RLS, indexes; test cascade deletes
2. **Admin workflow CRUD**: Create → list → update → delete via UI; verify webhook_url stored
3. **Assignment**: Admin assigns user A to workflow X; user A sees it; user B does not
4. **Chat trigger**: User A sends message → n8n webhook receives `{ message, systemPrompt }`; response displayed
5. **Trigger workflow**: User fills params → trigger → n8n webhook receives merged payload → response shown
6. **System prompt edit**: User edits prompt; verify only `config.systemPrompt` updated in DB
7. **Document upload**: Upload PDF; verify status pending→processing→ready; KB rows with non-null embeddings; `workflow_id` correct
8. **Document delete**: Delete doc; verify storage + document row + KB rows removed
9. **Auth guards**: `/admin/workflow` as USER → redirect; another user's workflow doc → 403
10. **Translations**: Greek locale, all new pages, no raw keys
11. **Sidebar**: ADMIN sees admin + dashboard workflow links; USER sees only dashboard link
