'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { createCompanyAction, updateCompanyAction } from '@/server-actions/company';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoAlert } from '@/components/info-alert';
import { CompanyFormProps, CompanyFormState } from '@/types/company';

export function CompanyForm({ company, mode }: CompanyFormProps) {
  const t = useTranslations('app');

  const initialState: CompanyFormState = {
    success: false,
    errors: {},
    formData: {
      name: company?.name ?? '',
      note: company?.note ?? '',
    },
    globalError: null,
  };

  const actionWrapper = async (
    prevState: CompanyFormState,
    formData: FormData
  ): Promise<CompanyFormState> => {
    if (mode === 'create') {
      return createCompanyAction(prevState, formData);
    }
    return updateCompanyAction(company!.id, prevState, formData);
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
          {mode === 'create' ? t('createCompany') : t('updateCompany')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate className="space-y-4">
          {state.globalError && (
            <InfoAlert message={t(state.globalError)} type="error" />
          )}

          <div className="space-y-2">
            <Label htmlFor="name">{t('companyName')}</Label>
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
            <Label htmlFor="note">{t('companyNote')}</Label>
            <Textarea
              id="note"
              name="note"
              defaultValue={state.formData.note}
              rows={3}
            />
          </div>

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
