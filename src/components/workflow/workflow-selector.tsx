'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Workflow } from '@/types/workflow';

interface WorkflowSelectorProps {
  workflows: Workflow[];
  selectedId: string;
}

export function WorkflowSelector({ workflows, selectedId }: WorkflowSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('app');

  const handleChange = (id: string) => {
    router.push(`${pathname}?workflow=${id}`);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground">{t('selectWorkflow')}</span>
      <Select value={selectedId} onValueChange={handleChange}>
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder={t('selectWorkflow')} />
        </SelectTrigger>
        <SelectContent>
          {workflows.map((wf) => (
            <SelectItem key={wf.id} value={wf.id}>
              {wf.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
