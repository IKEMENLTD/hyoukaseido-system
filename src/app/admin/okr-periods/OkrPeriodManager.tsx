// =============================================================================
// OKR期間管理クライアントコンポーネント
// ステータス遷移: planning → active → reviewing → closed
// =============================================================================

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { OkrPeriodStatus } from '@/types/okr';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

type Quarter = 1 | 2 | 3 | 4;

interface OkrPeriodRow {
  id: string;
  org_id: string;
  name: string;
  quarter: Quarter;
  fiscal_year: number;
  start_date: string;
  end_date: string;
  status: OkrPeriodStatus;
}

interface OkrPeriodManagerProps {
  initialPeriods: OkrPeriodRow[];
  orgId: string;
}

interface PeriodFormData {
  name: string;
  quarter: Quarter;
  fiscal_year: string;
  start_date: string;
  end_date: string;
}

type ModalMode = 'closed' | 'create' | 'confirm_advance';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const STATUS_FLOW: readonly OkrPeriodStatus[] = [
  'planning',
  'active',
  'reviewing',
  'closed',
] as const;

const STATUS_CONFIG: Record<OkrPeriodStatus, { label: string; color: string }> = {
  planning: { label: '計画中', color: 'text-[#f59e0b] border-[#f59e0b]' },
  active: { label: 'アクティブ', color: 'text-[#3b82f6] border-[#3b82f6]' },
  reviewing: { label: 'レビュー中', color: 'text-[#a855f7] border-[#a855f7]' },
  closed: { label: '完了', color: 'text-[#737373] border-[#737373]' },
};

const QUARTERS: readonly Quarter[] = [1, 2, 3, 4] as const;

