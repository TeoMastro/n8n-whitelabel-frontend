import { getSession } from '@/lib/auth-session';
import { redirect } from 'next/navigation';
import { getUserWorkflows } from '@/server-actions/workflow';
import { getDocumentsForWorkflow } from '@/server-actions/document';
import { WorkflowSelector } from '@/components/workflow/workflow-selector';

import { TriggerWorkflow } from '@/components/workflow/trigger-workflow';
import { HostedChat } from '@/components/workflow/hosted-chat';
import { DocumentManager } from '@/components/workflow/document-manager';
import { Card, CardContent } from '@/components/ui/card';
import { getTranslations } from 'next-intl/server';

interface WorkflowDashboardPageProps {
  searchParams: Promise<{ workflow?: string }>;
}

export default async function WorkflowDashboardPage({
  searchParams,
}: WorkflowDashboardPageProps) {
  const session = await getSession();
  if (!session) redirect('/auth/signin');

  const t = await getTranslations('app');
  const params = await searchParams;

  const workflows = await getUserWorkflows();

  if (workflows.length === 0) {
    return (
      <div className="container mx-auto py-6">
        <Card className="max-w-lg mx-auto">
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('noWorkflowsAssigned')}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine selected workflow
  const selectedId = params.workflow ?? workflows[0].id;
  const selectedWorkflow = workflows.find((w) => w.id === selectedId) ?? workflows[0];

  // Fetch documents if workflow has KB
  const documents = selectedWorkflow.hasKnowledgeBase
    ? await getDocumentsForWorkflow(selectedWorkflow.id)
    : [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Workflow selector — only shown when multiple workflows */}
      {workflows.length > 1 && (
        <WorkflowSelector
          workflows={workflows}
          selectedId={selectedWorkflow.id}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main area — specific view per workflow type */}
        <div className="lg:col-span-2 space-y-6">
          {selectedWorkflow.type === 'chat' ? (
            <HostedChat workflow={selectedWorkflow} />
          ) : (
            <TriggerWorkflow workflow={selectedWorkflow} />
          )}
        </div>

        {/* Right sidebar — KB */}
        <div className="space-y-6">

          {selectedWorkflow.hasKnowledgeBase && (
            <DocumentManager
              workflowId={selectedWorkflow.id}
              initialDocuments={documents}
            />
          )}
        </div>
      </div>
    </div>
  );
}
