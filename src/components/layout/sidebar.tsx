import { Home, Users, Bot, MessageSquare } from 'lucide-react';
import Link from 'next/link';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

import { NavUser } from '@/components/layout/nav-user';
import { getSession } from '@/lib/auth-session';
import { getTranslations } from 'next-intl/server';
import { PrivacyPolicyDialog } from '@/components/legal/privacy-policy-dialog';
import { TermsDialog } from '@/components/legal/terms-dialog';

export async function AppSidebar() {
  const session = await getSession();
  const t = await getTranslations('app');

  const userData = {
    name: `${session?.user.first_name || ''} ${session?.user.last_name || ''}`.trim() || 'User',
    email: session?.user.email || 'user@example.com',
    avatar: '', // TODO: include the icon if
  };

  const isAdmin = session?.user.role === 'ADMIN';

  const items = [
    {
      title: t('home'),
      url: '/dashboard',
      icon: Home,
    },
    // Only show /workflow for non-admin users
    ...(!isAdmin
      ? [
          {
            title: t('myWorkflows'),
            url: '/workflow',
            icon: Bot,
          },
        ]
      : []),
    // Admin-only: Workflows
    ...(isAdmin
      ? [
          {
            title: t('workflows'),
            url: '/admin/workflow',
            icon: Bot,
          },
        ]
      : []),
    // Chat History — visible to both roles, between Workflows and Users
    {
      title: t('chatHistory'),
      url: '/chat-history',
      icon: MessageSquare,
    },
    // Admin-only: Users (after Chat History)
    ...(isAdmin
      ? [
          {
            title: t('users'),
            url: '/admin/user',
            icon: Users,
          },
        ]
      : []),
  ];

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          {/* App Logo Placeholder */}
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">NL</span>
          </div>
          {/* App Title */}
          <h2 className="text-lg font-semibold text-foreground">
            Next Launch Kit
          </h2>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {/* Legal Documents as Dialogs */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <PrivacyPolicyDialog title={t('privacyPolicy')} />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <TermsDialog title={t('termsOfService')} />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  );
}
