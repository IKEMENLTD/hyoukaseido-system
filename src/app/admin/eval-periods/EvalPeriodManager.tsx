// =============================================================================
// 評価期間管理クライアントコンポーネント
// ステータス遷移: planning → target_setting → self_eval → manager_eval →
//                  calibration → feedback → closed
// =============================================================================

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { advanceEvalPeriodStatus, revertEvalPeriodStatus, getPreviousStatusLabel } from '@/lib/evaluation/actions';
import type { EvalPeriodStatus, Half } from '@/types/evaluation';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface EvalPeriodRow {
  id: string;
  org_id: string;
  name: string;
  half: Half | null;
  fiscal_year: number | null;
  start_date: string;
  end_date: string;
  status: EvalPeriodStatus;
}

interface OkrPeriodOption {
  id: string;
  name: string;
  quarter: number;
  fiscalYear: number;
  status: string;
}

interface EvalOkrLink {
  eval_period_id: string;
  okr_period_id: string;
}

interface EvalPeriodManagerProps {
  initialPeriods: EvalPeriodRow[];
  orgId: string;
  okrPeriods: OkrPeriodOption[];
  existingLinks: EvalOkrLink[];
}

interface PeriodFormData {
  name: string;
  half: Half;
  fiscal_year: string;
  start_date: string;
  end_date: string;
}

type ModalMode = 'closed' | 'create' | 'confirm_advance' | 'link_okr';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const STATUS_FLOW: readonly EvalPeriodStatus[] = [
  'planning',
  'target_setting',
  'self_eval',
  'manager_eval',
  'calibration',
  'feedback',
  'closed',
] as const;

const STATUS_CONFIG: Record<EvalPeriodStatus, { label: string; color: string }> = {
  planning: { label: '準備中', color: 'text-[#737373] border-[#737373]' },
  target_setting: { label: '目標設定', color: 'text-[#f59e0b] border-[#f59e0b]' },
  self_eval: { label: '自己評価', color: 'text-[#3b82f6] border-[#3b82f6]' },
  manager_eval: { label: '上長評価', color: 'text-[#a855f7] border-[#a855f7]' },
  calibration: { label: 'キャリブレーション', color: 'text-[#22d3ee] border-[#22d3ee]' },
  feedback: { label: 'フィードバック', color: 'text-[#10b981] border-[#10b981]' },
  closed: { label: 'クローズ', color: 'text-[#404040] border-[#404040]' },
};

const HALVES: readonly Half[] = ['H1', 'H2'] as const;

