'use client';

import { useState, useTransition, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  deleteWorkflowAction,
  assignWorkflowToUserAction,
  unassignWorkflowFromUserAction,
} from '@/server-actions/workflow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Edit, Trash2, UserPlus, UserMinus, Globe, Database } from 'lucide-react';
import { InfoAlert } from '@/components/info-alert';
import { WorkflowViewProps, AssignWorkflowFormState } from '@/types/workflow';

export function WorkflowView({ workflow, assignments }: WorkflowViewProps) {
  const router = useRouter();
  const t = useTranslations('app');
  const [isPending, startTransition] = useTransition();
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const initialAssignState: AssignWorkflowFormState = {
    success: false,
    errors: {},
    formData: { user_id: '', workflow_id: workflow.id },
    globalError: null,
  };

  const [assignState, assignAction, isAssigning] = useActionState(
    assignWorkflowToUserAction,
    initialAssignState
  );

  const handleDelete = async () => {
    startTransition(async () => {
      try {
        await deleteWorkflowAction(workflow.id);
        router.push('/admin/workflow?message=workflowDeletedSuccess');
      } catch {
        setAlert({ message: t('unexpectedError'), type: 'error' });
      }
    });
  };

  const handleUnassign = async (userId: string) => {
    startTransition(async () => {
      try {
        await unassignWorkflowFromUserAction(userId, workflow.id);
        setAlert({ message: t('workflowUnassignedSuccess'), type: 'success' });
      } catch {
        setAlert({ message: t('unexpectedError'), type: 'error' });
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/workflow')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">{workflow.name}</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/workflow/${workflow.id}/update`)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isPending}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('deleteWorkflowConfirmation', { name: workflow.name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-white"
                >
                  {t('delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {alert && <InfoAlert message={alert.message} type={alert.type} />}

      {/* Workflow Details */}
      <Card>
        <CardHeader>
          <CardTitle>{t('workflowConfig')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {workflow.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">{t('description')}</label>
                  <p className="mt-1">{workflow.description}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('workflowType')}</label>
                <div className="mt-1">
                  <Badge variant={workflow.type === 'chat' ? 'default' : 'secondary'}>
                    {workflow.type === 'chat' ? t('workflowTypeChat') : t('workflowTypeTrigger')}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('status')}</label>
                <div className="mt-1">
                  <Badge variant={workflow.isActive ? 'default' : 'destructive'}>
                    {workflow.isActive ? t('activeStatus') : t('inactiveStatus')}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {t('workflowWebhookUrl')}
                </label>
                <p className="mt-1 text-sm font-mono break-all text-muted-foreground">
                  {workflow.webhookUrl}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  {t('knowledgeBase')}
                </label>
                <div className="mt-1">
                  <Badge variant={workflow.hasKnowledgeBase ? 'outline' : 'secondary'}>
                    {workflow.hasKnowledgeBase ? t('active') : t('inactiveStatus')}
                  </Badge>
                </div>
              </div>

            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>{t('assignedUsers')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Assign form */}
          <form action={assignAction} className="flex gap-2 items-end">
            <input type="hidden" name="workflow_id" value={workflow.id} />
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
        </CardContent>
      </Card>
    </div>
  );
}
