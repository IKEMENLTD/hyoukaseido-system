'use server';

// =============================================================================
// OKR Server Actions
// Objective/KeyResultの編集・削除をサーバーサイドで処理
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getCurrentMember } from '@/lib/auth/get-member';
import { notifyBonusConfirmed } from '@/lib/notifications/events';

interface ActionResult {
  success: boolean;
  error?: string;
}

// -----------------------------------------------------------------------------
// Objective タイトル編集
// -----------------------------------------------------------------------------

export async function updateObjectiveTitle(
  objectiveId: string,
  title: string
): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return { success: false, error: '認証が必要です' };

  if (!title.trim() || title.length > 500) {
    return { success: false, error: 'タイトルは1〜500文字で入力してください' };
  }

  const supabase = await createClient();

  // 所有者チェック: 自分のObjective or G3+
  const { data: objective, error: objectiveErr } = await supabase
    .from('okr_objectives')
    .select('member_id')
    .eq('id', objectiveId)
    .single();
  if (objectiveErr) console.error('[DB] okr_objectives 取得エラー:', objectiveErr);

  if (!objective) return { success: false, error: 'OKRが見つかりません' };

  const obj = objective as { member_id: string | null };
  if (obj.member_id !== member.id) {
    // G4/G5は全OKR編集可能、G3は同一事業部のみ
    if (!['G3', 'G4', 'G5'].includes(member.grade)) {
      return { success: false, error: '自分のOKRのみ編集可能です' };
    }
    if (member.grade === 'G3' && obj.member_id) {
      // G3は対象メンバーが同一事業部に所属しているか確認
      const { data: targetDivs } = await supabase
        .from('division_members')
        .select('division_id')
        .eq('member_id', obj.member_id);
      const targetDivIds = (targetDivs ?? []).map(
        (d) => (d as { division_id: string }).division_id
      );
      const hasSharedDiv = targetDivIds.some(
        (id) => member.division_ids.includes(id)
      );
      if (!hasSharedDiv) {
        return { success: false, error: '所属事業部外のOKRは編集できません' };
      }
    }
  }

  const { error } = await supabase
    .from('okr_objectives')
    .update({ title: title.trim() })
    .eq('id', objectiveId);

  if (error) {
    console.error('objective update error:', error.message);
    return { success: false, error: '更新に失敗しました' };
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// Objective 削除
// -----------------------------------------------------------------------------

export async function deleteObjective(
  objectiveId: string
): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return { success: false, error: '認証が必要です' };

  if (!['G4', 'G5'].includes(member.grade)) {
    return { success: false, error: 'OKRの削除はG4以上のみ実行可能です' };
  }

  const supabase = await createClient();

  // 先にKRの子要素(checkins)を削除、次にKR、最後にObjective
  const { data: keyResults, error: keyResultsErr } = await supabase
    .from('okr_key_results')
    .select('id')
    .eq('objective_id', objectiveId);
  if (keyResultsErr) console.error('[DB] okr_key_results 取得エラー:', keyResultsErr);

  if (keyResults && keyResults.length > 0) {
    const krIds = (keyResults as Array<{ id: string }>).map((kr) => kr.id);
    await supabase.from('okr_checkins').delete().in('key_result_id', krIds);
    await supabase.from('okr_key_results').delete().eq('objective_id', objectiveId);
  }

  const { error } = await supabase
    .from('okr_objectives')
    .delete()
    .eq('id', objectiveId);

  if (error) {
    console.error('objective delete error:', error.message);
    return { success: false, error: '削除に失敗しました' };
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// Key Result 編集
// -----------------------------------------------------------------------------

export async function updateKeyResult(
  keyResultId: string,
  data: { title?: string; targetValue?: number; unit?: string }
): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return { success: false, error: '認証が必要です' };

  // バリデーション
  if (data.title !== undefined) {
    if (!data.title.trim() || data.title.length > 500) {
      return { success: false, error: 'タイトルは1〜500文字で入力してください' };
    }
  }
  if (data.targetValue !== undefined) {
    if (!Number.isFinite(data.targetValue) || data.targetValue < 0) {
      return { success: false, error: '目標値は0以上の数値で入力してください' };
    }
  }
  if (data.unit !== undefined) {
    if (!data.unit.trim() || data.unit.length > 50) {
      return { success: false, error: '単位は1〜50文字で入力してください' };
    }
  }

  const supabase = await createClient();

  // KRからobjective_idを取得
  const { data: kr, error: krErr } = await supabase
    .from('okr_key_results')
    .select('objective_id')
    .eq('id', keyResultId)
    .single();
  if (krErr) console.error('[DB] okr_key_results 取得エラー:', krErr);

  if (!kr) return { success: false, error: 'Key Resultが見つかりません' };

  const typedKr = kr as { objective_id: string };

  // 所有者チェック: ObjectiveのownerまたはG3+
  const { data: objective, error: objErr } = await supabase
    .from('okr_objectives')
    .select('member_id')
    .eq('id', typedKr.objective_id)
    .single();
  if (objErr) console.error('[DB] okr_objectives 取得エラー:', objErr);

  if (!objective) return { success: false, error: 'OKRが見つかりません' };

  const obj = objective as { member_id: string | null };
  if (obj.member_id !== member.id && !['G3', 'G4', 'G5'].includes(member.grade)) {
    return { success: false, error: '自分のOKRのみ編集可能です' };
  }

  // 更新データ構築
  const updateData: Record<string, string | number> = {};
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.targetValue !== undefined) updateData.target_value = data.targetValue;
  if (data.unit !== undefined) updateData.unit = data.unit.trim();

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: '更新するデータがありません' };
  }

  const { error } = await supabase
    .from('okr_key_results')
    .update(updateData)
    .eq('id', keyResultId);

  if (error) {
    console.error('key_result update error:', error.message);
    return { success: false, error: '更新に失敗しました' };
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// 1on1記録 編集
// -----------------------------------------------------------------------------

export async function updateOneOnOne(
  recordId: string,
  data: {
    okr_progress?: string | null;
    blockers?: string | null;
    action_items?: string | null;
    notes?: string | null;
  }
): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return { success: false, error: '認証が必要です' };

  if (!['G3', 'G4', 'G5'].includes(member.grade)) {
    return { success: false, error: '1on1記録の編集はG3以上のみ実行可能です' };
  }

  // 文字数制限
  for (const [, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.length > 5000) {
      return { success: false, error: '各フィールドは5000文字以内で入力してください' };
    }
  }

  const supabase = await createClient();

  // 所有者チェック
  const { data: record, error: recordErr } = await supabase
    .from('one_on_ones')
    .select('manager_id')
    .eq('id', recordId)
    .single();
  if (recordErr) console.error('[DB] one_on_ones 取得エラー:', recordErr);

  if (!record) return { success: false, error: '記録が見つかりません' };

  const rec = record as { manager_id: string };
  if (rec.manager_id !== member.id && !['G4', 'G5'].includes(member.grade)) {
    return { success: false, error: '自分が記録した1on1のみ編集可能です' };
  }

  const { error } = await supabase
    .from('one_on_ones')
    .update(data)
    .eq('id', recordId);

  if (error) {
    console.error('one_on_one update error:', error.message);
    return { success: false, error: '更新に失敗しました' };
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// 1on1記録 削除
// -----------------------------------------------------------------------------

export async function deleteOneOnOne(
  recordId: string
): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return { success: false, error: '認証が必要です' };

  if (!['G4', 'G5'].includes(member.grade)) {
    return { success: false, error: '1on1記録の削除はG4以上のみ実行可能です' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('one_on_ones')
    .delete()
    .eq('id', recordId);

  if (error) {
    console.error('one_on_one delete error:', error.message);
    return { success: false, error: '削除に失敗しました' };
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// 改善計画マイルストーン完了トグル
// -----------------------------------------------------------------------------

export async function toggleMilestoneComplete(
  planId: string,
  milestoneIndex: number
): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return { success: false, error: '認証が必要です' };

  if (!['G3', 'G4', 'G5'].includes(member.grade)) {
    return { success: false, error: '改善計画の管理はG3以上のみ実行可能です' };
  }

  const supabase = await createClient();

  const { data: plan, error: planErr } = await supabase
    .from('improvement_plans')
    .select('milestones, manager_id')
    .eq('id', planId)
    .single();
  if (planErr) console.error('[DB] improvement_plans 取得エラー:', planErr);

  if (!plan) return { success: false, error: '改善計画が見つかりません' };

  const planData = plan as { milestones: Array<{ title: string; due_date: string; completed: boolean }> | null; manager_id: string };

  if (planData.manager_id !== member.id && !['G4', 'G5'].includes(member.grade)) {
    return { success: false, error: '自分が担当する改善計画のみ操作可能です' };
  }

  const milestones = planData.milestones;
  if (!milestones || milestoneIndex < 0 || milestoneIndex >= milestones.length) {
    return { success: false, error: 'マイルストーンが見つかりません' };
  }

  milestones[milestoneIndex].completed = !milestones[milestoneIndex].completed;

  const { error } = await supabase
    .from('improvement_plans')
    .update({ milestones })
    .eq('id', planId);

  if (error) {
    console.error('milestone toggle error:', error.message);
    return { success: false, error: '更新に失敗しました' };
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// 改善計画ステータス変更 (active→completed/cancelled)
// -----------------------------------------------------------------------------

export async function updateImprovementPlanStatus(
  planId: string,
  newStatus: 'completed' | 'cancelled',
  outcome?: string | null
): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return { success: false, error: '認証が必要です' };

  if (!['G3', 'G4', 'G5'].includes(member.grade)) {
    return { success: false, error: '改善計画の管理はG3以上のみ実行可能です' };
  }

  if (outcome && outcome.length > 5000) {
    return { success: false, error: '結果は5000文字以内で入力してください' };
  }

  const supabase = await createClient();

  const updateData: Record<string, unknown> = { status: newStatus };
  if (outcome !== undefined) {
    updateData.outcome = outcome || null;
  }

  const { error } = await supabase
    .from('improvement_plans')
    .update(updateData)
    .eq('id', planId)
    .eq('status', 'active'); // activeからのみ遷移可

  if (error) {
    console.error('improvement plan status error:', error.message);
    return { success: false, error: '更新に失敗しました' };
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// 四半期ボーナス paid遷移
// -----------------------------------------------------------------------------

export async function markBonusAsPaid(
  bonusId: string
): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return { success: false, error: '認証が必要です' };

  if (!['G4', 'G5'].includes(member.grade)) {
    return { success: false, error: 'ボーナスの支払確定はG4以上のみ実行可能です' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('quarterly_bonuses')
    .update({ status: 'paid' })
    .eq('id', bonusId)
    .eq('status', 'approved') // 楽観ロック
    .select('id')
    .single();

  if (error || !data) {
    console.error('bonus paid error:', error?.message);
    return { success: false, error: '支払確定に失敗しました。未承認の可能性があります。' };
  }

  // 通知: ボーナス支払確定 (fire-and-forget)
  // service roleクライアントを使用してnotification_channelsのRLSをバイパス
  try {
    const bonusServiceClient = createServiceRoleClient();
    const { data: bonusRow } = await bonusServiceClient
      .from('quarterly_bonuses')
      .select('okr_period_id')
      .eq('id', bonusId)
      .single();

    if (bonusRow) {
      const { okr_period_id } = bonusRow as { okr_period_id: string };
      const { data: periodRow } = await bonusServiceClient
        .from('okr_periods')
        .select('name')
        .eq('id', okr_period_id)
        .single();

      const periodName = (periodRow as { name: string } | null)?.name ?? '';
      notifyBonusConfirmed(member.org_id, periodName, bonusServiceClient).catch((err: unknown) => {
        console.warn('通知送信失敗:', err instanceof Error ? err.message : err);
      });
    }
  } catch {
    // 通知取得失敗はメイン処理をブロックしない
  }

  return { success: true };
}
