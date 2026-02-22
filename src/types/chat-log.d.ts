export type ChatSession = {
  sessionId: string;
  workflowId: string;
  workflowName: string;
  messageCount: number;
  firstMessageAt: Date;
  lastMessageAt: Date;
};

export type ChatLogEntry = {
  id: string;
  sessionId: string;
  humanMessage: string;
  aiResponse: string;
  createdAt: Date;
};

export type GetChatSessionsParams = {
  page?: string;
  limit?: string;
  search?: string;
  workflowFilter?: string;
  sortField?: string;
  sortDirection?: string;
};

export type GetChatSessionsResult = {
  sessions: ChatSession[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  limit: number;
};

export type ChatSessionTableProps = {
  sessions: ChatSession[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  searchTerm: string;
  workflowFilter: string;
  workflows: { id: string; name: string }[];
};

export type ChatSessionDetailProps = {
  sessionId: string;
  workflowName: string;
  messages: ChatLogEntry[];
};
