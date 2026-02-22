'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { Play, Zap } from 'lucide-react';
import { Workflow, WorkflowParam } from '@/types/workflow';

interface TriggerWorkflowProps {
  workflow: Workflow;
}

export function TriggerWorkflow({ workflow }: TriggerWorkflowProps) {
  const t = useTranslations('app');
  const params: WorkflowParam[] = workflow.config.params ?? [];

  const [paramValues, setParamValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(params.map((p) => [p.key, p.default ?? '']))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setParam = (key: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleTrigger = async () => {
    setIsLoading(true);
    setResponse(null);
    setError(null);

    try {
      const res = await fetch('/api/workflows/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId: workflow.id, params: paramValues }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as { data?: unknown };
      setResponse(
        typeof data.data === 'string'
          ? data.data
          : JSON.stringify(data.data, null, 2)
      );
    } catch {
      setError(t('triggerError'));
    } finally {
      setIsLoading(false);
    }
  };

  const renderParamInput = (param: WorkflowParam) => {
    if (param.type === 'select' && param.options?.length) {
      return (
        <Select
          value={paramValues[param.key] ?? ''}
          onValueChange={(v) => setParam(param.key, v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {param.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        value={paramValues[param.key] ?? ''}
        onChange={(e) => setParam(param.key, e.target.value)}
        type={param.type === 'number' ? 'number' : 'text'}
        placeholder={param.default}
      />
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          {workflow.name}
        </CardTitle>
        {workflow.description && (
          <p className="text-sm text-muted-foreground">{workflow.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {params.map((param) => (
          <div key={param.key} className="space-y-1">
            <Label>
              {param.label}
              {param.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {renderParamInput(param)}
          </div>
        ))}

        <Button
          onClick={handleTrigger}
          disabled={isLoading}
          className="w-full"
        >
          <Play className="h-4 w-4 mr-2" />
          {isLoading ? t('triggering') : t('triggerWorkflow')}
        </Button>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {response && (
          <div className="rounded-md border bg-muted p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">{t('triggerResponse')}</p>
            <pre className="text-sm whitespace-pre-wrap break-words">{response}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
