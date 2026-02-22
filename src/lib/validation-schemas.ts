import { z } from 'zod';
import { Role, Status } from '@/lib/constants';

// ============================================================
// Workflow schemas
// ============================================================

export const createWorkflowSchema = z.object({
  name: z.string().min(1, 'workflowNameRequired'),
  description: z.string().optional(),
  type: z.enum(['chat', 'trigger'] as const, { error: 'invalidWorkflowType' }),
  webhook_url: z.string().min(1, 'webhookUrlRequired'),
  has_knowledge_base: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
  params_json: z.string().optional(),
});

export const updateWorkflowSchema = createWorkflowSchema;

export const triggerWorkflowSchema = z.object({
  workflowId: z.uuid(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const assignWorkflowSchema = z.object({
  user_id: z.string().min(1, 'userIdRequired'),
  workflow_id: z.string().min(1, 'workflowIdRequired'),
});


export const ingestDocumentSchema = z.object({
  workflow_id: z.string().min(1, 'workflowIdRequired'),
});

export const signinSchema = z.object({
  email: z.email('invalidEmail'),
  password: z.string().min(1, 'passwordTooShort').min(6, 'passwordTooShort'),
});

export const signupSchema = z
  .object({
    first_name: z.string().min(2, 'firstNameTooShort'),
    last_name: z.string().min(2, 'lastNameTooShort'),
    email: z.email('invalidEmail'),
    password: z
      .string()
      .min(8, 'passwordTooShort')
      .regex(/[a-z]/, 'passwordNeedsLowercase')
      .regex(/\d/, 'passwordNeedsNumber')
      .regex(
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/,
        'passwordNeedsSpecialChar'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwordsDontMatch',
    path: ['confirmPassword'],
  });

export const createUserSchema = z.object({
  first_name: z.string().min(1, 'firstNameRequired'),
  last_name: z.string().min(1, 'lastNameRequired'),
  email: z.email('invalidEmail'),
  password: z
    .string()
    .min(8, 'passwordTooShort')
    .regex(/[a-z]/, 'passwordNeedsLowercase')
    .regex(/\d/, 'passwordNeedsNumber')
    .regex(
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/,
      'passwordNeedsSpecialChar'
    ),
  role: z.enum([Role.ADMIN, Role.USER]),
  status: z.enum([Status.ACTIVE, Status.INACTIVE, Status.UNVERIFIED]),
});

export const updateUserSchema = z.object({
  first_name: z.string().min(1, 'firstNameRequired'),
  last_name: z.string().min(1, 'lastNameRequired'),
  email: z.email('invalidEmail'),
  password: z
    .string()
    .optional()
    .refine((val) => {
      if (val && val.length > 0) {
        return val.length >= 8;
      }
      return true;
    }, 'passwordTooShort')
    .refine((val) => {
      if (val && val.length > 0) {
        return /[a-z]/.test(val);
      }
      return true;
    }, 'passwordNeedsLowercase')
    .refine((val) => {
      if (val && val.length > 0) {
        return /\d/.test(val);
      }
      return true;
    }, 'passwordNeedsNumber')
    .refine((val) => {
      if (val && val.length > 0) {
        return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(val);
      }
      return true;
    }, 'passwordNeedsSpecialChar'),
  role: z.enum([Role.ADMIN, Role.USER]),
  status: z.enum([Status.ACTIVE, Status.INACTIVE, Status.UNVERIFIED]),
});

export const forgotPasswordSchema = z.object({
  email: z.email('invalidEmail').min(1, 'emailRequired'),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'passwordTooShort')
      .regex(/[a-z]/, 'passwordNeedsLowercase')
      .regex(/\d/, 'passwordNeedsNumber')
      .regex(
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/,
        'passwordNeedsSpecialChar'
      ),
    confirmPassword: z.string().min(1, 'confirmPasswordRequired'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwordsDoNotMatch',
    path: ['confirmPassword'],
  });

export const createCheckoutSessionSchema = z.object({
  priceId: z.string().min(1, 'priceIdRequired'),
  planType: z.enum(['monthly', 'yearly'] as const, {
    error: 'invalidPlanType',
  }),
});

export function formatZodErrors(error: z.ZodError) {
  const fieldErrors: { [key: string]: string[] } = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(issue.message);
  }

  return fieldErrors;
}
