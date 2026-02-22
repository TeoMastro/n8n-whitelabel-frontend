'use client';

import { useState, useTransition, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { deleteWorkflowAction } from '@/server-actions/workflow';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Plus, Eye, X } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { Pagination } from '@/components/layout/pagination';
import { SortableTableHeader, SortField } from '@/components/layout/sortable-table-header';
import { InfoAlert } from '@/components/info-alert';
import { WorkflowTableProps } from '@/types/workflow';

export function WorkflowTable({
  workflows,
  totalCount,
  totalPages,
  currentPage,
  limit,
  sortField,
  sortDirection,
  searchTerm,
  typeFilter,
}: WorkflowTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('app');

  const [searchLocal, setSearchLocal] = useState(searchTerm);
  const [typeFilterLocal, setTypeFilterLocal] = useState(typeFilter);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const message = searchParams.get('message');

  const updateUrl = useCallback(
    (params: Record<string, string>) => {
      const current = new URLSearchParams(searchParams);
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== 'all' && value !== '') {
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

  const handleTypeFilter = useCallback(
    (value: string) => {
      setTypeFilterLocal(value);
      updateUrl({ typeFilter: value, page: '1' });
    },
    [updateUrl]
  );

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      try {
        await deleteWorkflowAction(id);
        setAlert({ message: t('workflowDeletedSuccess'), type: 'success' });
      } catch {
        setAlert({ message: t('unexpectedError'), type: 'error' });
      } finally {
        setDeletingId(null);
      }
    });
  };

  const handleReset = useCallback(() => {
    setSearchLocal('');
    setTypeFilterLocal('all');
    updateUrl({ search: '', typeFilter: 'all', page: '1' });
  }, [updateUrl]);

  const hasFilters = searchLocal !== '' || typeFilterLocal !== 'all';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('workflows')}</h1>
        <Button onClick={() => router.push('/admin/workflow/create')}>
          <Plus className="h-4 w-4" />
          <span className="hidden md:block">{t('create')}</span>
        </Button>
      </div>

      {message && <InfoAlert message={t(message)} type="success" />}
      {alert && <InfoAlert message={alert.message} type={alert.type} />}

      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder={t('searchWorkflows')}
          value={searchLocal}
          onChange={(e) => {
            setSearchLocal(e.target.value);
            debouncedSearch(e.target.value);
          }}
          className="w-full md:max-w-sm"
        />
        <Select value={typeFilterLocal} onValueChange={handleTypeFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder={t('filterByType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTypes')}</SelectItem>
            <SelectItem value="chat">{t('workflowTypeChat')}</SelectItem>
            <SelectItem value="trigger">{t('workflowTypeTrigger')}</SelectItem>
          </SelectContent>
        </Select>
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
              <SortableTableHeader field="type" currentField={sortField} direction={sortDirection} onSort={handleSort}>
                {t('workflowType')}
              </SortableTableHeader>
              <TableHead>{t('knowledgeBase')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <SortableTableHeader field="createdAt" currentField={sortField} direction={sortDirection} onSort={handleSort}>
                {t('created')}
              </SortableTableHeader>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((wf) => (
              <TableRow key={wf.id}>
                <TableCell className="font-medium">{wf.name}</TableCell>
                <TableCell>
                  <Badge variant={wf.type === 'chat' ? 'default' : 'secondary'}>
                    {wf.type === 'chat' ? t('workflowTypeChat') : t('workflowTypeTrigger')}
                  </Badge>
                </TableCell>
                <TableCell>
                  {wf.hasKnowledgeBase ? (
                    <Badge variant="outline">{t('active')}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={wf.isActive ? 'default' : 'destructive'}>
                    {wf.isActive ? t('activeStatus') : t('inactiveStatus')}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(wf.createdAt).toLocaleDateString('en-US', {
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
                      onClick={() => router.push(`/admin/workflow/${wf.id}`)}
                      disabled={isPending}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/workflow/${wf.id}/update`)}
                      disabled={isPending}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending || deletingId === wf.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('deleteWorkflowConfirmation', { name: wf.name })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(wf.id)}
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

        {workflows.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">{t('noWorkflowsFound')}</div>
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
