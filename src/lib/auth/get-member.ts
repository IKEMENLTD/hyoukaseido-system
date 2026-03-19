// =============================================================================
// 認証ヘルパー: ログインユーザーに紐づくメンバー情報を取得
// callbackで紐付け失敗した場合も auto_link_member RPC で自己修復する
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import type { Grade } from '@/types/evaluation';

export interface CurrentMember {
  id: string;
  name: string;
  grade: Grade;
  monthly_salary: number;
  org_id: string;
  division_ids: string[];
}

/** 認証済みだがメンバー未紐付けの状態を表す */
export interface UnlinkedUser {
  email: string;
}

export type GetMemberResult =
  | { status: 'ok'; member: CurrentMember }
  | { status: 'unlinked'; user: UnlinkedUser }
  | { status: 'unauthenticated' };

/**
 * 現在ログイン中のユーザーに紐づくメンバー情報を取得する。
 * - auth.users -> members テーブルを auth_user_id で結合
 * - 紐付けされていない場合は auto_link_member RPC で自動リンクを試行
 * - 状態を明示的に返すことで、呼び出し側が適切なUIを出し分けられる
 */
export async function getMemberResult(): Promise<GetMemberResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { status: 'unauthenticated' };

  let { data: member } = await supabase
    .from('members')
    .select('id, name, grade, monthly_salary, org_id')
    .eq('auth_user_id', user.id)
    .single();

  // 紐付けされていない場合、メールアドレスで自動リンクを試行
  if (!member && user.email) {
    const { data: linkedId, error: linkedIdErr } = await supabase
      .rpc('auto_link_member', {
        p_auth_uid: user.id,
        p_email: user.email,
      });
    if (linkedIdErr) console.error('[DB] auto_link_member 取得エラー:', linkedIdErr);

    if (linkedId) {
      const { data: linked, error: linkedErr } = await supabase
        .from('members')
        .select('id, name, grade, monthly_salary, org_id')
        .eq('auth_user_id', user.id)
        .single();
      if (linkedErr) console.error('[DB] members 取得エラー:', linkedErr);
      member = linked;
    }
  }

  if (!member) {
    return { status: 'unlinked', user: { email: user.email ?? '不明' } };
  }

  // 所属事業部IDリストを取得
  const { data: divMemberships, error: divMembershipsErr } = await supabase
    .from('division_members')
    .select('division_id')
    .eq('member_id', member.id as string);
  if (divMembershipsErr) console.error('[DB] division_members 取得エラー:', divMembershipsErr);

  return {
    status: 'ok',
    member: {
      id: member.id as string,
      name: member.name as string,
      grade: member.grade as Grade,
      monthly_salary: member.monthly_salary as number,
      org_id: member.org_id as string,
      division_ids: divMemberships
        ? (divMemberships as Array<{ division_id: string }>).map((d) => d.division_id)
        : [],
    },
  };
}

/**
 * 後方互換: 既存の呼び出し箇所で使用
 * 紐付け失敗時は null を返す（従来と同じ振る舞い + 自動リンク試行付き）
 */
export async function getCurrentMember(): Promise<CurrentMember | null> {
  const result = await getMemberResult();
  return result.status === 'ok' ? result.member : null;
}
