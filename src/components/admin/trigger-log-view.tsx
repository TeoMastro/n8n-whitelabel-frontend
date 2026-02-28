'use client';

import { useTranslations } from 'next-intl';
import { ArrowLeft, Clock, Fingerprint, Mail, Settings, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { TriggerLogEntry } from '@/types/trigger-log';

interface TriggerLogViewProps {
  log: TriggerLogEntry;
}

export function TriggerLogView({ log }: TriggerLogViewProps) {
  const t = useTranslations('app');
  const router = useRouter();

  // Safely parse potentially double-stringified JSON
  const safeParse = (data: unknown) => {
    if (typeof data !== 'string') return data;
    try {
      const parsed = JSON.parse(data);
      return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    } catch {
      return data;
    }
  };

  const parsedParams = safeParse(log.requestParams);
  const parsedResponse = safeParse(log.responseData);
  
  // Filter out internal properties from requestParams
  let filteredParams = parsedParams;
  if (typeof parsedParams === 'object' && parsedParams !== null && !Array.isArray(parsedParams)) {
    filteredParams = { ...parsedParams };
    delete (filteredParams as any).workflowId;
    delete (filteredParams as any).userId;
  }

  // Pretty format JSON for display (fallback)
  const renderJson = (data: unknown) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  // Dynamic renderer for object fields
  const renderDynamicFields = (data: unknown) => {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return (
        <pre className="p-4 text-sm font-mono text-muted-foreground whitespace-pre-wrap overflow-x-auto h-full">
          {renderJson(data)}
        </pre>
      );
    }
    
    return (
      <div className="p-4 space-y-4">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="space-y-1.5 flex flex-col">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{key}</Label>
            <Textarea
              readOnly
              value={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              className="resize-none min-h-[60px] bg-background/50 font-mono text-sm leading-relaxed"
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/trigger-history')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">{t('triggerHistory')}</h1>
        </div>
      </div>

      {/* Cost Card */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-lg font-medium">{t('totalCost')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-600 dark:text-green-500">
            ${log.totalCost.toFixed(5)}
          </p>
        </CardContent>
      </Card>

      {/* Trigger Information Card */}
      <Card>
        <CardContent className="space-y-6 p-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('workflowName')}
                </label>
                <div className="mt-1">
                  <Badge variant="outline" className="text-base font-normal">
                    {log.workflowName}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                  <Mail className="h-4 w-4" />
                  <span>{t('executor') || 'Executed By'}</span>
                </label>
                <p className="text-lg">{log.userEmail}</p>
              </div>

              {log.executionId && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                    <Fingerprint className="h-4 w-4" />
                    <span>{t('executionId')}</span>
                  </label>
                  <p className="text-lg font-mono">#{log.executionId}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{t('duration')}</span>
                </label>
                <p className="text-lg">{log.durationMs} ms</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('status')}
                </label>
                <div className="mt-1">
                  <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-sm">
                    {t(log.status)}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {t('createdAt')}
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Request / Response JSON payloads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-4 flex flex-col min-h-0">
              <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                <Settings className="h-4 w-4 text-primary" />
                <span>{t('requestData')}</span>
              </label>
              <div className="flex-1 bg-muted/30 border border-border rounded-md overflow-hidden min-h-[150px]">
                {(typeof filteredParams === 'object' && filteredParams !== null ? Object.keys(filteredParams).length > 0 : !!filteredParams) ? (
                  renderDynamicFields(filteredParams)
                ) : (
                  <div className="p-8 h-full flex items-center justify-center text-muted-foreground text-sm italic">
                    {t('noRequestParams') || 'No additional request parameters sent.'}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 flex flex-col min-h-0">
              <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                <Activity className="h-4 w-4 text-emerald-500" />
                <span>{t('responseData')}</span>
              </label>
              <div className="flex-1 bg-muted/30 border border-border rounded-md overflow-hidden min-h-[150px]">
                {log.errorMessage ? (
                  <div className="p-4 h-full text-sm font-mono text-destructive bg-destructive/10">
                    {log.errorMessage}
                  </div>
                ) : parsedResponse ? (
                  renderDynamicFields(parsedResponse)
                ) : (
                  <div className="p-8 h-full flex items-center justify-center text-muted-foreground text-sm italic">
                    {t('noResponseData') || 'No response data received.'}
                  </div>
                )}
              </div>
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
