'use client';

import { useState, useTransition, useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  assignUserToCompanyAction,
  unassignUserFromCompanyAction,
} from '@/server-actions/company';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, UserPlus, UserMinus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { User } from '@/types/user';
import { Role } from '@/lib/constants';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InfoAlert } from '@/components/info-alert';
import { AssignUserToCompanyFormState } from '@/types/company';

export function CompanyAssignments({
  companyId,
  assignments,
  users = [],
}: {
  companyId: string;
  assignments: {
    userId: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    assignedAt: Date;
    assignedBy: string | null;
  }[];
  users?: User[];
}) {
  const t = useTranslations('app');
  const [isPending, startTransition] = useTransition();
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  const initialAssignState: AssignUserToCompanyFormState = {
    success: false,
    errors: {},
    formData: { user_id: '', company_id: companyId },
    globalError: null,
  };

  const [assignState, assignAction, isAssigning] = useActionState(
    assignUserToCompanyAction,
    initialAssignState
  );

  const handleUnassign = async (userId: string) => {
    startTransition(async () => {
      try {
        await unassignUserFromCompanyAction(userId, companyId);
        setAlert({ message: t('userUnassignedSuccess'), type: 'success' });
      } catch {
        setAlert({ message: t('unexpectedError'), type: 'error' });
      }
    });
  };

  const availableUsers = users.filter(
    (user) =>
      user.role !== Role.ADMIN &&
      !assignments.some((a) => a.userId === user.id)
  );

  return (
    <div className="space-y-4">
      {alert && <InfoAlert message={alert.message} type={alert.type} />}

      {/* Assign form */}
      <form action={assignAction} className="flex gap-2 items-end">
        <input type="hidden" name="company_id" value={companyId} />
        <div className="flex-1 space-y-1">
          <input type="hidden" name="user_id" value={selectedUserId} />
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={cn(
                  'w-full justify-between',
                  assignState.errors.user_id ? 'border-red-500' : ''
                )}
              >
                {selectedUserId
                  ? availableUsers.find((user) => user.id === selectedUserId)?.email
                  : t('searchUsers')}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 align-start">
              <Command>
                <CommandInput placeholder={t('searchUsers')} />
                <CommandList>
                  <CommandEmpty>{t('noUsersFound')}</CommandEmpty>
                  <CommandGroup>
                    {availableUsers.map((user) => (
                      <CommandItem
                        key={user.id}
                        value={`${user.first_name} ${user.last_name} ${user.email} ${user.id}`}
                        onSelect={() => {
                          setSelectedUserId(user.id);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedUserId === user.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {user.first_name} {user.last_name} ({user.email})
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <Button type="submit" disabled={isAssigning}>
          <UserPlus className="h-4 w-4 mr-1" />
          {t('assignUser')}
        </Button>
      </form>

      {assignState.globalError && (
        <InfoAlert message={t(assignState.globalError)} type="error" />
      )}
      {assignState.success && (
        <InfoAlert message={t('userAssignedSuccess')} type="success" />
      )}

      <Separator />

      {/* Assignments table */}
      {assignments.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('noAssignedUsers')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('name')}</TableHead>
              <TableHead>{t('email')}</TableHead>
              <TableHead>{t('assignedAt')}</TableHead>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((a) => (
              <TableRow key={a.userId}>
                <TableCell>
                  {a.firstName} {a.lastName}
                </TableCell>
                <TableCell>{a.email}</TableCell>
                <TableCell>
                  {new Date(a.assignedAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleUnassign(a.userId)}
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
