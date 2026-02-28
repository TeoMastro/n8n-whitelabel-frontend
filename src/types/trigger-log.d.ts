export type TriggerLogEntry = {
  id: string;
  workflowId: string;
  workflowName: string;
  userId: string;
  userEmail: string;
  status: 'success' | 'error';
  requestParams: Record<string, unknown>;
  responseData: unknown;
  errorMessage: string | null;
  durationMs: number;
  createdAt: Date;
  executionId: string | null;
  totalCost: number;
};

export type GetTriggerLogsParams = {
  page?: string;
  limit?: string;
  search?: string;
  workflowFilter?: string;
  statusFilter?: string;
  sortField?: string;
  sortDirection?: string;
};

export type GetTriggerLogsResult = {
  logs: TriggerLogEntry[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  limit: number;
};
