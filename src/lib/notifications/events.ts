// =============================================================================
// イベント別通知便利関数
// 各業務アクションから呼び出す
// =============================================================================

import { sendNotification } from './send';
import type { SupabaseClient } from '@supabase/supabase-js';

/** ベースURL（環境変数から取得、なければ空文字） */
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

/**
 * 評価期間開始通知
 * @param supabaseClient RLSバイパス用のservice roleクライアント（省略時はcookiesベース）
 */
export async function notifyEvalPeriodStart(
  orgId: string,
  periodName: string,
  supabaseClient?: SupabaseClient
) {
  return sendNotification(orgId, {
    event: 'eval_period_start',
    title: '評価期間が開始されました',
    message: `${periodName}の評価期間が開始されました。自己評価の入力を開始してください。`,
    url: `${BASE_URL}/self`,
  }, supabaseClient);
}

/**
 * 自己評価提出時の通知
 * @param supabaseClient RLSバイパス用のservice roleクライアント（省略時はcookiesベース）
 */
export async function notifyEvalSubmitted(
  orgId: string,
  memberName: string,
  periodName: string,
  supabaseClient?: SupabaseClient
) {
  return sendNotification(orgId, {
    event: 'eval_submitted',
    title: '自己評価が提出されました',
    message: `${memberName}さんが${periodName}の自己評価を提出しました。上長評価をお願いします。`,
    url: `${BASE_URL}/periods`,
  }, supabaseClient);
}

/**
 * 自己評価提出リマインド
 * @param supabaseClient Cronジョブから呼ぶ場合にservice roleクライアントを渡す
 */
export async function notifyEvalSubmissionReminder(
  orgId: string,
  periodName: string,
  supabaseClient?: SupabaseClient
) {
  return sendNotification(orgId, {
    event: 'eval_submission_reminder',
    title: '自己評価の提出期限が近づいています',
    message: `${periodName}の自己評価提出期限が近づいています。まだ提出されていない方はお早めにお願いします。`,
    url: `${BASE_URL}/self`,
  }, supabaseClient);
}

/**
 * 上長評価依頼通知
 * @param supabaseClient RLSバイパス用のservice roleクライアント（省略時はcookiesベース）
 */
export async function notifyManagerEvalRequest(
  orgId: string,
  memberName: string,
  periodName: string,
  supabaseClient?: SupabaseClient
) {
  return sendNotification(orgId, {
    event: 'manager_eval_request',
    title: '上長評価の依頼',
    message: `${memberName}さんの${periodName}上長評価をお願いします。`,
    url: `${BASE_URL}/periods`,
  }, supabaseClient);
}

/**
 * キャリブレーション開始通知
 * @param supabaseClient RLSバイパス用のservice roleクライアント（省略時はcookiesベース）
 */
export async function notifyCalibrationStart(
  orgId: string,
  periodName: string,
  supabaseClient?: SupabaseClient
) {
  return sendNotification(orgId, {
    event: 'calibration_start',
    title: 'キャリブレーションが開始されました',
    message: `${periodName}のキャリブレーションが開始されました。評価の調整をお願いします。`,
    url: `${BASE_URL}/calibration`,
  }, supabaseClient);
}

/**
 * キャリブレーション完了通知
 * @param supabaseClient RLSバイパス用のservice roleクライアント（省略時はcookiesベース）
 */
export async function notifyCalibrationComplete(
  orgId: string,
  periodName: string,
  supabaseClient?: SupabaseClient
) {
  return sendNotification(orgId, {
    event: 'calibration_complete',
    title: 'キャリブレーションが完了しました',
    message: `${periodName}のキャリブレーションが完了しました。`,
    url: `${BASE_URL}/calibration`,
  }, supabaseClient);
}

/**
 * フィードバック完了通知
 * @param supabaseClient RLSバイパス用のservice roleクライアント（省略時はcookiesベース）
 */
export async function notifyFeedbackReady(
  orgId: string,
  memberName: string,
  supabaseClient?: SupabaseClient
) {
  return sendNotification(orgId, {
    event: 'feedback_ready',
    title: '評価フィードバックが完了しました',
    message: `${memberName}さんの評価フィードバックが完了しました。結果をご確認ください。`,
    url: `${BASE_URL}/results`,
  }, supabaseClient);
}

/**
 * OKR期間開始通知
 * @param supabaseClient RLSバイパス用のservice roleクライアント（省略時はcookiesベース）
 */
