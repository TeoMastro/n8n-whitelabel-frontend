'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, User, Bot } from 'lucide-react';
import { ChatSessionDetailProps } from '@/types/chat-log';

export function ChatSessionView({ sessionId, workflowName, messages }: ChatSessionDetailProps) {
  const router = useRouter();
  const t = useTranslations('app');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/chat-history')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToChatHistory')}
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{t('chatSessionDetails')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('workflow')}: <span className="font-medium text-foreground">{workflowName}</span>
          <span className="mx-2">·</span>
          {t('sessionId')}: <span className="font-mono text-foreground">{sessionId}</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('messageCount')}: {messages.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 && (
            <p className="text-muted-foreground text-center py-6">{t('noChatSessionsFound')}</p>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-3">
              {/* Human message */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 bg-muted rounded-lg px-4 py-3">
                  <p className="text-sm whitespace-pre-wrap">{msg.humanMessage}</p>
                  <span className="text-xs text-muted-foreground mt-1 block">
                    {new Date(msg.createdAt).toLocaleString('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {/* AI response */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1 bg-blue-50 dark:bg-blue-950/30 rounded-lg px-4 py-3">
                  <p className="text-sm whitespace-pre-wrap">{msg.aiResponse}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
