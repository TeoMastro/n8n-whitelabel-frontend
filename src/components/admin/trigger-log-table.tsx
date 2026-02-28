'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { Badge } from '@/components/ui/badge';
import { Eye, X } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { Pagination } from '@/components/layout/pagination';
import { SortableTableHeader, SortField } from '@/components/layout/sortable-table-header';
import type { TriggerLogEntry } from '@/types/trigger-log';

interface TriggerLogTableProps {
  logs: TriggerLogEntry[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  searchTerm: string;
  workflowFilter: string;
  statusFilter: string;
  workflows: { id: string; name: string }[];
}

export function TriggerLogTable({
  logs,
  totalCount,
  totalPages,
  currentPage,
  limit,
  sortField,
  sortDirection,
  searchTerm,
  workflowFilter,
  statusFilter,
  workflows,
}: TriggerLogTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('app');

  const [searchLocal, setSearchLocal] = useState(searchTerm);
  const [workflowFilterLocal, setWorkflowFilterLocal] = useState(workflowFilter);
  const [statusFilterLocal, setStatusFilterLocal] = useState(statusFilter);

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

  const handleWorkflowFilter = useCallback(
    (value: string) => {
      setWorkflowFilterLocal(value);
      updateUrl({ workflowFilter: value, page: '1' });
    },
    [updateUrl]
  );

  const handleStatusFilter = useCallback(
    (value: string) => {
      setStatusFilterLocal(value);
      updateUrl({ statusFilter: value, page: '1' });
    },
    [updateUrl]
  );

  const handleReset = useCallback(() => {
    setSearchLocal('');
    setWorkflowFilterLocal('all');
    setStatusFilterLocal('all');
    updateUrl({ search: '', workflowFilter: 'all', statusFilter: 'all', page: '1' });
  }, [updateUrl]);

  const hasFilters = searchLocal !== '' || workflowFilterLocal !== 'all' || statusFilterLocal !== 'all';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('triggerHistory')}</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder={t('search')}
          value={searchLocal}
          onChange={(e) => {
            setSearchLocal(e.target.value);
            debouncedSearch(e.target.value);
          }}
          className="w-full md:max-w-sm"
        />
        <Select value={statusFilterLocal || 'all'} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-full md:w-[160px]">
            <SelectValue placeholder={t('filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatuses')}</SelectItem>
            <SelectItem value="success">{t('success') || 'Success'}</SelectItem>
            <SelectItem value="error">{t('error') || 'Error'}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={workflowFilterLocal || 'all'} onValueChange={handleWorkflowFilter}>
          <SelectTrigger className="w-full md:w-[220px]">
            <SelectValue placeholder={t('filterByWorkflow')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allWorkflows')}</SelectItem>
            {workflows.map((wf) => (
              <SelectItem key={wf.id} value={wf.id}>
                {wf.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={handleReset} className="h-10">
            <X className="mr-2 h-4 w-4" />
            {t('resetFilters')}
          </Button>
        )}
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHeader field="workflow_name" currentField={sortField} direction={sortDirection} onSort={handleSort}>
                {t('workflowName')}
              </SortableTableHeader>
              <SortableTableHeader field="user_email" currentField={sortField} direction={sortDirection} onSort={handleSort}>
                {t('userEmail')}
              </SortableTableHeader>
              <SortableTableHeader field="status" currentField={sortField} direction={sortDirection} onSort={handleSort}>
                {t('status')}
              </SortableTableHeader>
              <SortableTableHeader field="duration_ms" currentField={sortField} direction={sortDirection} onSort={handleSort}>
                {t('durationMs')}
              </SortableTableHeader>
              <SortableTableHeader field="created_at" currentField={sortField} direction={sortDirection} onSort={handleSort}>
                {t('createdAt') || 'Created At'}
              </SortableTableHeader>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <Badge variant="outline">{log.workflowName}</Badge>
                </TableCell>
                <TableCell>{log.userEmail}</TableCell>
                <TableCell>
                  <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-sm">
                    {t(log.status)}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">{log.durationMs}ms</TableCell>
                <TableCell>
                  {new Date(log.createdAt).toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/trigger-history/${log.id}`)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {logs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">{t('noResults') || 'No results found.'}</div>
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
