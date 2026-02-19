import { Role, Status } from '@/lib/constants';

export type User = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: Role;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
  image?: string | null;
};

export type UserFormState = {
  success: boolean;
  errors: Record<string, string[]>;
  formData: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    role: Role;
    status: Status;
  };
  globalError: string | null;
};

export type GetUsersParams = {
  page?: string;
  limit?: string;
  search?: string;
  roleFilter?: string;
  statusFilter?: string;
  sortField?: string;
  sortDirection?: string;
};

export type GetUsersResult = {
  users: User[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  limit: number;
};

export type GetUsersResultWithoutPagination = {
  users: User[];
};

export type AdminUsersPageProps = {
  searchParams: Promise<GetUsersParams>;
};

export type UserFormProps = {
  user?: Omit<User, 'createdAt' | 'updatedAt'> | null;
  mode: 'create' | 'update';
};

export type UserViewProps = {
  user: User;
};

export interface PageProps {
  params: Promise<{ id: string }>;
}

export type UsersTableProps = {
  users: User[];
  currentUserId: string;
  // Pagination props
  totalCount: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  // Current state props
  sortField: string;
  sortDirection: 'asc' | 'desc';
  searchTerm: string;
  roleFilter: string;
  statusFilter: string;
};
