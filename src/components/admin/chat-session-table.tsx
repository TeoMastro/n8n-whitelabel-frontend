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
import { ChatSessionTableProps } from '@/types/chat-log';

export function ChatSessionTable({
  sessions,
  totalCount,
  totalPages,
  currentPage,
  limit,
  sortField,
  sortDirection,
  searchTerm,
  workflowFilter,
  workflows,
}: ChatSessionTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('app');

  const [searchLocal, setSearchLocal] = useState(searchTerm);
  const [workflowFilterLocal, setWorkflowFilterLocal] = useState(workflowFilter);

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

  const handleReset = useCallback(() => {
    setSearchLocal('');
    setWorkflowFilterLocal('all');
    updateUrl({ search: '', workflowFilter: 'all', page: '1' });
  }, [updateUrl]);

  const hasFilters = searchLocal !== '' || workflowFilterLocal !== 'all';

  const truncateSessionId = (id: string) => {
    if (id.length <= 16) return id;
    return `${id.slice(0, 8)}…${id.slice(-8)}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('chatHistory')}</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder={t('searchSessions')}
          value={searchLocal}
          onChange={(e) => {
            setSearchLocal(e.target.value);
            debouncedSearch(e.target.value);
          }}
          className="w-full md:max-w-sm"
        />
        <Select value={workflowFilterLocal} onValueChange={handleWorkflowFilter}>
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
              <TableHead>{t('sessionId')}</TableHead>
              <SortableTableHeader field="workflowName" currentField={sortField} direction={sortDirection} onSort={handleSort}>
                {t('workflow')}
              </SortableTableHeader>
              <SortableTableHeader field="messageCount" currentField={sortField} direction={sortDirection} onSort={handleSort}>
                {t('messageCount')}
              </SortableTableHeader>
              <SortableTableHeader field="firstMessageAt" currentField={sortField} direction={sortDirection} onSort={handleSort}>
                {t('firstMessage')}
              </SortableTableHeader>
              <SortableTableHeader field="lastMessageAt" currentField={sortField} direction={sortDirection} onSort={handleSort}>
                {t('lastMessage')}
              </SortableTableHeader>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.sessionId}>
                <TableCell className="font-mono text-sm" title={session.sessionId}>
                  {truncateSessionId(session.sessionId)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{session.workflowName}</Badge>
                </TableCell>
                <TableCell>{session.messageCount}</TableCell>
                <TableCell>
                  {new Date(session.firstMessageAt).toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell>
                  {new Date(session.lastMessageAt).toLocaleString('en-US', {
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
                    onClick={() => router.push(`/chat-history/${encodeURIComponent(session.sessionId)}`)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {sessions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">{t('noChatSessionsFound')}</div>
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
