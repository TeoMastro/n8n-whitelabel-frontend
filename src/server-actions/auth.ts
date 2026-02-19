'use server';

import { redirect } from 'next/navigation';
import { getServerTranslation } from '@/lib/server-translations';
import {
  ForgotPasswordState,
  ResetPasswordState,
  ValidationState,
} from '@/types/auth';
import { SignupFormState } from '@/types/auth';
import {
  signinSchema,
  formatZodErrors,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/lib/validation-schemas';
import logger from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

export async function validateSigninData(
  prevState: ValidationState,
  formData: FormData
): Promise<ValidationState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const validatedFields = signinSchema.safeParse({
    email,
    password,
  });

  if (!validatedFields.success) {
    return {
      errors: formatZodErrors(validatedFields.error),
      data: null,
      success: false,
      formData: { email, password: '' },
    };
  }

  return {
    errors: {},
    data: validatedFields.data,
    success: true,
    formData: { email, password: '' },
  };
}

export async function signUpAction(
  prevState: SignupFormState,
  formData: FormData
): Promise<SignupFormState> {
  const data = {
    first_name: formData.get('first_name')?.toString() ?? '',
    last_name: formData.get('last_name')?.toString() ?? '',
    email: formData.get('email')?.toString() ?? '',
    password: formData.get('password')?.toString() ?? '',
    confirmPassword: formData.get('confirmPassword')?.toString() ?? '',
  };

  const parsed = signupSchema.safeParse(data);

  if (!parsed.success) {
    return {
      success: false,
      errors: formatZodErrors(parsed.error),
      formData: { ...data, password: '', confirmPassword: '' },
      globalError: null,
    };
  }

  const trimmedEmail = parsed.data.email.trim().toLowerCase();
  const firstName = parsed.data.first_name.trim();
  const lastName = parsed.data.last_name.trim();

  try {
    const supabase = await createClient();

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password: parsed.data.password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/signin`,
      },
    });

    if (error) {
      if (
        error.message.includes('already registered') ||
        error.message.includes('already exists')
      ) {
        return {
          success: false,
          errors: {},
          formData: { ...parsed.data, password: '', confirmPassword: '' },
          globalError: 'userAlreadyExists',
        };
      }

      logger.error('Error during user signup', {
        error: error.message,
        action: 'signUp',
      });

      return {
        success: false,
        errors: {},
        formData: { ...parsed.data, password: '', confirmPassword: '' },
        globalError: 'accountCreationFailed',
      };
    }

    if (!signUpData.user) {
      return {
        success: false,
        errors: {},
        formData: { ...parsed.data, password: '', confirmPassword: '' },
        globalError: 'userAlreadyExists',
      };
    }

    logger.info('User signed up successfully', {
      userId: signUpData.user.id,
    });
  } catch (error) {
    logger.error('Error during user signup', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      action: 'signUp',
    });

    return {
      success: false,
      errors: {},
      formData: { ...parsed.data, password: '', confirmPassword: '' },
      globalError: 'accountCreationFailed',
    };
  }

  const successMessage = await getServerTranslation(
    'app',
    'accountCreatedCheckEmail'
  );
  redirect('/auth/signin?message=' + encodeURIComponent(successMessage));
}

export async function forgotPasswordAction(
  prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = formData.get('email')?.toString() ?? '';

  const parsed = forgotPasswordSchema.safeParse({ email });

  if (!parsed.success) {
    return {
      success: false,
      errors: formatZodErrors(parsed.error),
      formData: { email },
      globalError: null,
    };
  }

  const trimmedEmail = parsed.data.email.trim().toLowerCase();

  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/reset-password`,
    });

    if (error) {
      logger.error('Error during forgot password', {
        error: error.message,
        action: 'forgotPassword',
      });
    }

    // Always return success (don't reveal if email exists)
    return {
      success: true,
      errors: {},
      formData: { email: '' },
      globalError: null,
      message: await getServerTranslation('app', 'resetEmailSent'),
    };
  } catch (error) {
    logger.error('Error during forgot password', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      action: 'forgotPassword',
    });

    return {
      success: false,
      errors: {},
      formData: { email },
      globalError: 'somethingWentWrong',
    };
  }
}

export async function resetPasswordAction(
  prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const data = {
    password: formData.get('password')?.toString() ?? '',
    confirmPassword: formData.get('confirmPassword')?.toString() ?? '',
  };

  const parsed = resetPasswordSchema.safeParse(data);

  if (!parsed.success) {
    return {
      success: false,
      errors: formatZodErrors(parsed.error),
      formData: { password: '', confirmPassword: '' },
      globalError: null,
    };
  }

  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      logger.error('Error during password reset', {
        error: error.message,
        action: 'resetPassword',
      });

      return {
        success: false,
        errors: {},
        formData: { password: '', confirmPassword: '' },
        globalError: 'somethingWentWrong',
      };
    }

    logger.info('Password reset successfully');
  } catch (error) {
    logger.error('Error during password reset', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      action: 'resetPassword',
    });

    return {
      success: false,
      errors: {},
      formData: { password: '', confirmPassword: '' },
      globalError: 'somethingWentWrong',
    };
  }

  const successMessage = await getServerTranslation(
    'app',
    'passwordResetSuccess'
  );

  redirect('/auth/signin?message=' + encodeURIComponent(successMessage));
}
