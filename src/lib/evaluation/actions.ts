'use server';

// =============================================================================
// 評価 Server Actions
// クライアントからの評価データ操作を全てサーバーサイドで処理し、
// 権限チェック・バリデーション・スコア計算を一元管理する。
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { EVAL_PERIOD_STATUS_ORDER } from './constants';
import { getCurrentMember } from '@/lib/auth/get-member';
import {
  calculateKPIScore,
  determineKPIRank,
  calculateTotalScore,
  determineRank,
  recommendSalaryChange,
} from '@/lib/evaluation/calculator';
import type { KPIThresholds, Phase, Rank, BehaviorScore } from '@/types/evaluation';
import {
  notifyEvalSubmitted,
  notifyManagerEvalRequest,
  notifyEvalPeriodStart,
  notifyCalibrationStart,
  notifyCalibrationComplete,
} from '@/lib/notifications/events';

// -----------------------------------------------------------------------------
// 共通ヘルパー
// -----------------------------------------------------------------------------

interface ActionResult {
  success: boolean;
  error?: string;
}

/** 評価レコードの所有者・権限を検証し、評価データを返す */
async function verifyEvaluationAccess(
  evaluationId: string,
  mode: 'self' | 'manager' | 'calibration'
): Promise<{
  ok: boolean;
  error?: string;
  evaluation?: {
    id: string;
    member_id: string;
    evaluator_id: string | null;
    division_id: string;
    status: string;
    phase_at_eval: Phase;
    quantitative_weight: number;
    qualitative_weight: number;
    value_weight: number;
    quantitative_score: number | null;
    qualitative_score: number | null;
    value_score: number | null;
  };
}> {
  const member = await getCurrentMember();
  if (!member) return { ok: false, error: '認証が必要です' };

  const supabase = await createClient();
  const { data: evaluation, error } = await supabase
    .from('evaluations')
    .select(
      'id, member_id, evaluator_id, division_id, status, phase_at_eval, quantitative_weight, qualitative_weight, value_weight, quantitative_score, qualitative_score, value_score'
    )
    .eq('id', evaluationId)
    .single();

  if (error || !evaluation) {
    return { ok: false, error: '評価データが見つかりません' };
  }

  const eval_ = evaluation as {
    id: string;
    member_id: string;
    evaluator_id: string | null;
    division_id: string;
    status: string;
    phase_at_eval: Phase;
    quantitative_weight: number;
    qualitative_weight: number;
    value_weight: number;
    quantitative_score: number | null;
    qualitative_score: number | null;
    value_score: number | null;
  };

  if (mode === 'self') {
    // 自己評価: 本人のみ
    if (eval_.member_id !== member.id) {
      return { ok: false, error: '自分の評価のみ編集可能です' };
    }
    // ステータスチェック: draft のみ編集可
    if (eval_.status !== 'draft') {
      return { ok: false, error: '提出済みの評価は編集できません' };
    }
  } else if (mode === 'manager') {
    // 上長評価: G3+で、自分自身の評価は不可
    if (eval_.member_id === member.id) {
      return { ok: false, error: '自分自身の上長評価はできません' };
    }
    if (!['G3', 'G4', 'G5'].includes(member.grade)) {
      return { ok: false, error: '上長評価はG3以上のみ実行可能です' };
    }
    // G3は自事業部のみ操作可能（G4/G5は全事業部OK）
    if (member.grade === 'G3' && !member.division_ids.includes(eval_.division_id)) {
      return { ok: false, error: '所属事業部外の評価は操作できません' };
    }
    // ステータスチェック: self_submitted のみ
    if (eval_.status !== 'self_submitted') {
      return { ok: false, error: 'この評価は上長評価段階ではありません' };
    }
  } else if (mode === 'calibration') {
    // キャリブレーション: G4/G5のみ
    if (!['G4', 'G5'].includes(member.grade)) {
      return { ok: false, error: 'キャリブレーションはG4以上のみ実行可能です' };
    }
    if (eval_.status !== 'manager_submitted') {
      return { ok: false, error: 'この評価はキャリブレーション段階ではありません' };
    }
  }

  return { ok: true, evaluation: eval_ };
}

// -----------------------------------------------------------------------------
// 定量評価 (KPI) 保存
// -----------------------------------------------------------------------------

interface KpiScoreInput {
  kpi_item_id: string;
  target_value: number | null;
  actual_value: number | null;
  note: string | null;
}

