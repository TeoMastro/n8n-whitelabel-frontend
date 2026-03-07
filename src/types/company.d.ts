import { User } from '@/types/user';

export type Company = {
  id: string;
  name: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CompanyWithUsers = Company & {
  users: {
    userId: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    assignedAt: Date;
    assignedBy: string | null;
  }[];
};

export type CompanyFormState = {
  success: boolean;
  errors: Record<string, string[]>;
  formData: {
    name: string;
    note: string;
  };
  globalError: string | null;
};

export type AssignUserToCompanyFormState = {
  success: boolean;
  errors: Record<string, string[]>;
  formData: {
    user_id: string;
    company_id: string;
  };
  globalError: string | null;
};

export type GetCompaniesParams = {
  page?: string;
  limit?: string;
  search?: string;
  sortField?: string;
  sortDirection?: string;
};

export type GetCompaniesResult = {
  companies: Company[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  limit: number;
};

export type CompanyTableProps = {
  companies: Company[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  searchTerm: string;
};

export type CompanyFormProps = {
  company?: Omit<Company, 'createdAt' | 'updatedAt'> | null;
  mode: 'create' | 'update';
};

export type CompanyViewProps = {
  company: Company;
  assignments: CompanyWithUsers['users'];
  users: User[];
};
