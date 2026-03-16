// =============================================================================
// 管理画面レイアウト (Server Component)
// G4/G5 のみアクセス可能。全管理サブページに権限ガードを一括適用する。
// =============================================================================

import { getCurrentMember } from '@/lib/auth/get-member';
import { redirect } from 'next/navigation';
import { AdminBreadcrumb } from './AdminBreadcrumb';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const member = await getCurrentMember();

  if (!member || !['G4', 'G5'].includes(member.grade)) {
    redirect('/dashboard');
  }

  return (
    <>
      <AdminBreadcrumb />
      {children}
    </>
  );
}
