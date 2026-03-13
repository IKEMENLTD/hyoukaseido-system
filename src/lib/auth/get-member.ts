// =============================================================================
// 認証ヘルパー: ログインユーザーに紐づくメンバー情報を取得
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import type { Grade } from '@/types/evaluation';

export interface CurrentMember {
  id: string;
  name: string;
  grade: Grade;
  monthly_salary: number;
  org_id: string;
}

/**
 * 現在ログイン中のユーザーに紐づくメンバー情報を取得する。
 * - auth.users -> members テーブルを auth_user_id で結合
 * - 未ログインまたはメンバー未登録の場合は null を返す
 */
export async function getCurrentMember(): Promise<CurrentMember | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: member } = await supabase
    .from('members')
    .select('id, name, grade, monthly_salary, org_id')
    .eq('auth_user_id', user.id)
    .single();

  if (!member) return null;

  return {
    id: member.id as string,
    name: member.name as string,
    grade: member.grade as Grade,
    monthly_salary: member.monthly_salary as number,
    org_id: member.org_id as string,
  };
}