const EMPTY_FORM: PeriodFormData = {
  name: '',
  quarter: 1,
  fiscal_year: '',
  start_date: '',
  end_date: '',
};

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function getNextStatus(current: OkrPeriodStatus): OkrPeriodStatus | null {
  const index = STATUS_FLOW.indexOf(current);
  if (index === -1 || index >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[index + 1];
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export default function OkrPeriodManager({
  initialPeriods,
  orgId,
}: OkrPeriodManagerProps) {
  const router = useRouter();
  const supabase = createClient();

  // --- State ---
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [formData, setFormData] = useState<PeriodFormData>(EMPTY_FORM);
  const [advanceTarget, setAdvanceTarget] = useState<OkrPeriodRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- 派生データ ---
  const activePeriod = useMemo(
    () => initialPeriods.find((p) => p.status === 'active') ?? null,
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
    clearMessages();
  }, [clearMessages]);

  const openCreateModal = useCallback(() => {
    setFormData(EMPTY_FORM);
    setModalMode('create');
    clearMessages();
  }, [clearMessages]);

  const openAdvanceConfirm = useCallback(
    (period: OkrPeriodRow) => {
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
      .from('okr_periods')
      .insert({
        org_id: orgId,
        name: formData.name.trim(),
        quarter: formData.quarter,
        fiscal_year: Number(formData.fiscal_year),
        start_date: formData.start_date,
        end_date: formData.end_date,
        status: 'planning' as OkrPeriodStatus,
      })
      .select()
      .single();

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(`OKR期間の作成に失敗しました: ${error.message}`);
      return;
    }

    setSuccessMessage('OKR期間を作成しました');
    closeModal();
    router.refresh();
  }, [supabase, orgId, formData, validateForm, closeModal, router]);

  /** ステータス進行 */
  const handleAdvanceStatus = useCallback(async () => {
    if (!advanceTarget) return;

    const nextStatus = getNextStatus(advanceTarget.status);
    if (!nextStatus) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from('okr_periods')
      .update({ status: nextStatus })
      .eq('id', advanceTarget.id);

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(`ステータスの更新に失敗しました: ${error.message}`);
      return;
    }

    setSuccessMessage(
      `ステータスを「${STATUS_CONFIG[nextStatus].label}」に進めました`
    );
    closeModal();
    router.refresh();
  }, [supabase, advanceTarget, closeModal, router]);

  // --- 描画 ---
  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              OKR期間管理
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              四半期サイクルの作成とステータス管理
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

        {/* アクティブ期間ハイライト */}
        {activePeriod && (
          <div className="border border-[#3b82f6] bg-[#3b82f6]/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-[#3b82f6] uppercase tracking-wider mb-1">
                  現在アクティブ
                </div>
                <div className="text-lg text-[#e5e5e5] font-bold">{activePeriod.name}</div>
                <div className="text-xs text-[#737373] mt-1">
                  {activePeriod.start_date} ~ {activePeriod.end_date}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#3b82f6]">Q{activePeriod.quarter}</div>
                <div className="text-xs text-[#737373]">{activePeriod.fiscal_year}年度</div>
              </div>
            </div>
          </div>
        )}

        {/* ステータスフロー */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
            ステータスフロー
          </div>
          <div className="flex items-center gap-2">
            {STATUS_FLOW.map((status, index) => {
              const config = STATUS_CONFIG[status];
              return (
                <div key={status} className="flex items-center gap-2">
                  <span className={`px-3 py-1 border text-xs font-bold ${config.color}`}>
                    {config.label}
                  </span>
                  {index < STATUS_FLOW.length - 1 && (
                    <span className="text-[#404040] text-xs">→</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 期間一覧 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              期間一覧
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#737373]">
                  <th className="px-4 py-2 text-left font-medium">名称</th>
                  <th className="px-4 py-2 text-center font-medium">四半期</th>
                  <th className="px-4 py-2 text-center font-medium">年度</th>
                  <th className="px-4 py-2 text-left font-medium">期間</th>
                  <th className="px-4 py-2 text-center font-medium">ステータス</th>
                  <th className="px-4 py-2 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {initialPeriods.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#737373] text-sm">
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
                        period.status === 'active' ? 'bg-[#3b82f6]/5' : ''
                      } ${period.status === 'closed' ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-3 text-[#e5e5e5] font-medium">{period.name}</td>
                      <td className="px-4 py-3 text-center text-[#a3a3a3]">Q{period.quarter}</td>
                      <td className="px-4 py-3 text-center text-[#a3a3a3]">{period.fiscal_year}</td>
                      <td className="px-4 py-3 text-[#737373] text-xs">
                        {period.start_date} ~ {period.end_date}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 border text-[10px] font-bold ${statusConfig.color}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {nextStatus && (
                            <button
                              type="button"
                              onClick={() => openAdvanceConfirm(period)}
                              className="px-2 py-1 border border-[#333333] text-[10px] text-[#a3a3a3] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors"
                            >
                              次ステータス
                            </button>
                          )}
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
            <div className="border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#e5e5e5] uppercase tracking-wider">
                {modalMode === 'create' && '新規OKR期間作成'}
                {modalMode === 'confirm_advance' && 'ステータス変更確認'}
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
            <div className="px-6 py-4 space-y-4">
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
                      placeholder="2026年度 Q1"
                    />
                  </div>

                  {/* 四半期 */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">四半期</label>
                    <select
                      value={formData.quarter}
                      onChange={(e) =>
                        updateFormField('quarter', Number(e.target.value) as Quarter)
                      }
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                    >
                      {QUARTERS.map((q) => (
                        <option key={q} value={q}>
                          Q{q}
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
                    以下のOKR期間のステータスを進めます。この操作は元に戻せません。
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
            </div>

            {/* モーダルフッター */}
            <div className="border-t border-[#1a1a1a] px-6 py-4 flex items-center justify-end gap-3">
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
                onClick={modalMode === 'create' ? handleCreate : handleAdvanceStatus}
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#3b82f6] border border-[#3b82f6] text-xs text-white font-bold hover:bg-[#2563eb] transition-colors disabled:opacity-50"
              >
                {isSubmitting
                  ? '処理中...'
                  : modalMode === 'create'
                    ? '作成'
                    : 'ステータスを進める'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
