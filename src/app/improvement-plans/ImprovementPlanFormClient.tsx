// =============================================================================
// 改善計画 新規作成フォーム (IP-01)
// C/Dランクメンバーに対する改善計画をインラインフォームで作成する
// =============================================================================

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Rank, ReviewFrequency } from '@/types/evaluation';

// -----------------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------------

/** C/Dランク対象メンバー情報 */
interface CdMember {
  evaluationId: string;
  memberId: string;
  memberName: string;
  rank: string; // 'C' or 'D'
}

/** コンポーネントProps */
interface ImprovementPlanFormClientProps {
  managerId: string;
  cdMembers: CdMember[];
}

/** マイルストーン入力用 */
interface MilestoneInput {
  title: string;
  dueDate: string;
}

/** マイルストーンDB保存用 */
interface MilestonePayload {
  title: string;
  due_date: string;
  completed: boolean;
}

/** フォームバリデーションエラー */
interface FormErrors {
  member?: string;
  planDescription?: string;
  startDate?: string;
  milestones?: string;
}

const MAX_MILESTONES = 5;

const RANK_COLORS: Record<string, string> = {
  C: 'text-[#f59e0b] border-[#f59e0b]',
  D: 'text-[#ef4444] border-[#ef4444]',
};

// -----------------------------------------------------------------------------
// コンポーネント
// -----------------------------------------------------------------------------