export async function saveSelfQuantitativeScores(
  evaluationId: string,
  scores: KpiScoreInput[]
): Promise<ActionResult> {
  const access = await verifyEvaluationAccess(evaluationId, 'self');
  if (!access.ok) return { success: false, error: access.error };

  // バリデーション
  for (const score of scores) {
    if (score.target_value !== null && (isNaN(score.target_value) || !isFinite(score.target_value))) {
      return { success: false, error: '目標値に不正な値が含まれています' };
    }
    if (score.actual_value !== null && (isNaN(score.actual_value) || !isFinite(score.actual_value))) {
      return { success: false, error: '実績値に不正な値が含まれています' };
    }
    if (score.note !== null && score.note.length > 1000) {
      return { success: false, error: '備考は1000文字以内で入力してください' };
    }
  }

  const supabase = await createClient();

  // KPIスコアのupsert
  const upsertData = scores.map((s) => ({
    evaluation_id: evaluationId,
    kpi_item_id: s.kpi_item_id,
    target_value: s.target_value,
    actual_value: s.actual_value,
    note: s.note,
  }));

  const { error } = await supabase
    .from('eval_kpi_scores')
    .upsert(upsertData, { onConflict: 'evaluation_id,kpi_item_id' });

  if (error) {
    console.error('eval_kpi_scores upsert error:', error.message);
    return { success: false, error: '保存に失敗しました' };
  }

  // ランク計算・書き戻しをサーバーで実行
  await recalculateQuantitativeScore(evaluationId);

  return { success: true };
}

// -----------------------------------------------------------------------------
// 定性評価 (行動) 保存
// -----------------------------------------------------------------------------

interface BehaviorScoreInput {
  behavior_item_id: string;
  self_score: BehaviorScore | null;
  comment: string | null;
}

export async function saveSelfQualitativeScores(
  evaluationId: string,
  scores: BehaviorScoreInput[]
): Promise<ActionResult> {
  const access = await verifyEvaluationAccess(evaluationId, 'self');
  if (!access.ok) return { success: false, error: access.error };

  // バリデーション
  for (const score of scores) {
    if (score.self_score !== null && ![1, 2, 3, 4].includes(score.self_score)) {
      return { success: false, error: '行動評価スコアは1-4の範囲で入力してください' };
    }
    if (score.comment !== null && score.comment.length > 2000) {
      return { success: false, error: 'コメントは2000文字以内で入力してください' };
    }
  }

  const supabase = await createClient();

  const upsertData = scores.map((s) => ({
    evaluation_id: evaluationId,
    behavior_item_id: s.behavior_item_id,
    self_score: s.self_score,
    comment: s.comment,
  }));

  const { error } = await supabase
    .from('eval_behavior_scores')
    .upsert(upsertData, { onConflict: 'evaluation_id,behavior_item_id' });

  if (error) {
    console.error('eval_behavior_scores upsert error:', error.message);
    return { success: false, error: '保存に失敗しました' };
  }

  // 定性スコア再計算
  await recalculateQualitativeScore(evaluationId, 'self');

  return { success: true };
}

// -----------------------------------------------------------------------------
// バリュー評価 保存
// -----------------------------------------------------------------------------

interface ValueScoreInput {
  value_item_id: string;
  self_score: number | null;
  evidence: string | null;
}

export async function saveSelfValueScores(
  evaluationId: string,
  scores: ValueScoreInput[]
): Promise<ActionResult> {
  const access = await verifyEvaluationAccess(evaluationId, 'self');
  if (!access.ok) return { success: false, error: access.error };

  // バリデーション
  for (const score of scores) {
    if (score.self_score !== null && (score.self_score < 1 || score.self_score > 10 || !Number.isInteger(score.self_score))) {
      return { success: false, error: 'バリュースコアに不正な値が含まれています' };
    }
    if (score.evidence !== null && score.evidence.length > 2000) {
      return { success: false, error: 'エビデンスは2000文字以内で入力してください' };
    }
  }

  const supabase = await createClient();

  const upsertData = scores.map((s) => ({
    evaluation_id: evaluationId,
    value_item_id: s.value_item_id,
    self_score: s.self_score,
    evidence: s.evidence,
  }));

  const { error } = await supabase
    .from('eval_value_scores')
    .upsert(upsertData, { onConflict: 'evaluation_id,value_item_id' });

  if (error) {
    console.error('eval_value_scores upsert error:', error.message);
    return { success: false, error: '保存に失敗しました' };
  }

  // バリュースコア再計算
  await recalculateValueScore(evaluationId, 'self');

  return { success: true };
}

// -----------------------------------------------------------------------------
// 自己評価 提出
// -----------------------------------------------------------------------------

