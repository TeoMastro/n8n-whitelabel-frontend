import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Globe, Database } from 'lucide-react';
import { WorkflowViewProps } from '@/types/workflow';
import { DocumentManager } from '@/components/workflow/document-manager';
import { TriggerWorkflow } from '@/components/workflow/trigger-workflow';
import { HostedChat } from '@/components/workflow/hosted-chat';
import { WorkflowDeleteButton } from './workflow-delete-button';
import { WorkflowAssignments } from './workflow-assignments';
import Link from 'next/link';

export function WorkflowView({ workflow, assignments, documents = [], users = [] }: WorkflowViewProps) {
  const t = useTranslations('app');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/workflow">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{workflow.name}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/admin/workflow/${workflow.id}/update`}>
              <Edit className="h-4 w-4" />
            </Link>
          </Button>
          <WorkflowDeleteButton workflowId={workflow.id} workflowName={workflow.name} />
        </div>
      </div>

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
        <CardContent>
          <WorkflowAssignments workflowId={workflow.id} assignments={assignments} users={users} />
        </CardContent>
      </Card>

      {/* Workflow Interaction Area */}
      <h2 className="text-xl font-bold mt-8">{t('testWorkflow')}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {workflow.type === 'chat' ? (
          <>
            <div className="space-y-6">
              {workflow.hasKnowledgeBase && (
                <DocumentManager
                  workflowId={workflow.id}
                  initialDocuments={documents}
                />
              )}
            </div>
            <div className="space-y-6">
              <HostedChat workflow={workflow} />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-6">
              <TriggerWorkflow workflow={workflow} />
            </div>
            <div className="space-y-6">
              {workflow.hasKnowledgeBase && (
                <DocumentManager
                  workflowId={workflow.id}
                  initialDocuments={documents}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
