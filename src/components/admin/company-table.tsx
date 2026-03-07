'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { deleteCompanyAction } from '@/server-actions/company';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Pencil, Trash2, Plus, Eye, X } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { Pagination } from '@/components/layout/pagination';
import { SortableTableHeader, SortField } from '@/components/layout/sortable-table-header';
import { InfoAlert } from '@/components/info-alert';
import { CompanyTableProps } from '@/types/company';

export function CompanyTable({
  companies,
  totalCount,
  totalPages,
  currentPage,
  limit,
  sortField,
  sortDirection,
  searchTerm,
}: CompanyTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('app');

  const [searchLocal, setSearchLocal] = useState(searchTerm);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const message = searchParams.get('message');

  const updateUrl = useCallback(
    (params: Record<string, string>) => {
      const current = new URLSearchParams(searchParams);
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== '') {
          current.set(key, value);
        } else {
          current.delete(key);
        }
      });
      router.push(`${pathname}?${current.toString()}`);
    },
    [searchParams, pathname, router]
  );

  useEffect(() => {
    if (message) {
      const url = new URL(window.location.href);
      url.searchParams.delete('message');
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [message, router]);

  const handleSort = useCallback(
    (field: SortField) => {
      const newDir = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
      updateUrl({ sortField: field, sortDirection: newDir, page: '1' });
    },
    [sortField, sortDirection, updateUrl]
  );

  const handlePageChange = useCallback(
    (page: number) => updateUrl({ page: page.toString() }),
    [updateUrl]
  );

  const debouncedSearch = useDebouncedCallback((value: string) => {
    updateUrl({ search: value, page: '1' });
  }, 300);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      try {
        await deleteCompanyAction(id);
        setAlert({ message: t('companyDeletedSuccess'), type: 'success' });
      } catch {
        setAlert({ message: t('unexpectedError'), type: 'error' });
      } finally {
        setDeletingId(null);
      }
    });
  };

  const handleReset = useCallback(() => {
    setSearchLocal('');
    updateUrl({ search: '', page: '1' });
  }, [updateUrl]);

  const hasFilters = searchLocal !== '';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('companies')}</h1>
        <Button onClick={() => router.push('/admin/company/create')}>
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">{t('create')}</span>
        </Button>
      </div>

      {message && <InfoAlert message={t(message)} type="success" />}
      {alert && <InfoAlert message={alert.message} type={alert.type} />}

      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder={t('searchCompanies')}
          value={searchLocal}
          onChange={(e) => {
            setSearchLocal(e.target.value);
            debouncedSearch(e.target.value);
          }}
          className="w-full md:max-w-sm"
        />
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            <X className="mr-2 h-4 w-4" />
            {t('resetFilters')}
          </Button>
        )}
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHeader field="name" currentField={sortField} direction={sortDirection} onSort={handleSort}>
                {t('name')}
              </SortableTableHeader>
              <TableHead>{t('companyNote')}</TableHead>
              <SortableTableHeader field="createdAt" currentField={sortField} direction={sortDirection} onSort={handleSort}>
                {t('created')}
              </SortableTableHeader>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((company) => (
              <TableRow key={company.id}>
                <TableCell className="font-medium">{company.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">
                  {company.note || '—'}
                </TableCell>
                <TableCell>
                  {new Date(company.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/company/${company.id}`)}
                      disabled={isPending}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/company/${company.id}/update`)}
                      disabled={isPending}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending || deletingId === company.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('deleteCompanyConfirmation', { name: company.name })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(company.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-white"
                          >
                            {t('delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {companies.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">{t('noCompaniesFound')}</div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        totalCount={totalCount}
        limit={limit}
      />
    </div>
  );
}
