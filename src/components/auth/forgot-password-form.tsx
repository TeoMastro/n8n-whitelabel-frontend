'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { forgotPasswordAction } from '@/server-actions/auth';
import { ForgotPasswordState } from '@/types/auth';
import { InfoAlert } from '../info-alert';
import Link from 'next/link';

export function ForgotPasswordForm() {
  const t = useTranslations('app');

  const initialState: ForgotPasswordState = {
    errors: {},
    success: false,
    formData: { email: '' },
    globalError: null,
  };

  const [state, formAction, isPending] = useActionState(
    forgotPasswordAction,
    initialState
  );

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{t('resetPassword')}</CardTitle>
      </CardHeader>

      <form action={formAction} noValidate>
        <CardContent className="space-y-4 mb-5">
          {state.globalError && (
            <InfoAlert message={t(state.globalError)} type="error" />
          )}

          {state.success && state.message && (
            <InfoAlert message={state.message} type="success" />
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t('enterEmail')}
              disabled={isPending}
              defaultValue={state.formData?.email || ''}
              className={state.errors.email ? 'border-red-500' : ''}
              aria-invalid={!!state.errors.email}
              aria-describedby={state.errors.email ? 'email-error' : undefined}
            />
            {state.errors.email && (
              <p id="email-error" className="text-sm text-red-500" role="alert">
                {t(state.errors.email[0])}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full"
            disabled={isPending || state.success}
          >
            {isPending ? t('sending') : t('sendResetLink')}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t('rememberPassword')}{' '}
            <Link
              href="/auth/signin"
              className="font-medium text-primary hover:underline"
            >
              {t('signIn')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

