import { WorkflowType, DocumentStatus } from '@/lib/constants';
import { User } from '@/types/user';
import { Company } from '@/types/company';


export type WorkflowParam = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'boolean';
  options?: string[];
  required: boolean;
  default?: string;
};

export type WorkflowConfig = {
  params?: WorkflowParam[];
};

export type Workflow = {
  id: string;
  companyId: string;
  companyName?: string;
  name: string;
  description: string | null;
  type: WorkflowType;
  webhookUrl: string;
  hasKnowledgeBase: boolean;
  config: WorkflowConfig;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowDocument = {
  id: string;
  workflowId: string;
  uploadedBy: string;
  name: string;
  fileType: string;
  storagePath: string;
  fileSizeBytes: number | null;
  status: DocumentStatus;
  errorMessage: string | null;
  chunkCount: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowFormState = {
  success: boolean;
  errors: Record<string, string[]>;
  formData: {
    company_id: string;
    name: string;
    description: string;
    type: WorkflowType;
    webhook_url: string;
    has_knowledge_base: boolean;
    is_active: boolean;
    params_json: string;
  };
  globalError: string | null;
};

export type SystemPromptFormState = {
  success: boolean;
  errors: Record<string, string[]>;
  formData: {
    system_prompt: string;
  };
  globalError: string | null;
};

export type DocumentFormState = {
  success: boolean;
  errors: Record<string, string[]>;
  formData: {
    workflow_id: string;
  };
  globalError: string | null;
  documentId?: string;
  signedUploadUrl?: string;
};

export type GetWorkflowsParams = {
  page?: string;
  limit?: string;
  search?: string;
  typeFilter?: string;
  companyFilter?: string;
  sortField?: string;
  sortDirection?: string;
};

export type GetWorkflowsResult = {
  workflows: Workflow[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  limit: number;
};

export type WorkflowTableProps = {
  workflows: Workflow[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  searchTerm: string;
  typeFilter: string;
  companyFilter: string;
  companies: { id: string; name: string }[];
};

export type WorkflowFormProps = {
  workflow?: Omit<Workflow, 'createdAt' | 'updatedAt'> | null;
  mode: 'create' | 'update';
  companies: { id: string; name: string }[];
};

export type WorkflowViewProps = {
  workflow: Workflow;
  documents?: WorkflowDocument[];
};

export type AdminWorkflowPageProps = {
  searchParams: Promise<GetWorkflowsParams>;
};

export interface WorkflowPageProps {
  params: Promise<{ id: string }>;
}