export async function notifyOkrPeriodStart(
  orgId: string,
  periodName: string,
  supabaseClient?: SupabaseClient
) {
  return sendNotification(orgId, {
    event: 'okr_period_start',
    title: 'OKR期間が開始されました',
    message: `${periodName}のOKR期間が始まりました。OKRの設定をお願いします。`,
    url: `${BASE_URL}/objectives`,
  }, supabaseClient);
}

/**
 * 週次チェックインリマインド
 * @param supabaseClient Cronジョブから呼ぶ場合にservice roleクライアントを渡す
 */
export async function notifyOkrCheckinReminder(
  orgId: string,
  supabaseClient?: SupabaseClient
) {
  return sendNotification(orgId, {
    event: 'okr_checkin_reminder',
    title: 'OKRチェックインのリマインド',
    message: '今週のOKRチェックインを実施してください。',
    url: `${BASE_URL}/checkin`,
  }, supabaseClient);
}

/**
 * OKR振り返り期限通知
 * @param supabaseClient Cronジョブから呼ぶ場合にservice roleクライアントを渡す
 */
export async function notifyOkrReviewDeadline(
  orgId: string,
  periodName: string,
  supabaseClient?: SupabaseClient
) {
  return sendNotification(orgId, {
    event: 'okr_review_deadline',
    title: 'OKR振り返りの期限が近づいています',
    message: `${periodName}のOKR振り返り期限が近づいています。振り返りをお願いします。`,
    url: `${BASE_URL}/review`,
  }, supabaseClient);
}

/**
 * クロスセルトス通知
 * @param supabaseClient RLSバイパス用のservice roleクライアント（省略時はcookiesベース）
 */
export async function notifyCrosssellToss(
  orgId: string,
  tosserName: string,
  receiverName: string,
  note: string,
  supabaseClient?: SupabaseClient
) {
  return sendNotification(orgId, {
    event: 'crosssell_toss',
    title: '新しいトスアップがあります',
    message: `${tosserName}さんから${receiverName}さんへトスアップが登録されました。\n${note}`,
    url: `${BASE_URL}/toss`,
  }, supabaseClient);
}

/**
 * クロスセル成約通知
 * @param supabaseClient RLSバイパス用のservice roleクライアント（省略時はcookiesベース）
 */
export async function notifyCrosssellContracted(
  orgId: string,
  memberName: string,
  amount: string,
  supabaseClient?: SupabaseClient
) {
  return sendNotification(orgId, {
    event: 'crosssell_contracted',
    title: 'クロスセルが成約しました',
    message: `${memberName}さんのクロスセルが成約しました。金額: ${amount}`,
    url: `${BASE_URL}/toss`,
  }, supabaseClient);
}

/**
 * ボーナス確定通知
 * @param supabaseClient RLSバイパス用のservice roleクライアント（省略時はcookiesベース）
 */
export async function notifyBonusConfirmed(
  orgId: string,
  periodName: string,
  supabaseClient?: SupabaseClient
) {
  return sendNotification(orgId, {
    event: 'bonus_confirmed',
    title: 'ボーナスが確定しました',
    message: `${periodName}のボーナスが確定しました。詳細をご確認ください。`,
    url: `${BASE_URL}/quarterly-bonus`,
  }, supabaseClient);
}

/**
 * 1on1リマインド通知
 * @param supabaseClient Cronジョブから呼ぶ場合にservice roleクライアントを渡す
 */
export async function notifyOneOnOneReminder(
  orgId: string,
  supabaseClient?: SupabaseClient
) {
  return sendNotification(orgId, {
    event: 'one_on_one_reminder',
    title: '1on1ミーティングのリマインド',
    message: '今月の1on1面談を実施してください。',
    url: `${BASE_URL}/one-on-one/new`,
  }, supabaseClient);
}

/**
 * ウィンセッションリマインド
 * @param supabaseClient Cronジョブから呼ぶ場合にservice roleクライアントを渡す
 */
export async function notifyWinSessionReminder(
  orgId: string,
  supabaseClient?: SupabaseClient
) {
  return sendNotification(orgId, {
    event: 'win_session_reminder',
    title: 'ウィンセッションのリマインド',
    message: '今週のウィンセッションに投稿をお願いします。',
    url: `${BASE_URL}/win-session`,
  }, supabaseClient);
}