export default function ImprovementPlanFormClient({
  managerId,
  cdMembers,
}: ImprovementPlanFormClientProps) {
  const router = useRouter();

  // フォーム表示状態
  const [isOpen, setIsOpen] = useState(false);

  // フォーム入力値
  const [selectedMemberIndex, setSelectedMemberIndex] = useState<number>(-1);
  const [planDescription, setPlanDescription] = useState('');
  const [reviewFrequency, setReviewFrequency] = useState<ReviewFrequency>('weekly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [milestones, setMilestones] = useState<MilestoneInput[]>([]);

  // 状態
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const selectedMember: CdMember | null =
    selectedMemberIndex >= 0 ? cdMembers[selectedMemberIndex] ?? null : null;

  // ---------------------------------------------------------------------------
  // マイルストーン操作
  // ---------------------------------------------------------------------------

  const addMilestone = useCallback(() => {
    if (milestones.length >= MAX_MILESTONES) return;
    setMilestones((prev) => [...prev, { title: '', dueDate: '' }]);
  }, [milestones.length]);

  const removeMilestone = useCallback((index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateMilestone = useCallback(
    (index: number, field: keyof MilestoneInput, value: string) => {
      setMilestones((prev) =>
        prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
      );
    },
    []
  );

  // ---------------------------------------------------------------------------
  // バリデーション
  // ---------------------------------------------------------------------------

  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {};

    if (selectedMemberIndex < 0) {
      errs.member = '対象メンバーを選択してください';
    }
    if (!planDescription.trim()) {
      errs.planDescription = '改善計画内容を入力してください';
    }
    if (!startDate) {
      errs.startDate = '開始日を入力してください';
    }

    const invalidMilestone = milestones.some((m) => !m.title.trim() || !m.dueDate);
    if (milestones.length > 0 && invalidMilestone) {
      errs.milestones = 'マイルストーンのタイトルと期日を全て入力してください';
    }

    return errs;
  }, [selectedMemberIndex, planDescription, startDate, milestones]);

  // ---------------------------------------------------------------------------
  // フォームリセット
  // ---------------------------------------------------------------------------

  const resetForm = useCallback(() => {
    setSelectedMemberIndex(-1);
    setPlanDescription('');
    setReviewFrequency('weekly');
    setStartDate('');
    setEndDate('');
    setMilestones([]);
    setErrors({});
    setSuccessMessage('');
  }, []);

  const handleCancel = useCallback(() => {
    resetForm();
    setIsOpen(false);
  }, [resetForm]);

  // ---------------------------------------------------------------------------
  // 保存処理
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    if (!selectedMember) return;

    setIsSaving(true);
    setSuccessMessage('');

    try {
      const supabase = createClient();

      const milestonePayload: MilestonePayload[] = milestones.map((m) => ({
        title: m.title.trim(),
        due_date: m.dueDate,
        completed: false,
      }));

      const { error } = await supabase.from('improvement_plans').insert({
        evaluation_id: selectedMember.evaluationId,
        member_id: selectedMember.memberId,
        manager_id: managerId,
        plan_description: planDescription.trim(),
        milestones: milestonePayload,
        review_frequency: reviewFrequency,
        start_date: startDate,
        end_date: endDate || null,
      });

      if (error) {
        setErrors({ planDescription: `保存に失敗しました: ${error.message}` });
        return;
      }

      setSuccessMessage('改善計画を作成しました');
      resetForm();
      router.refresh();

      // 成功メッセージを3秒後に非表示
      setTimeout(() => {
        setSuccessMessage('');
        setIsOpen(false);
      }, 2000);
    } finally {
      setIsSaving(false);
    }
  }, [
    validate,
    selectedMember,
    milestones,
    managerId,
    planDescription,
    reviewFrequency,
    startDate,
    endDate,
    resetForm,
    router,
  ]);

  // ---------------------------------------------------------------------------
  // 描画
  // ---------------------------------------------------------------------------

  // 対象メンバーがいない場合
  if (cdMembers.length === 0) {
    return (
      <button
        type="button"
        disabled
        className="px-4 py-2 border border-[#333333] text-xs text-[#737373] font-bold cursor-not-allowed"
      >
        対象メンバーなし
      </button>
    );
  }

  // フォーム閉じている場合: 新規作成ボタンのみ
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold hover:bg-[#3b82f6] hover:text-[#050505] transition-colors"
      >
        新規作成
      </button>
    );
  }

  return (
    <div className="border border-[#3b82f6] bg-[#0a0a0a]">
      {/* フォームヘッダー */}
      <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#e5e5e5] tracking-wider">
          改善計画 新規作成
        </h2>
        <button
          type="button"
          onClick={handleCancel}
          className="text-xs text-[#737373] hover:text-[#e5e5e5] transition-colors"
        >
          閉じる
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* 成功メッセージ */}
        {successMessage && (
          <div className="border border-[#22d3ee] bg-[#0a0a0a] px-3 py-2 text-sm text-[#22d3ee]">
            {successMessage}
          </div>
        )}

        {/* 対象メンバー */}
        <div>
          <label className="block text-[10px] text-[#737373] uppercase tracking-wider mb-1">
            対象メンバー
          </label>
          <select
            value={selectedMemberIndex}
            onChange={(e) => setSelectedMemberIndex(Number(e.target.value))}
            className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none"
          >
            <option value={-1}>-- 選択してください --</option>
            {cdMembers.map((m, i) => (
              <option key={m.evaluationId} value={i}>
                {m.memberName} ({m.rank}ランク)
              </option>
            ))}
          </select>
          {selectedMember && (
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`px-2 py-0.5 border text-[10px] font-bold ${
                  RANK_COLORS[selectedMember.rank] ?? 'text-[#737373] border-[#333333]'
                }`}
              >
                {selectedMember.rank}
              </span>
              <span className="text-xs text-[#737373]">{selectedMember.memberName}</span>
            </div>
          )}
          {errors.member && (
            <p className="text-xs text-[#ef4444] mt-1">{errors.member}</p>
          )}
        </div>

        {/* 改善計画内容 */}
        <div>
          <label className="block text-[10px] text-[#737373] uppercase tracking-wider mb-1">
            改善計画内容
          </label>
          <textarea
            value={planDescription}
            onChange={(e) => setPlanDescription(e.target.value)}
            rows={4}
            className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none resize-none"
            placeholder="改善すべき点と具体的な行動計画を記入してください"
          />
          {errors.planDescription && (
            <p className="text-xs text-[#ef4444] mt-1">{errors.planDescription}</p>
          )}
        </div>

        {/* レビュー頻度 */}
        <div>
          <label className="block text-[10px] text-[#737373] uppercase tracking-wider mb-1">
            レビュー頻度
          </label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reviewFrequency"
                value="weekly"
                checked={reviewFrequency === 'weekly'}
                onChange={() => setReviewFrequency('weekly')}
                className="accent-[#3b82f6]"
              />
              <span className="text-sm text-[#e5e5e5]">週次</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reviewFrequency"
                value="monthly"
                checked={reviewFrequency === 'monthly'}
                onChange={() => setReviewFrequency('monthly')}
                className="accent-[#3b82f6]"
              />
              <span className="text-sm text-[#e5e5e5]">月次</span>
            </label>
          </div>
        </div>

        {/* 開始日 / 終了日 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-[#737373] uppercase tracking-wider mb-1">
              開始日
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none"
            />
            {errors.startDate && (
              <p className="text-xs text-[#ef4444] mt-1">{errors.startDate}</p>
            )}
          </div>
          <div>
            <label className="block text-[10px] text-[#737373] uppercase tracking-wider mb-1">
              終了日 (任意)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none"
            />
          </div>
        </div>

        {/* マイルストーン */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] text-[#737373] uppercase tracking-wider">
              マイルストーン ({milestones.length}/{MAX_MILESTONES})
            </label>
            {milestones.length < MAX_MILESTONES && (
              <button
                type="button"
                onClick={addMilestone}
                className="text-xs text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
              >
                + 追加
              </button>
            )}
          </div>
          {milestones.length === 0 && (
            <p className="text-xs text-[#404040]">マイルストーンが追加されていません</p>
          )}
          <div className="space-y-2">
            {milestones.map((milestone, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row gap-2 border border-[#1a1a1a] bg-[#080808] p-2"
              >
                <input
                  type="text"
                  value={milestone.title}
                  onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                  placeholder="タイトル"
                  className="flex-1 bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-1.5 text-sm focus:border-[#3b82f6] focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={milestone.dueDate}
                    onChange={(e) => updateMilestone(index, 'dueDate', e.target.value)}
                    className="bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-1.5 text-sm focus:border-[#3b82f6] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeMilestone(index)}
                    className="px-2 py-1 text-xs text-[#ef4444] border border-[#333333] hover:border-[#ef4444] transition-colors shrink-0"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
          {errors.milestones && (
            <p className="text-xs text-[#ef4444] mt-1">{errors.milestones}</p>
          )}
        </div>

        {/* ボタン */}
        <div className="flex items-center gap-3 pt-2 border-t border-[#1a1a1a]">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 border border-[#3b82f6] bg-[#3b82f6] text-xs text-[#050505] font-bold hover:bg-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] font-bold hover:border-[#737373] disabled:opacity-50 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
