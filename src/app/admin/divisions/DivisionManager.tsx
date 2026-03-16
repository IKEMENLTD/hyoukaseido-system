// =============================================================================
// 事業部管理クライアントコンポーネント
// CRUD操作: 追加・編集・フェーズ切替・削除
// =============================================================================

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Phase } from '@/types/evaluation';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface DivisionRow {
  id: string;
  org_id: string;
  name: string;
  phase: Phase;
  mission: string | null;
  created_at: string;
  memberCount: number;
  headName: string | null;
}

interface DivisionManagerProps {
  initialDivisions: DivisionRow[];
  orgId: string;
}

/** 事業部追加/編集フォームの入力値 */
interface DivisionFormData {
  name: string;
  phase: Phase;
  mission: string;
}

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const PHASE_CONFIG: Record<Phase, { label: string; color: string; weights: string }> = {
  profitable: {
    label: '黒字フェーズ',
    color: 'text-[#22d3ee] border-[#22d3ee]',
    weights: '定量50% / 定性30% / バリュー20%',
  },
  investing: {
    label: '赤字フェーズ',
    color: 'text-[#f59e0b] border-[#f59e0b]',
    weights: '定量30% / 定性45% / バリュー25%',
  },
};

const EMPTY_FORM: DivisionFormData = {
  name: '',
  phase: 'investing',
  mission: '',
};

