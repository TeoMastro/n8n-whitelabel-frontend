'use client';

import { useState, useTransition, useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  assignWorkflowToUserAction,
  unassignWorkflowFromUserAction,
} from '@/server-actions/workflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserPlus, UserMinus } from 'lucide-react';
import { InfoAlert } from '@/components/info-alert';
import { AssignWorkflowFormState } from '@/types/workflow';

export function WorkflowAssignments({
  workflowId,
  assignments,
}: {
  workflowId: string;
  assignments: any[];
}) {
  const t = useTranslations('app');
  const [isPending, startTransition] = useTransition();
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const initialAssignState: AssignWorkflowFormState = {
    success: false,
    errors: {},
    formData: { user_id: '', workflow_id: workflowId },
    globalError: null,
  };

  const [assignState, assignAction, isAssigning] = useActionState(
    assignWorkflowToUserAction,
    initialAssignState
  );

  const handleUnassign = async (userId: string) => {
    startTransition(async () => {
      try {
        await unassignWorkflowFromUserAction(userId, workflowId);
        setAlert({ message: t('workflowUnassignedSuccess'), type: 'success' });
      } catch {
        setAlert({ message: t('unexpectedError'), type: 'error' });
      }
    });
  };

  return (
    <div className="space-y-4">
      {alert && <InfoAlert message={alert.message} type={alert.type} />}

      {/* Assign form */}
      <form action={assignAction} className="flex gap-2 items-end">
        <input type="hidden" name="workflow_id" value={workflowId} />
        <div className="flex-1 space-y-1">
          <Label htmlFor="user_id">{t('assignUser')}</Label>
          <Input
            id="user_id"
            name="user_id"
            placeholder={t('userIdPlaceholder')}
            defaultValue={assignState.formData.user_id}
            className={assignState.errors.user_id ? 'border-red-500' : ''}
          />
        </div>
        <Button type="submit" disabled={isAssigning}>
          <UserPlus className="h-4 w-4 mr-1" />
          {t('assignUser')}
        </Button>
      </form>

      {assignState.globalError && (
        <InfoAlert message={t(assignState.globalError)} type="error" />
      )}
      {assignState.success && (
        <InfoAlert message={t('workflowAssignedSuccess')} type="success" />
      )}

      <Separator />

      {/* Assignments table */}
      {assignments.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('noAssignedUsers')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('email')}</TableHead>
              <TableHead>{t('assignedAt')}</TableHead>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((a) => (
              <TableRow key={a.userId}>
                <TableCell>
                  {a.user.firstName} {a.user.lastName}
                </TableCell>
                <TableCell>{a.user.email}</TableCell>
                <TableCell>
                  {new Date(a.assignedAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleUnassign(a.userId)}
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
