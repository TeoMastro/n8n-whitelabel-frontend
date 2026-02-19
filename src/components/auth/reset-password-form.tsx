'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { InfoAlert } from '../info-alert';
import { resetPasswordSchema, formatZodErrors } from '@/lib/validation-schemas';

export function ResetPasswordForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const t = useTranslations('app');
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    setGlobalError(null);
    setFieldErrors({});

    const data = {
      password: formData.get('password')?.toString() ?? '',
      confirmPassword: formData.get('confirmPassword')?.toString() ?? '',
    };

    const parsed = resetPasswordSchema.safeParse(data);

    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error));
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });

      if (error) {
        setGlobalError(t('somethingWentWrong'));
        setIsSubmitting(false);
        return;
      }

      router.push(
        '/auth/signin?message=' +
          encodeURIComponent(t('passwordResetSuccess'))
      );
    } catch {
      setGlobalError(t('somethingWentWrong'));
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{t('setNewPassword')}</CardTitle>
      </CardHeader>

      <form action={handleSubmit} noValidate>
        <CardContent className="space-y-4 mb-5">
          {globalError && (
            <InfoAlert message={globalError} type="error" />
          )}

          <div className="space-y-2">
            <Label htmlFor="password">{t('newPassword')}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={t('enterNewPassword')}
              disabled={isSubmitting}
              className={fieldErrors.password ? 'border-red-500' : ''}
            />
            {fieldErrors.password && (
              <p className="text-sm text-red-500">
                {t(fieldErrors.password[0])}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder={t('confirmNewPassword')}
              disabled={isSubmitting}
              className={fieldErrors.confirmPassword ? 'border-red-500' : ''}
            />
            {fieldErrors.confirmPassword && (
              <p className="text-sm text-red-500">
                {t(fieldErrors.confirmPassword[0])}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t('resetting') : t('resetPassword')}
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