type ModalMode = 'closed' | 'add' | 'edit' | 'phase_toggle' | 'delete';

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export default function DivisionManager({
  initialDivisions,
  orgId,
}: DivisionManagerProps) {
  const router = useRouter();
  const supabase = createClient();

  // --- State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [editingDivisionId, setEditingDivisionId] = useState<string | null>(null);
  const [targetDivision, setTargetDivision] = useState<DivisionRow | null>(null);
  const [formData, setFormData] = useState<DivisionFormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- 派生データ ---
  const filteredDivisions = useMemo(() => {
    if (!searchQuery.trim()) return initialDivisions;
    const q = searchQuery.trim().toLowerCase();
    return initialDivisions.filter((d) => d.name.toLowerCase().includes(q));
  }, [initialDivisions, searchQuery]);

  const profitableCount = useMemo(
    () => initialDivisions.filter((d) => d.phase === 'profitable').length,
    [initialDivisions]
  );
  const investingCount = useMemo(
    () => initialDivisions.filter((d) => d.phase === 'investing').length,
    [initialDivisions]
  );

  // --- ヘルパー ---
  const clearMessages = useCallback(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
  }, []);

  const closeModal = useCallback(() => {
    setModalMode('closed');
    setEditingDivisionId(null);
    setTargetDivision(null);
    setFormData(EMPTY_FORM);
    clearMessages();
  }, [clearMessages]);

  const openAddModal = useCallback(() => {
    setFormData(EMPTY_FORM);
    setModalMode('add');
    clearMessages();
  }, [clearMessages]);

  const openEditModal = useCallback(
    (division: DivisionRow) => {
      setEditingDivisionId(division.id);
      setFormData({
        name: division.name,
        phase: division.phase,
        mission: division.mission ?? '',
      });
      setModalMode('edit');
      clearMessages();
    },
    [clearMessages]
  );

  const openPhaseToggleModal = useCallback(
    (division: DivisionRow) => {
      setTargetDivision(division);
      setModalMode('phase_toggle');
      clearMessages();
    },
    [clearMessages]
  );

  const openDeleteModal = useCallback(
    (division: DivisionRow) => {
      setTargetDivision(division);
      setModalMode('delete');
      clearMessages();
    },
    [clearMessages]
  );

  // --- フォーム更新 ---
  const updateFormField = useCallback(
    <K extends keyof DivisionFormData>(field: K, value: DivisionFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // --- バリデーション ---
  const validateForm = useCallback((): string | null => {
    if (!formData.name.trim()) return '事業部名を入力してください';
    if (formData.name.trim().length > 100) return '事業部名は100文字以内で入力してください';
    return null;
  }, [formData]);

  // --- CRUD操作 ---

  /** 事業部追加 */
  const handleAddDivision = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from('divisions')
      .insert({
        org_id: orgId,
        name: formData.name.trim(),
        phase: formData.phase,
        mission: formData.mission.trim() || null,
      })
      .select()
      .single();

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(`事業部の追加に失敗しました: ${error.message}`);
      return;
    }

    setSuccessMessage('事業部を追加しました');
    closeModal();
    router.refresh();
  }, [supabase, orgId, formData, validateForm, closeModal, router]);

  /** 事業部編集 */
  const handleEditDivision = useCallback(async () => {
    if (!editingDivisionId) return;

    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from('divisions')
      .update({
        name: formData.name.trim(),
        mission: formData.mission.trim() || null,
      })
      .eq('id', editingDivisionId);

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(`事業部の更新に失敗しました: ${error.message}`);
      return;
    }

    setSuccessMessage('事業部情報を更新しました');
    closeModal();
    router.refresh();
  }, [supabase, editingDivisionId, formData, validateForm, closeModal, router]);

  /** フェーズ切替 */
  const handlePhaseToggle = useCallback(async () => {
    if (!targetDivision) return;

    const newPhase: Phase = targetDivision.phase === 'profitable' ? 'investing' : 'profitable';

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from('divisions')
      .update({ phase: newPhase })
      .eq('id', targetDivision.id);

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(`フェーズの切替に失敗しました: ${error.message}`);
      return;
    }

    const newLabel = PHASE_CONFIG[newPhase].label;
    setSuccessMessage(`${targetDivision.name} を ${newLabel} に切り替えました`);
    closeModal();
    router.refresh();
  }, [supabase, targetDivision, closeModal, router]);

  /** 事業部削除 */
  const handleDeleteDivision = useCallback(async () => {
    if (!targetDivision) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from('divisions')
      .delete()
      .eq('id', targetDivision.id);

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(`事業部の削除に失敗しました: ${error.message}`);
      return;
    }

    setSuccessMessage(`${targetDivision.name} を削除しました`);
    closeModal();
    router.refresh();
  }, [supabase, targetDivision, closeModal, router]);

  /** フォーム送信 */
  const handleSubmit = useCallback(() => {
    if (modalMode === 'add') return handleAddDivision();
    if (modalMode === 'edit') return handleEditDivision();
    if (modalMode === 'phase_toggle') return handlePhaseToggle();
    if (modalMode === 'delete') return handleDeleteDivision();
  }, [modalMode, handleAddDivision, handleEditDivision, handlePhaseToggle, handleDeleteDivision]);

  // --- 描画 ---
  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              事業部管理
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              事業部の追加、編集、フェーズ切り替え
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 border border-[#3b82f6] bg-[#3b82f6] text-xs text-white font-bold hover:bg-[#2563eb] transition-colors"
          >
            事業部追加
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

        {/* フェーズ説明 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
            フェーズ別評価ウェイト
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            {(Object.entries(PHASE_CONFIG) as Array<[Phase, typeof PHASE_CONFIG[Phase]]>).map(([phase, config]) => (
              <div key={phase} className="flex items-center gap-2">
                <span className={`px-2 py-0.5 border text-xs font-bold ${config.color}`}>
                  {config.label}
                </span>
                <span className="text-[#737373]">{config.weights}</span>
              </div>
            ))}
          </div>
        </div>

        {/* サマリー */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">合計</div>
            <div className="text-2xl font-bold text-[#e5e5e5]">{initialDivisions.length}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">黒字フェーズ</div>
            <div className="text-2xl font-bold text-[#22d3ee]">{profitableCount}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">赤字フェーズ</div>
            <div className="text-2xl font-bold text-[#f59e0b]">{investingCount}</div>
          </div>
        </div>

        {/* 検索 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              事業部一覧
            </h3>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="事業部名で検索..."
              className="bg-[#111111] border border-[#333333] text-sm px-3 py-1 text-[#e5e5e5] placeholder:text-[#404040] outline-none w-48 focus:border-[#3b82f6]"
            />
          </div>
        </div>

        {/* 事業部カード */}
        {filteredDivisions.length === 0 && (
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-8 text-center text-[#737373] text-sm">
            {searchQuery.trim() ? '該当する事業部が見つかりません' : 'データがありません'}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredDivisions.map((division) => {
            const phaseConfig = PHASE_CONFIG[division.phase];
            return (
              <div key={division.id} className="border border-[#1a1a1a] bg-[#0a0a0a]">
                <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#e5e5e5]">{division.name}</h3>
                  <span className={`px-2 py-0.5 border text-[10px] font-bold ${phaseConfig.color}`}>
                    {phaseConfig.label}
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  {division.mission && (
                    <div>
                      <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">ミッション</div>
                      <p className="text-xs text-[#a3a3a3]">{division.mission}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">メンバー数</div>
                      <div className="text-sm text-[#e5e5e5] font-bold">{division.memberCount}名</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">事業部長</div>
                      <div className="text-sm text-[#e5e5e5]">{division.headName ?? '未設定'}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">ウェイト</div>
                    <div className="text-xs text-[#a3a3a3]">{phaseConfig.weights}</div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-[#1a1a1a]">
                    <button
                      type="button"
                      onClick={() => openEditModal(division)}
                      className="px-3 py-1 border border-[#333333] text-[10px] text-[#a3a3a3] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => openPhaseToggleModal(division)}
                      className="px-3 py-1 border border-[#333333] text-[10px] text-[#a3a3a3] hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors"
                    >
                      フェーズ切替
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(division)}
                      disabled={division.memberCount > 0}
                      className="px-3 py-1 border border-[#333333] text-[10px] text-[#a3a3a3] hover:border-red-700 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[#333333] disabled:hover:text-[#a3a3a3]"
                      title={division.memberCount > 0 ? 'メンバーが配属されている事業部は削除できません' : ''}
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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
                {modalMode === 'add' && '事業部追加'}
                {modalMode === 'edit' && '事業部編集'}
                {modalMode === 'phase_toggle' && 'フェーズ切替'}
                {modalMode === 'delete' && '事業部削除'}
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

              {/* 追加 / 編集フォーム */}
              {(modalMode === 'add' || modalMode === 'edit') && (
                <>
                  {/* 事業部名 */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">事業部名</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateFormField('name', e.target.value)}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                      placeholder="システム開発事業部"
                    />
                  </div>

                  {/* フェーズ (追加時のみ) */}
                  {modalMode === 'add' && (
                    <div>
                      <label className="block text-xs text-[#737373] mb-1">フェーズ</label>
                      <select
                        value={formData.phase}
                        onChange={(e) => updateFormField('phase', e.target.value as Phase)}
                        className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                      >
                        <option value="profitable">黒字フェーズ</option>
                        <option value="investing">赤字フェーズ</option>
                      </select>
                      <div className="mt-2 text-xs text-[#737373]">
                        {PHASE_CONFIG[formData.phase].weights}
                      </div>
                    </div>
                  )}

                  {/* ミッション */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">ミッション</label>
                    <textarea
                      value={formData.mission}
                      onChange={(e) => updateFormField('mission', e.target.value)}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6] resize-none"
                      placeholder="プロダクト品質の向上"
                      rows={3}
                    />
                  </div>
                </>
              )}

              {/* フェーズ切替確認 */}
              {modalMode === 'phase_toggle' && targetDivision && (
                <div className="space-y-4">
                  <p className="text-sm text-[#a3a3a3]">
                    <span className="text-[#e5e5e5] font-bold">{targetDivision.name}</span> のフェーズを切り替えます。
                  </p>

                  {/* 現在のフェーズ */}
                  <div className="border border-[#1a1a1a] p-3">
                    <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-2">現在</div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 border text-xs font-bold ${PHASE_CONFIG[targetDivision.phase].color}`}>
                        {PHASE_CONFIG[targetDivision.phase].label}
                      </span>
                      <span className="text-xs text-[#737373]">
                        {PHASE_CONFIG[targetDivision.phase].weights}
                      </span>
                    </div>
                  </div>

                  {/* 変更後のフェーズ */}
                  {(() => {
                    const newPhase: Phase = targetDivision.phase === 'profitable' ? 'investing' : 'profitable';
                    const newConfig = PHASE_CONFIG[newPhase];
                    return (
                      <div className="border border-[#3b82f6]/30 bg-[#3b82f6]/5 p-3">
                        <div className="text-[10px] text-[#3b82f6] uppercase tracking-wider mb-2">変更後</div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 border text-xs font-bold ${newConfig.color}`}>
                            {newConfig.label}
                          </span>
                          <span className="text-xs text-[#737373]">
                            {newConfig.weights}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <p className="text-xs text-[#737373]">
                    フェーズを切り替えると、今後作成される評価の配分ウェイトが変更されます。既存の評価には影響しません。
                  </p>
                </div>
              )}

              {/* 削除確認 */}
              {modalMode === 'delete' && targetDivision && (
                <div className="space-y-4">
                  <p className="text-sm text-[#a3a3a3]">
                    <span className="text-red-400 font-bold">{targetDivision.name}</span> を削除しますか？
                  </p>
                  <p className="text-xs text-[#737373]">
                    この操作は取り消せません。関連するKPIテンプレートや評価データも影響を受ける可能性があります。
                  </p>
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
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`px-4 py-2 border text-xs font-bold transition-colors disabled:opacity-50 ${
                  modalMode === 'delete'
                    ? 'bg-red-900 border-red-900 text-red-100 hover:bg-red-800'
                    : 'bg-[#3b82f6] border-[#3b82f6] text-white hover:bg-[#2563eb]'
                }`}
              >
                {isSubmitting
                  ? '処理中...'
                  : modalMode === 'add'
                    ? '追加'
                    : modalMode === 'edit'
                      ? '更新'
                      : modalMode === 'phase_toggle'
                        ? '切替'
                        : '削除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