export async function submitSelfEvaluation(
  evaluationId: string,
  selfComment: string | null
): Promise<ActionResult> {
  const access = await verifyEvaluationAccess(evaluationId, 'self');
  if (!access.ok) return { success: false, error: access.error };

  if (selfComment !== null && selfComment.length > 5000) {
    return { success: false, error: 'コメントは5000文字以内で入力してください' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('evaluations')
    .update({
      self_comment: selfComment || null,
      status: 'self_submitted',
    })
    .eq('id', evaluationId)
    .eq('status', 'draft') // 楽観ロック: draft のみ更新
    .select('id')
    .single();

  if (error || !data) {
    console.error('self evaluation submit error:', error?.message);
    return { success: false, error: '提出に失敗しました。既に提出済みの可能性があります。' };
  }

  // 総合スコア計算はステータス遷移成功後に実行
  await recalculateTotalScoreAndRank(evaluationId);

  // 通知: 自己評価提出 → 上長に通知 (fire-and-forget)
  // service roleクライアントを使用してnotification_channelsのRLSをバイパス
  const member = await getCurrentMember();
  if (member) {
    const serviceClient = createServiceRoleClient();
    const { data: evalPeriod, error: evalPeriodErr } = await serviceClient
      .from('evaluations')
      .select('eval_period_id')
      .eq('id', evaluationId)
      .single();
    if (evalPeriodErr) console.error('[DB] evaluations 取得エラー:', evalPeriodErr);
    if (evalPeriod) {
      const { data: period, error: periodErr } = await serviceClient
        .from('eval_periods')
        .select('name')
        .eq('id', (evalPeriod as { eval_period_id: string }).eval_period_id)
        .single();
      if (periodErr) console.error('[DB] eval_periods 取得エラー:', periodErr);
      const periodName = (period as { name: string } | null)?.name ?? '';
      notifyEvalSubmitted(member.org_id, member.name, periodName, serviceClient).catch((err: unknown) => {
        console.warn('通知送信失敗:', err instanceof Error ? err.message : err);
      });
    }
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// 自己評価 下書き保存 (コメントのみ)
// -----------------------------------------------------------------------------

export async function saveSelfDraft(
  evaluationId: string,
  selfComment: string | null
): Promise<ActionResult> {
  const access = await verifyEvaluationAccess(evaluationId, 'self');
  if (!access.ok) return { success: false, error: access.error };

  if (selfComment !== null && selfComment.length > 5000) {
    return { success: false, error: 'コメントは5000文字以内で入力してください' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('evaluations')
    .update({ self_comment: selfComment || null })
    .eq('id', evaluationId)
    .eq('member_id', access.evaluation!.member_id); // 二重チェック

  if (error) {
    console.error('self draft save error:', error.message);
    return { success: false, error: '保存に失敗しました' };
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// 上長評価 - 定性評価 保存
// -----------------------------------------------------------------------------

interface ManagerBehaviorScoreInput {
  behavior_item_id: string;
  manager_score: BehaviorScore | null;
  is_upper_grade_behavior: boolean;
  manager_comment?: string | null;
}

export async function saveManagerQualitativeScores(
  evaluationId: string,
  scores: ManagerBehaviorScoreInput[]
): Promise<ActionResult> {
  const access = await verifyEvaluationAccess(evaluationId, 'manager');
  if (!access.ok) return { success: false, error: access.error };

  for (const score of scores) {
    if (score.manager_score !== null && ![1, 2, 3, 4].includes(score.manager_score)) {
      return { success: false, error: '行動評価スコアは1-4の範囲で入力してください' };
    }
  }

  const supabase = await createClient();

  for (const score of scores) {
    const { error } = await supabase
      .from('eval_behavior_scores')
      .upsert(
        {
          evaluation_id: evaluationId,
          behavior_item_id: score.behavior_item_id,
          manager_score: score.manager_score,
          is_upper_grade_behavior: score.is_upper_grade_behavior,
        },
        { onConflict: 'evaluation_id,behavior_item_id' }
      );

    if (error) {
      console.error('manager behavior score upsert error:', error.message);
      return { success: false, error: '保存に失敗しました' };
    }

    // 上長コメント: 値がある場合のみ更新（空文字/nullの場合は既存の自己評価コメントを保護）
    if (score.manager_comment) {
      await supabase
        .from('eval_behavior_scores')
        .update({ comment: score.manager_comment })
        .eq('evaluation_id', evaluationId)
        .eq('behavior_item_id', score.behavior_item_id);
    }
  }

  await recalculateQualitativeScore(evaluationId, 'manager');

  return { success: true };
}

// -----------------------------------------------------------------------------
// 上長評価 - バリュー評価 保存
// -----------------------------------------------------------------------------

interface ManagerValueScoreInput {
  value_item_id: string;
  manager_score: number | null;
}

export async function saveManagerValueScores(
  evaluationId: string,
  scores: ManagerValueScoreInput[]
): Promise<ActionResult> {
  const access = await verifyEvaluationAccess(evaluationId, 'manager');
  if (!access.ok) return { success: false, error: access.error };

  for (const score of scores) {
    if (score.manager_score !== null && (score.manager_score < 1 || score.manager_score > 10 || !Number.isInteger(score.manager_score))) {
      return { success: false, error: 'バリュースコアに不正な値が含まれています' };
    }
  }

  const supabase = await createClient();

  const upsertData = scores.map((s) => ({
    evaluation_id: evaluationId,
    value_item_id: s.value_item_id,
    manager_score: s.manager_score,
  }));

  const { error } = await supabase
    .from('eval_value_scores')
    .upsert(upsertData, { onConflict: 'evaluation_id,value_item_id' });

  if (error) {
    console.error('manager value score upsert error:', error.message);
    return { success: false, error: '保存に失敗しました' };
  }

  await recalculateValueScore(evaluationId, 'manager');

  return { success: true };
}

// -----------------------------------------------------------------------------
// 上長評価 提出
// -----------------------------------------------------------------------------

export async function submitManagerEvaluation(
  evaluationId: string,
  evaluatorComment: string | null,
  nextActions: string | null
): Promise<ActionResult> {
  const access = await verifyEvaluationAccess(evaluationId, 'manager');
  if (!access.ok) return { success: false, error: access.error };

  if (evaluatorComment !== null && evaluatorComment.length > 5000) {
    return { success: false, error: 'コメントは5000文字以内で入力してください' };
  }
  if (nextActions !== null && nextActions.length > 5000) {
    return { success: false, error: '次期アクションは5000文字以内で入力してください' };
  }

  const member = await getCurrentMember();
  if (!member) return { success: false, error: '認証が必要です' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('evaluations')
    .update({
      evaluator_comment: evaluatorComment || null,
      next_actions: nextActions || null,
      evaluator_id: member.id,
      status: 'manager_submitted',
    })
    .eq('id', evaluationId)
    .eq('status', 'self_submitted') // 楽観ロック
    .select('id')
    .single();

  if (error || !data) {
    console.error('manager evaluation submit error:', error?.message);
    return { success: false, error: '提出に失敗しました。既に提出済みの可能性があります。' };
  }

  // 総合スコア再計算はステータス遷移成功後に実行
  await recalculateTotalScoreAndRank(evaluationId);

  // 通知: 上長評価提出 → キャリブレーション担当に通知 (fire-and-forget)
  // service roleクライアントを使用してnotification_channelsのRLSをバイパス
  const serviceClient = createServiceRoleClient();
  const { data: evalRow, error: evalRowErr } = await serviceClient
    .from('evaluations')
    .select('eval_period_id, member_id')
    .eq('id', evaluationId)
    .single();
  if (evalRowErr) console.error('[DB] evaluations 取得エラー:', evalRowErr);
  if (evalRow) {
    const evalInfo = evalRow as { eval_period_id: string; member_id: string };
    const [periodRes, memberRes] = await Promise.all([
      serviceClient.from('eval_periods').select('name').eq('id', evalInfo.eval_period_id).single(),
      serviceClient.from('members').select('name').eq('id', evalInfo.member_id).single(),
    ]);
    if (periodRes.error) console.error('[DB] eval_periods 取得エラー:', periodRes.error);
    if (memberRes.error) console.error('[DB] members 取得エラー:', memberRes.error);
    const periodName = (periodRes.data as { name: string } | null)?.name ?? '';
    const memberName = (memberRes.data as { name: string } | null)?.name ?? '';
    notifyManagerEvalRequest(member.org_id, memberName, periodName, serviceClient).catch((err: unknown) => {
      console.warn('通知送信失敗:', err instanceof Error ? err.message : err);
    });
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// 上長評価 下書き保存
// -----------------------------------------------------------------------------

export async function saveManagerDraft(
  evaluationId: string,
  evaluatorComment: string | null
): Promise<ActionResult> {
  const access = await verifyEvaluationAccess(evaluationId, 'manager');
  if (!access.ok) return { success: false, error: access.error };

  if (evaluatorComment !== null && evaluatorComment.length > 5000) {
    return { success: false, error: 'コメントは5000文字以内で入力してください' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('evaluations')
    .update({ evaluator_comment: evaluatorComment || null })
    .eq('id', evaluationId)
    .eq('status', 'self_submitted'); // TOCTOU防止

  if (error) {
    console.error('manager draft save error:', error.message);
    return { success: false, error: '保存に失敗しました' };
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// キャリブレーション
// -----------------------------------------------------------------------------

export async function calibrateEvaluation(
  evaluationId: string,
  rank: Rank
): Promise<ActionResult> {
  const access = await verifyEvaluationAccess(evaluationId, 'calibration');
  if (!access.ok) return { success: false, error: access.error };

  const validRanks: Rank[] = ['S', 'A', 'B', 'C', 'D'];
  if (!validRanks.includes(rank)) {
    return { success: false, error: '不正なランクです' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('evaluations')
    .update({
      rank,
      status: 'calibrated',
    })
    .eq('id', evaluationId)
    .eq('status', 'manager_submitted') // 楽観ロック
    .select('id')
    .single();

  if (error || !data) {
    console.error('calibration error:', error?.message);
    return { success: false, error: 'キャリブレーションに失敗しました。既に確定済みの可能性があります。' };
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// フィードバック実施
// -----------------------------------------------------------------------------

export async function submitFeedback(
  evaluationId: string,
  feedbackComment: string | null,
  nextActions: string | null
): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return { success: false, error: '認証が必要です' };

  if (!['G3', 'G4', 'G5'].includes(member.grade)) {
    return { success: false, error: 'フィードバックはG3以上のみ実行可能です' };
  }

  if (feedbackComment !== null && feedbackComment.length > 5000) {
    return { success: false, error: 'コメントは5000文字以内で入力してください' };
  }
  if (nextActions !== null && nextActions.length > 5000) {
    return { success: false, error: '次期アクションは5000文字以内で入力してください' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('evaluations')
    .update({
      evaluator_comment: feedbackComment || null,
      next_actions: nextActions || null,
      status: 'feedback_done',
      updated_at: new Date().toISOString(),
    })
    .eq('id', evaluationId)
    .eq('status', 'calibrated') // 楽観ロック
    .select('id, member_id')
    .single();

  if (error || !data) {
    console.error('feedback submit error:', error?.message);
    return { success: false, error: 'フィードバックの保存に失敗しました。' };
  }

  // 通知: フィードバック完了 → メンバーに通知
  // service roleクライアントを使用してnotification_channelsのRLSをバイパス
  const evalInfo = data as { id: string; member_id: string };
  const feedbackServiceClient = createServiceRoleClient();
  const { data: targetMember, error: targetMemberErr } = await feedbackServiceClient
    .from('members')
    .select('name')
    .eq('id', evalInfo.member_id)
    .single();
  if (targetMemberErr) console.error('[DB] members 取得エラー:', targetMemberErr);
  if (targetMember) {
    const { notifyFeedbackReady } = await import('@/lib/notifications/events');
    notifyFeedbackReady(member.org_id, (targetMember as { name: string }).name, feedbackServiceClient).catch((err: unknown) => {
      console.warn('通知送信失敗:', err instanceof Error ? err.message : err);
    });
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// 評価確定 (finalized)
// -----------------------------------------------------------------------------

export async function finalizeEvaluation(
  evaluationId: string
): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return { success: false, error: '認証が必要です' };

  if (!['G4', 'G5'].includes(member.grade)) {
    return { success: false, error: '評価確定はG4以上のみ実行可能です' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('evaluations')
    .update({ status: 'finalized', updated_at: new Date().toISOString() })
    .eq('id', evaluationId)
    .eq('status', 'feedback_done') // 楽観ロック
    .select('id')
    .single();

  if (error || !data) {
    console.error('finalize error:', error?.message);
    return { success: false, error: '確定に失敗しました。フィードバック未完了の可能性があります。' };
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// 評価期間ステータス遷移 (admin)
// -----------------------------------------------------------------------------

// EVAL_PERIOD_STATUS_ORDER, EVAL_PERIOD_STATUS_LABELS は constants.ts からimport

export async function advanceEvalPeriodStatus(
  periodId: string
): Promise<ActionResult> {
  const member = await getCurrentMember();
  if (!member) return { success: false, error: '認証が必要です' };
  if (!['G4', 'G5'].includes(member.grade)) {
    return { success: false, error: '評価期間の管理はG4以上のみ実行可能です' };
  }

  const supabase = await createClient();
  const { data: period, error: fetchErr } = await supabase
    .from('eval_periods')
    .select('status, name')
    .eq('id', periodId)
    .single();

  if (fetchErr || !period) {
    return { success: false, error: '評価期間が見つかりません' };
  }

  const periodData = period as { status: string; name: string };
  const currentStatus = periodData.status;
  const currentIdx = EVAL_PERIOD_STATUS_ORDER.indexOf(
    currentStatus as typeof EVAL_PERIOD_STATUS_ORDER[number]
  );

  if (currentIdx === -1 || currentIdx >= EVAL_PERIOD_STATUS_ORDER.length - 1) {
    return { success: false, error: 'これ以上ステータスを進めることはできません' };
  }

  const nextStatus = EVAL_PERIOD_STATUS_ORDER[currentIdx + 1];

  const { data, error } = await supabase
    .from('eval_periods')
    .update({ status: nextStatus })
    .eq('id', periodId)
    .eq('status', currentStatus) // 楽観ロック
    .select('id')
    .single();

  if (error || !data) {
    return { success: false, error: 'ステータスの更新に失敗しました' };
  }

  // ステータスに応じた通知を発火（fire-and-forget）
  // service roleクライアントを使用してnotification_channelsのRLSをバイパス
  const notifyServiceClient = createServiceRoleClient();
  if (nextStatus === 'self_eval') {
    notifyEvalPeriodStart(member.org_id, periodData.name, notifyServiceClient).catch((err: unknown) => {
      console.warn('通知送信失敗:', err instanceof Error ? err.message : err);
    });
  } else if (nextStatus === 'calibration') {
    notifyCalibrationStart(member.org_id, periodData.name, notifyServiceClient).catch((err: unknown) => {
      console.warn('通知送信失敗:', err instanceof Error ? err.message : err);
    });
  } else if (nextStatus === 'feedback') {
    notifyCalibrationComplete(member.org_id, periodData.name, notifyServiceClient).catch((err: unknown) => {
      console.warn('通知送信失敗:', err instanceof Error ? err.message : err);
    });
  }

  return { success: true };
}

// -----------------------------------------------------------------------------
// 評価期間ステータス巻き戻し (admin)
// -----------------------------------------------------------------------------


export async function revertEvalPeriodStatus(
  periodId: string
): Promise<{ ok: boolean; error?: string }> {
  const member = await getCurrentMember();
  if (!member) return { ok: false, error: '認証が必要です' };
  if (!['G4', 'G5'].includes(member.grade)) {
    return { ok: false, error: '評価期間の管理はG4以上のみ実行可能です' };
  }

  const supabase = await createClient();
  const { data: period, error: fetchErr } = await supabase
    .from('eval_periods')
    .select('status')
    .eq('id', periodId)
    .single();

  if (fetchErr || !period) {
    return { ok: false, error: '評価期間が見つかりません' };
  }

  const periodData = period as { status: string };
  const currentStatus = periodData.status;
  const currentIdx = EVAL_PERIOD_STATUS_ORDER.indexOf(
    currentStatus as (typeof EVAL_PERIOD_STATUS_ORDER)[number]
  );

  // closed からの巻き戻しは禁止
  if (currentStatus === 'closed') {
    return { ok: false, error: 'クローズ済みの評価期間は巻き戻せません' };
  }

  // planning（最初のステータス）は戻せない
  if (currentIdx <= 0) {
    return { ok: false, error: 'これ以上ステータスを戻すことはできません' };
  }

  const prevStatus = EVAL_PERIOD_STATUS_ORDER[currentIdx - 1];

  const { data, error } = await supabase
    .from('eval_periods')
    .update({ status: prevStatus })
    .eq('id', periodId)
    .eq('status', currentStatus) // 楽観ロック
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: 'ステータスの巻き戻しに失敗しました' };
  }

  return { ok: true };
}

// getPreviousStatusLabel は constants.ts に移動済み

// =============================================================================
// 内部: スコア再計算関数 (サーバーサイドのみ)
// =============================================================================

async function recalculateQuantitativeScore(evaluationId: string): Promise<void> {
  const supabase = await createClient();

  const { data: scores, error: scoresErr } = await supabase
    .from('eval_kpi_scores')
    .select('id, kpi_item_id, target_value, actual_value')
    .eq('evaluation_id', evaluationId)
    .not('actual_value', 'is', null);
  if (scoresErr) console.error('[DB] eval_kpi_scores 取得エラー:', scoresErr);

  if (!scores || scores.length === 0) return;

  const kpiScores = scores as Array<{
    id: string;
    kpi_item_id: string;
    target_value: number | null;
    actual_value: number | null;
  }>;

  const kpiItemIds = kpiScores.map((s) => s.kpi_item_id);
  const { data: items, error: itemsErr } = await supabase
    .from('kpi_items')
    .select('id, weight, threshold_s, threshold_a, threshold_b, threshold_c')
    .in('id', kpiItemIds);
  if (itemsErr) console.error('[DB] kpi_items 取得エラー:', itemsErr);

  if (!items) return;

  const kpiItems = items as Array<{
    id: string;
    weight: number;
    threshold_s: number | null;
    threshold_a: number | null;
    threshold_b: number | null;
    threshold_c: number | null;
  }>;

  const itemMap = new Map(kpiItems.map((i) => [i.id, i]));

  const kpiInputs: Array<{
    scoreId: string;
    weight: number;
    achievementRate: number;
    thresholds: KPIThresholds;
    rank: Rank;
  }> = [];

  for (const score of kpiScores) {
    const item = itemMap.get(score.kpi_item_id);
    if (!item || score.target_value == null || score.target_value === 0 || score.actual_value == null) continue;

    const achievementRate = (score.actual_value / score.target_value) * 100;
    const thresholds: KPIThresholds = {
      s: item.threshold_s ?? 120,
      a: item.threshold_a ?? 100,
      b: item.threshold_b ?? 80,
      c: item.threshold_c ?? 60,
    };
    const rank = determineKPIRank(achievementRate, thresholds);
    kpiInputs.push({ scoreId: score.id, weight: item.weight, achievementRate, thresholds, rank });
  }

  if (kpiInputs.length === 0) return;

  // 各 eval_kpi_scores に rank を書き戻す
  for (const input of kpiInputs) {
    await supabase
      .from('eval_kpi_scores')
      .update({ rank: input.rank })
      .eq('id', input.scoreId);
  }

  // 加重平均スコア算出
  const quantitativeScore = calculateKPIScore(
    kpiInputs.map((i) => ({ weight: i.weight, achievementRate: i.achievementRate, thresholds: i.thresholds }))
  );

  await supabase
    .from('evaluations')
    .update({ quantitative_score: quantitativeScore })
    .eq('id', evaluationId);
}

async function recalculateQualitativeScore(
  evaluationId: string,
  mode: 'self' | 'manager'
): Promise<void> {
  const supabase = await createClient();
  const scoreColumn = mode === 'self' ? 'self_score' : 'manager_score';

  const { data: scores, error: behaviorScoresErr } = await supabase
    .from('eval_behavior_scores')
    .select(scoreColumn)
    .eq('evaluation_id', evaluationId)
    .not(scoreColumn, 'is', null);
  if (behaviorScoresErr) console.error('[DB] eval_behavior_scores 取得エラー:', behaviorScoresErr);

  if (!scores || scores.length === 0) return;

  const behaviorScores = scores as Array<Record<string, number>>;
  const sum = behaviorScores.reduce((acc, s) => acc + s[scoreColumn], 0);
  const average = sum / behaviorScores.length;
  const qualitativeScore = Math.round((average / 4) * 100 * 100) / 100;

  await supabase
    .from('evaluations')
    .update({ qualitative_score: qualitativeScore })
    .eq('id', evaluationId);
}

async function recalculateValueScore(
  evaluationId: string,
  mode: 'self' | 'manager'
): Promise<void> {
  const supabase = await createClient();
  const scoreColumn = mode === 'self' ? 'self_score' : 'manager_score';

  const { data: scores, error: valueScoresErr } = await supabase
    .from('eval_value_scores')
    .select(`value_item_id, ${scoreColumn}`)
    .eq('evaluation_id', evaluationId)
    .not(scoreColumn, 'is', null);
  if (valueScoresErr) console.error('[DB] eval_value_scores 取得エラー:', valueScoresErr);

  if (!scores || scores.length === 0) return;

  // value_items から max_score を取得
  const valueItemIds = scores.map((s: Record<string, string>) => s.value_item_id);
  const { data: valueItems, error: valueItemsErr } = await supabase
    .from('value_items')
    .select('id, max_score')
    .in('id', valueItemIds);
  if (valueItemsErr) console.error('[DB] value_items 取得エラー:', valueItemsErr);

  if (!valueItems) return;

  const maxScoreMap = new Map(
    (valueItems as Array<{ id: string; max_score: number }>).map((v) => [v.id, v.max_score])
  );

  let sumScore = 0;
  let sumMaxScore = 0;

  for (const s of scores as Array<Record<string, number | string>>) {
    const maxScore = maxScoreMap.get(s.value_item_id as string);
    if (maxScore == null || maxScore === 0) continue;
    sumScore += s[scoreColumn] as number;
    sumMaxScore += maxScore;
  }

  if (sumMaxScore === 0) return;

  const valueScore = Math.round((sumScore / sumMaxScore) * 100 * 100) / 100;

  await supabase
    .from('evaluations')
    .update({ value_score: valueScore })
    .eq('id', evaluationId);
}

/** 上位行動ボーナスによるランク段階アップ */
function applyBonusToRank(rank: Rank, bonus: number): Rank {
  const ranks: Rank[] = ['D', 'C', 'B', 'A', 'S'];
  const currentIdx = ranks.indexOf(rank);
  const newIdx = Math.min(currentIdx + bonus, ranks.length - 1);
  return ranks[newIdx];
}

function determineUpperBehaviorBonus(flagCount: number): number {
  if (flagCount >= 3) return 2;
  if (flagCount >= 1) return 1;
  return 0;
}

async function recalculateTotalScoreAndRank(evaluationId: string): Promise<void> {
  const supabase = await createClient();

  const { data: evaluation, error: evaluationErr } = await supabase
    .from('evaluations')
    .select(
      'member_id, eval_period_id, quantitative_score, qualitative_score, value_score, phase_at_eval, quantitative_weight, qualitative_weight, value_weight'
    )
    .eq('id', evaluationId)
    .single();
  if (evaluationErr) console.error('[DB] evaluations 取得エラー:', evaluationErr);

  if (!evaluation) return;

  const evalData = evaluation as {
    member_id: string;
    eval_period_id: string;
    quantitative_score: number | null;
    qualitative_score: number | null;
    value_score: number | null;
    phase_at_eval: Phase;
    quantitative_weight: number;
    qualitative_weight: number;
    value_weight: number;
  };

  const weights = {
    quantitative: evalData.quantitative_weight,
    qualitative: evalData.qualitative_weight,
    value: evalData.value_weight,
  };

  const totalScore = calculateTotalScore(
    evalData.quantitative_score ?? 0,
    evalData.qualitative_score ?? 0,
    evalData.value_score ?? 0,
    weights
  );

  // --- rank_thresholds テーブルからカスタム閾値を取得 ---
  // メンバーの org_id を取得
  const { data: memberRow, error: memberRowErr } = await supabase
    .from('members')
    .select('org_id')
    .eq('id', evalData.member_id)
    .single();
  if (memberRowErr) console.error('[DB] members 取得エラー:', memberRowErr);

  let baseRank: Rank;
  let salaryAmount: number;

  if (memberRow) {
    const orgId = (memberRow as { org_id: string }).org_id;
    const { data: thresholds, error: thresholdsErr } = await supabase
      .from('rank_thresholds')
      .select('rank, min_score, salary_change')
      .eq('org_id', orgId)
      .order('min_score', { ascending: false });
    if (thresholdsErr) console.error('[DB] rank_thresholds 取得エラー:', thresholdsErr);

    if (thresholds && thresholds.length > 0) {
      // DB閾値を使用
      const rows = thresholds as Array<{ rank: string; min_score: number; salary_change: number }>;
      baseRank = 'D';
      salaryAmount = 0;
      for (const row of rows) {
        if (totalScore >= row.min_score) {
          baseRank = row.rank as Rank;
          salaryAmount = row.salary_change;
          break;
        }
      }
    } else {
      // フォールバック: ハードコード定数
      baseRank = determineRank(totalScore);
      salaryAmount = recommendSalaryChange(baseRank).amount;
    }
  } else {
    baseRank = determineRank(totalScore);
    salaryAmount = recommendSalaryChange(baseRank).amount;
  }

  // 上位行動ボーナス: 上長評価済み(manager_score非null)かつフラグ付きのみカウント
  const { data: upperBehaviors, error: upperBehaviorsErr } = await supabase
    .from('eval_behavior_scores')
    .select('id')
    .eq('evaluation_id', evaluationId)
    .eq('is_upper_grade_behavior', true)
    .not('manager_score', 'is', null);
  if (upperBehaviorsErr) console.error('[DB] eval_behavior_scores 取得エラー:', upperBehaviorsErr);

  const upperCount = upperBehaviors?.length ?? 0;
  const bonus = determineUpperBehaviorBonus(upperCount);
  const finalRank = applyBonusToRank(baseRank, bonus);

  // ボーナス適用後のランクに対応する昇給額を再取得
  if (finalRank !== baseRank) {
    // rank_thresholdsがある場合はそこから取得
    if (memberRow) {
      const orgId = (memberRow as { org_id: string }).org_id;
      const { data: finalThreshold, error: finalThresholdErr } = await supabase
        .from('rank_thresholds')
        .select('salary_change')
        .eq('org_id', orgId)
        .eq('rank', finalRank)
        .single();
      if (finalThresholdErr) console.error('[DB] rank_thresholds 取得エラー:', finalThresholdErr);
      if (finalThreshold) {
        salaryAmount = (finalThreshold as { salary_change: number }).salary_change;
      } else {
        salaryAmount = recommendSalaryChange(finalRank).amount;
      }
    } else {
      salaryAmount = recommendSalaryChange(finalRank).amount;
    }
  }

  // --- promotion_eligibility 計算 ---
  // 過去評価を取得して昇格適格性を判定
  const { data: pastEvals, error: pastEvalsErr } = await supabase
    .from('evaluations')
    .select('rank, eval_period_id')
    .eq('member_id', evalData.member_id)
    .neq('eval_period_id', evalData.eval_period_id)
    .in('status', ['calibrated', 'feedback_done', 'finalized'])
    .not('rank', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  if (pastEvalsErr) console.error('[DB] evaluations 取得エラー:', pastEvalsErr);

  let promotionEligibility: 'immediate' | 'candidate' | 'none' = 'none';
  if (finalRank === 'S') {
    promotionEligibility = 'immediate';
  } else if (finalRank === 'A' && pastEvals && pastEvals.length > 0) {
    const prevRank = (pastEvals as Array<{ rank: string }>)[0].rank;
    if (prevRank === 'S' || prevRank === 'A') {
      promotionEligibility = 'candidate';
    }
  }

  await supabase
    .from('evaluations')
    .update({
      total_score: totalScore,
      rank: finalRank,
      upper_behavior_bonus: bonus,
      salary_change_recommended: salaryAmount,
      promotion_eligibility: promotionEligibility,
    })
    .eq('id', evaluationId);
}
