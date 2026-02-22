'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, ExternalLink } from 'lucide-react';
import { Workflow } from '@/types/workflow';

interface HostedChatProps {
  workflow: Workflow;
}

export function HostedChat({ workflow }: HostedChatProps) {
  const t = useTranslations('app');

  const openChat = () => {
    // Open the webhook URL in a new tab
    if (workflow.webhookUrl) {
      // The webhook url from n8n for chat is usually of the form 
      // <host>/webhook/<id>/chat. The user webhookUrl should already be that endpoint, 
      // or at least opening it will open the chat UI in n8n.
      window.open(workflow.webhookUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {workflow.name}
        </CardTitle>
        <CardDescription>
          {workflow.description || t('workflowTypeChat')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('openHostedChatDescription', { defaultMessage: 'Click the button below to open the hosted AI chat interface.' })}
        </p>
        
        <Button onClick={openChat} className="w-full sm:w-auto" disabled={!workflow.webhookUrl}>
          <ExternalLink className="h-4 w-4 mr-2" />
          {t('openHostedChat', { defaultMessage: 'Open Chat in New Tab' })}
        </Button>
      </CardContent>
    </Card>
  );
}
