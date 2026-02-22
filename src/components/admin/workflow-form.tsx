'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { createWorkflowAction, updateWorkflowAction } from '@/server-actions/workflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoAlert } from '@/components/info-alert';
import { WorkflowFormProps, WorkflowFormState } from '@/types/workflow';
import { WorkflowType } from '@/lib/constants';

export function WorkflowForm({ workflow, mode }: WorkflowFormProps) {
  const t = useTranslations('app');

  const initialState: WorkflowFormState = {
    success: false,
    errors: {},
    formData: {
      name: workflow?.name ?? '',
      description: workflow?.description ?? '',
      type: workflow?.type ?? WorkflowType.CHAT,
      webhook_url: workflow?.webhookUrl ?? '',
      has_knowledge_base: workflow?.hasKnowledgeBase ?? false,
      is_active: workflow?.isActive ?? true,
      params_json: workflow?.config?.params?.length
        ? JSON.stringify(workflow.config.params, null, 2)
        : '',

    },
    globalError: null,
  };

  const actionWrapper = async (
    prevState: WorkflowFormState,
    formData: FormData
  ): Promise<WorkflowFormState> => {
    if (mode === 'create') {
      return createWorkflowAction(prevState, formData);
    }
    return updateWorkflowAction(workflow!.id, prevState, formData);
  };

  const [state, formAction, isPending] = useActionState(actionWrapper, initialState);

  const err = (field: string) => {
    const errs = state.errors[field];
    return errs?.length ? t(errs[0]) : null;
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>
          {mode === 'create' ? t('createWorkflow') : t('updateWorkflow')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate className="space-y-4">
          {state.globalError && (
            <InfoAlert message={t(state.globalError)} type="error" />
          )}

          <div className="space-y-2">
            <Label htmlFor="name">{t('workflowName')}</Label>
            <Input
              id="name"
              name="name"
              defaultValue={state.formData.name}
              className={state.errors.name ? 'border-red-500' : ''}
              required
            />
            {err('name') && <p className="text-sm text-red-500">{err('name')}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('description')}</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={state.formData.description}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">{t('workflowType')}</Label>
              <Select name="type" defaultValue={state.formData.type}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chat">{t('workflowTypeChat')}</SelectItem>
                  <SelectItem value="trigger">{t('workflowTypeTrigger')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_active">{t('status')}</Label>
              <Select
                name="is_active"
                defaultValue={state.formData.is_active ? 'on' : 'off'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">{t('activeStatus')}</SelectItem>
                  <SelectItem value="off">{t('inactiveStatus')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook_url">{t('workflowWebhookUrl')}</Label>
            <Input
              id="webhook_url"
              name="webhook_url"
              type="url"
              defaultValue={state.formData.webhook_url}
              className={state.errors.webhook_url ? 'border-red-500' : ''}
              placeholder="https://your-n8n-instance.com/webhook/..."
              required
            />
            {err('webhook_url') && <p className="text-sm text-red-500">{err('webhook_url')}</p>}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="has_knowledge_base"
              name="has_knowledge_base"
              value="on"
              defaultChecked={state.formData.has_knowledge_base}
              className="h-4 w-4"
            />
            <Label htmlFor="has_knowledge_base">{t('workflowHasKnowledgeBase')}</Label>
          </div>

          {state.formData.type !== 'chat' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="params_json">{t('workflowParams')}</Label>
                <Textarea
                  id="params_json"
                  name="params_json"
                  defaultValue={state.formData.params_json}
                  rows={4}
                  className={`font-mono text-sm${state.errors.params_json ? ' border-red-500' : ''}`}
                  placeholder='[{"key":"language","label":"Language","type":"select","options":["en","gr"],"required":true}]'
                />
                <p className="text-sm text-muted-foreground">{t('workflowParamsHint')}</p>
                {err('params_json') && <p className="text-sm text-red-500">{err('params_json')}</p>}
              </div>


            </>
          )}

          <div className="flex gap-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? t('saving') : mode === 'create' ? t('create') : t('update')}
            </Button>
            <Button type="button" variant="outline" onClick={() => window.history.back()}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
