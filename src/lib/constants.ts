// Replaces @prisma/client enums with plain string constants

export const WorkflowType = {
  CHAT: 'chat',
  TRIGGER: 'trigger',
} as const;

export type WorkflowType = (typeof WorkflowType)[keyof typeof WorkflowType];

export const DocumentStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  ERROR: 'error',
} as const;

export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const SUPPORTED_FILE_TYPES = ['pdf', 'txt', 'docx', 'md'] as const;
export type SupportedFileType = (typeof SUPPORTED_FILE_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const Role = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const Status = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  UNVERIFIED: 'UNVERIFIED',
} as const;

export type Status = (typeof Status)[keyof typeof Status];