const EMPTY_FORM: PeriodFormData = {
  name: '',
  half: 'H1',
  fiscal_year: '',
  start_date: '',
  end_date: '',
};

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function getNextStatus(current: EvalPeriodStatus): EvalPeriodStatus | null {
  const index = STATUS_FLOW.indexOf(current);
  if (index === -1 || index >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[index + 1];
}

function getPrevStatus(current: EvalPeriodStatus): EvalPeriodStatus | null {
  if (current === 'closed' || current === 'planning') return null;
  const index = STATUS_FLOW.indexOf(current);
  if (index <= 0) return null;
  return STATUS_FLOW[index - 1];
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export default function EvalPeriodManager({
  initialPeriods,
  orgId,
  okrPeriods,
  existingLinks,
}: EvalPeriodManagerProps) {
  const router = useRouter();
  const supabase = createClient();

  // --- State ---
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [formData, setFormData] = useState<PeriodFormData>(EMPTY_FORM);
  const [advanceTarget, setAdvanceTarget] = useState<EvalPeriodRow | null>(null);
  const [linkTarget, setLinkTarget] = useState<EvalPeriodRow | null>(null);
  const [selectedOkrIds, setSelectedOkrIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- 派生データ ---
  const activeCount = useMemo(
    () => initialPeriods.filter((p) => p.status !== 'closed').length,
    [initialPeriods]
  );

  // --- ヘルパー ---
  const clearMessages = useCallback(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
  }, []);

  const closeModal = useCallback(() => {
    setModalMode('closed');
    setFormData(EMPTY_FORM);
    setAdvanceTarget(null);
    setLinkTarget(null);
    setSelectedOkrIds(new Set());
    clearMessages();
  }, [clearMessages]);

  const openCreateModal = useCallback(() => {
    setFormData(EMPTY_FORM);
    setModalMode('create');
    clearMessages();
  }, [clearMessages]);

  const openAdvanceConfirm = useCallback(
    (period: EvalPeriodRow) => {
      setAdvanceTarget(period);
      setModalMode('confirm_advance');
      clearMessages();
    },
    [clearMessages]
  );

  // --- フォーム更新 ---
  const updateFormField = useCallback(
    <K extends keyof PeriodFormData>(field: K, value: PeriodFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // --- バリデーション ---
  const validateForm = useCallback((): string | null => {
    if (!formData.name.trim()) return '期間名を入力してください';
    const fy = Number(formData.fiscal_year);
    if (!formData.fiscal_year || isNaN(fy) || fy < 2000 || fy > 2100) {
      return '年度を正しく入力してください (2000-2100)';
    }
    if (!formData.start_date) return '開始日を入力してください';
    if (!formData.end_date) return '終了日を入力してください';
    if (formData.start_date >= formData.end_date) {
      return '終了日は開始日より後の日付にしてください';
    }
    return null;
  }, [formData]);

  // --- 操作 ---

  /** 新規期間作成 */
  const handleCreate = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from('eval_periods')
      .insert({
        org_id: orgId,
        name: formData.name.trim(),
        half: formData.half,
        fiscal_year: Number(formData.fiscal_year),
        start_date: formData.start_date,
        end_date: formData.end_date,
        status: 'planning' as EvalPeriodStatus,
      })
      .select()
      .single();

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(`評価期間の作成に失敗しました: ${error.message}`);
      return;
    }

    setSuccessMessage('評価期間を作成しました');
    closeModal();
    router.refresh();
  }, [supabase, orgId, formData, validateForm, closeModal, router]);

  /** ステータス進行 (Server Action経由) */
  const handleAdvanceStatus = useCallback(async () => {
    if (!advanceTarget) return;

    const nextStatus = getNextStatus(advanceTarget.status);
    if (!nextStatus) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await advanceEvalPeriodStatus(advanceTarget.id);

    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.error ?? 'ステータスの更新に失敗しました');
      return;
    }

    setSuccessMessage(
      `ステータスを「${STATUS_CONFIG[nextStatus].label}」に進めました`
    );
    closeModal();
    router.refresh();
  }, [advanceTarget, closeModal, router]);

  /** ステータス巻き戻し (window.confirm で確認) */
  const handleRevertStatus = useCallback(
    async (period: EvalPeriodRow) => {
      const prevStatus = getPrevStatus(period.status);
      if (!prevStatus) return;

      const prevLabel = STATUS_CONFIG[prevStatus].label;
      const confirmed = window.confirm(
        `ステータスを「${prevLabel}」に戻します。よろしいですか？`
      );
      if (!confirmed) return;

      setIsSubmitting(true);
      setErrorMessage(null);

      const result = await revertEvalPeriodStatus(period.id);

      setIsSubmitting(false);

      if (!result.ok) {
        setErrorMessage(result.error ?? 'ステータスの巻き戻しに失敗しました');
        return;
      }

      setSuccessMessage(`ステータスを「${prevLabel}」に戻しました`);
      router.refresh();
    },
    [router]
  );

  /** OKR紐付けモーダルを開く */
  const openLinkOkrModal = useCallback(
    (period: EvalPeriodRow) => {
      setLinkTarget(period);
      // 既存リンクをロード
      const linked = existingLinks
        .filter((l) => l.eval_period_id === period.id)
        .map((l) => l.okr_period_id);
      setSelectedOkrIds(new Set(linked));
      setModalMode('link_okr');
      clearMessages();
    },
    [existingLinks, clearMessages]
  );

  /** OKR紐付け保存 */
  const handleSaveOkrLinks = useCallback(async () => {
    if (!linkTarget) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    // 既存リンクを全削除して再作成
    const { error: delError } = await supabase
      .from('eval_period_okr_periods')
      .delete()
      .eq('eval_period_id', linkTarget.id);

    if (delError) {
      setErrorMessage('紐付けの更新に失敗しました');
      setIsSubmitting(false);
      return;
    }

    if (selectedOkrIds.size > 0) {
      const inserts = Array.from(selectedOkrIds).map((okrPeriodId) => ({
        eval_period_id: linkTarget.id,
        okr_period_id: okrPeriodId,
      }));

      const { error: insError } = await supabase
        .from('eval_period_okr_periods')
        .insert(inserts);

      if (insError) {
        setErrorMessage('紐付けの保存に失敗しました');
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(false);
    setSuccessMessage('OKR期間の紐付けを更新しました');
    closeModal();
    router.refresh();
  }, [supabase, linkTarget, selectedOkrIds, closeModal, router]);

  /** OKR期間紐付け数を取得するヘルパー */
  const getLinkedOkrCount = useCallback(
    (periodId: string) => existingLinks.filter((l) => l.eval_period_id === periodId).length,
    [existingLinks]
  );

  // --- 描画 ---
  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              評価期間管理
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              評価期間の作成、ステータス遷移管理
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 border border-[#3b82f6] bg-[#3b82f6] text-xs text-white font-bold hover:bg-[#2563eb] transition-colors"
          >
            新規期間作成
          </button>
        </div>

        {/* 成功メッセージ */}
        {successMessage && modalMode === 'closed' && (
          <div className="border border-emerald-900 bg-emerald-950/30 px-4 py-3 text-xs text-emerald-400 flex items-center justify-between">
            <span>{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-600 hover:text-emerald-400 text-xs ml-4"
            >
              閉じる
            </button>
          </div>
        )}

        {/* エラーメッセージ (モーダル外) */}
        {errorMessage && modalMode === 'closed' && (
          <div className="border border-red-900 bg-red-950/30 px-4 py-3 text-xs text-red-400">
            {errorMessage}
          </div>
        )}

        {/* サマリー */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">合計期間</div>
            <div className="text-2xl font-bold text-[#e5e5e5]">{initialPeriods.length}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">進行中</div>
            <div className="text-2xl font-bold text-[#3b82f6]">{activeCount}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">完了</div>
            <div className="text-2xl font-bold text-[#404040]">
              {initialPeriods.length - activeCount}
            </div>
          </div>
        </div>

        {/* ステータスフロー説明 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-[#737373] uppercase tracking-wider mb-3">
            評価フロー
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FLOW.map((status, index) => {
              const config = STATUS_CONFIG[status];
              return (
                <div key={status} className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 border text-[10px] font-bold ${config.color}`}>
                    {config.label}
                  </span>
                  {index < STATUS_FLOW.length - 1 && (
                    <span className="text-[#333333] text-xs">{'>'}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 評価期間一覧 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              評価期間一覧
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#737373]">
                  <th className="px-4 py-2 text-left font-medium">期間名</th>
                  <th className="px-4 py-2 text-center font-medium">半期</th>
                  <th className="px-4 py-2 text-center font-medium">年度</th>
                  <th className="px-4 py-2 text-left font-medium">開始日</th>
                  <th className="px-4 py-2 text-left font-medium">終了日</th>
                  <th className="px-4 py-2 text-center font-medium">ステータス</th>
                  <th className="px-4 py-2 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {initialPeriods.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#737373] text-sm">
                      データがありません
                    </td>
                  </tr>
                )}
                {initialPeriods.map((period) => {
                  const statusConfig = STATUS_CONFIG[period.status];
                  const nextStatus = getNextStatus(period.status);
                  return (
                    <tr
                      key={period.id}
                      className={`border-b border-[#111111] hover:bg-[#111111] transition-colors ${
                        period.status === 'closed' ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-[#e5e5e5] font-medium">{period.name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 border border-[#333333] text-xs text-[#a3a3a3]">
                          {period.half ?? '---'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-[#a3a3a3]">
                        {period.fiscal_year ?? '---'}
                      </td>
                      <td className="px-4 py-3 text-[#737373]">{period.start_date}</td>
                      <td className="px-4 py-3 text-[#737373]">{period.end_date}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 border text-xs font-bold ${statusConfig.color}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {getPrevStatus(period.status) && (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleRevertStatus(period)}
                              className="px-2 py-1 border border-[#f59e0b] text-[10px] text-[#f59e0b] hover:bg-[#f59e0b]/10 transition-colors disabled:opacity-50"
                            >
                              {'<-'} {STATUS_CONFIG[getPrevStatus(period.status)!].label}に戻す
                            </button>
                          )}
                          {nextStatus && (
                            <button
                              type="button"
                              onClick={() => openAdvanceConfirm(period)}
                              className="px-2 py-1 border border-[#333333] text-[10px] text-[#a3a3a3] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors"
                            >
                              次フェーズへ
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openLinkOkrModal(period)}
                            className="px-2 py-1 border border-[#333333] text-[10px] text-[#a3a3a3] hover:border-[#22d3ee] hover:text-[#22d3ee] transition-colors"
                          >
                            OKR ({getLinkedOkrCount(period.id)})
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- モーダル --- */}
      {modalMode !== 'closed' && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] w-full max-w-lg mx-4">
            {/* モーダルヘッダー */}
            <div className="border-b border-[#1a1a1a] px-3 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#e5e5e5] uppercase tracking-wider">
                {modalMode === 'create' && '新規評価期間作成'}
                {modalMode === 'confirm_advance' && 'ステータス変更確認'}
                {modalMode === 'link_okr' && 'OKR期間の紐付け'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-[#737373] hover:text-[#e5e5e5] text-xs transition-colors"
              >
                閉じる
              </button>
            </div>

            {/* モーダルボディ */}
            <div className="px-3 py-3 sm:px-6 sm:py-4 space-y-4">
              {/* エラーメッセージ (モーダル内) */}
              {errorMessage && (
                <div className="border border-red-900 bg-red-950/30 px-3 py-2 text-xs text-red-400">
                  {errorMessage}
                </div>
              )}

              {/* 作成フォーム */}
              {modalMode === 'create' && (
                <>
                  {/* 期間名 */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">期間名</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateFormField('name', e.target.value)}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                      placeholder="2026年度 上期評価"
                    />
                  </div>

                  {/* 半期 */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">半期</label>
                    <select
                      value={formData.half}
                      onChange={(e) => updateFormField('half', e.target.value as Half)}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                    >
                      {HALVES.map((h) => (
                        <option key={h} value={h}>
                          {h === 'H1' ? '上期 (H1)' : '下期 (H2)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 年度 */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">年度</label>
                    <input
                      type="number"
                      value={formData.fiscal_year}
                      onChange={(e) => updateFormField('fiscal_year', e.target.value)}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                      placeholder="2026"
                      min={2000}
                      max={2100}
                    />
                  </div>

                  {/* 開始日 */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">開始日</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => updateFormField('start_date', e.target.value)}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                    />
                  </div>

                  {/* 終了日 */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">終了日</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => updateFormField('end_date', e.target.value)}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                    />
                  </div>
                </>
              )}

              {/* ステータス変更確認 */}
              {modalMode === 'confirm_advance' && advanceTarget && (
                <div className="space-y-4">
                  <p className="text-sm text-[#a3a3a3]">
                    以下の評価期間のステータスを進めます。この操作は元に戻せません。
                  </p>
                  <div className="border border-[#1a1a1a] bg-[#111] p-4 space-y-2">
                    <div className="text-xs text-[#737373]">期間名</div>
                    <div className="text-sm text-[#e5e5e5] font-medium">
                      {advanceTarget.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-xs text-[#737373] mb-1">現在</div>
                      <span
                        className={`px-2 py-0.5 border text-xs font-bold ${STATUS_CONFIG[advanceTarget.status].color}`}
                      >
                        {STATUS_CONFIG[advanceTarget.status].label}
                      </span>
                    </div>
                    <span className="text-[#404040] text-lg mt-4">→</span>
                    {getNextStatus(advanceTarget.status) && (
                      <div className="flex-1">
                        <div className="text-xs text-[#737373] mb-1">変更後</div>
                        <span
                          className={`px-2 py-0.5 border text-xs font-bold ${STATUS_CONFIG[getNextStatus(advanceTarget.status)!].color}`}
                        >
                          {STATUS_CONFIG[getNextStatus(advanceTarget.status)!].label}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* OKR期間紐付けフォーム */}
              {modalMode === 'link_okr' && linkTarget && (
                <div className="space-y-4">
                  <p className="text-sm text-[#a3a3a3]">
                    <span className="text-[#e5e5e5] font-bold">{linkTarget.name}</span> に紐付けるOKR四半期を選択してください。
                  </p>
                  <div className="space-y-2">
                    {okrPeriods.length === 0 ? (
                      <p className="text-xs text-[#737373]">OKR期間が登録されていません</p>
                    ) : (
                      okrPeriods.map((okr) => {
                        const isChecked = selectedOkrIds.has(okr.id);
                        return (
                          <label
                            key={okr.id}
                            className={`flex items-center gap-3 border p-3 cursor-pointer transition-colors ${
                              isChecked ? 'border-[#22d3ee] bg-[#22d3ee]/5' : 'border-[#1a1a1a] hover:border-[#333333]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedOkrIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(okr.id)) {
                                    next.delete(okr.id);
                                  } else {
                                    next.add(okr.id);
                                  }
                                  return next;
                                });
                              }}
                              className="accent-[#22d3ee]"
                            />
                            <div className="flex-1">
                              <div className="text-sm text-[#e5e5e5]">{okr.name}</div>
                              <div className="text-[10px] text-[#404040] mt-0.5">
                                {okr.fiscalYear}年度 Q{okr.quarter} / {okr.status}
                              </div>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <div className="text-xs text-[#737373]">
                    選択中: {selectedOkrIds.size}件
                  </div>
                </div>
              )}
            </div>

            {/* モーダルフッター */}
            <div className="border-t border-[#1a1a1a] px-3 py-3 sm:px-6 sm:py-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="px-4 py-2 border border-[#1a1a1a] text-xs text-[#a3a3a3] hover:text-[#e5e5e5] hover:border-[#333333] transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={
                  modalMode === 'create'
                    ? handleCreate
                    : modalMode === 'link_okr'
                      ? handleSaveOkrLinks
                      : handleAdvanceStatus
                }
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#3b82f6] border border-[#3b82f6] text-xs text-white font-bold hover:bg-[#2563eb] transition-colors disabled:opacity-50"
              >
                {isSubmitting
                  ? '処理中...'
                  : modalMode === 'create'
                    ? '作成'
                    : modalMode === 'link_okr'
                      ? '紐付けを保存'
                      : 'ステータスを進める'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
