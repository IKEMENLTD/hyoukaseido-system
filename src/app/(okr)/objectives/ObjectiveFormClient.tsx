// =============================================================================
// OKR新規作成フォーム (クライアントコンポーネント)
// Objective + Key Results をインラインフォームで作成
// =============================================================================

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
type OkrLevel = 'company' | 'division' | 'individual';

interface KeyResultInput {
  title: string;
  targetValue: number | '';
  unit: string;
  confidence: number;
}

interface FormMessage {
  type: 'success' | 'error';
  text: string;
}

interface ObjectiveFormClientProps {
  memberId: string;
  memberGrade: string; // 'G1'~'G5'
  okrPeriodId: string;
  divisions: Array<{ id: string; name: string }>;
}

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------
const MAX_KEY_RESULTS = 5;

const LEVEL_OPTIONS: Array<{ value: OkrLevel; label: string }> = [
  { value: 'company', label: '全社' },
  { value: 'division', label: '事業部' },
  { value: 'individual', label: '個人' },
];

const INPUT_CLASS =
  'w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none';

const BTN_PRIMARY =
  'px-4 py-2 bg-[#3b82f6] text-[#050505] text-xs font-bold uppercase tracking-wider hover:bg-[#2563eb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const BTN_SECONDARY =
  'px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors';

// ---------------------------------------------------------------------------
// ヘルパー: 空のKR入力を生成
// ---------------------------------------------------------------------------
function createEmptyKR(): KeyResultInput {
  return { title: '', targetValue: '', unit: '', confidence: 50 };
}

// ---------------------------------------------------------------------------
// グレードが指定レベル以上か判定
// ---------------------------------------------------------------------------
function isGradeAtLeast(grade: string, minGrade: string): boolean {
  const order = ['G1', 'G2', 'G3', 'G4', 'G5'];
  return order.indexOf(grade) >= order.indexOf(minGrade);
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------
export default function ObjectiveFormClient({
  memberId,
  memberGrade,
  okrPeriodId,
  divisions,
}: ObjectiveFormClientProps) {
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<FormMessage | null>(null);

  const [objectiveTitle, setObjectiveTitle] = useState('');
  const [level, setLevel] = useState<OkrLevel>('individual');
  const [selectedDivisionId, setSelectedDivisionId] = useState('');
  const [keyResults, setKeyResults] = useState<KeyResultInput[]>([createEmptyKR()]);

  // -----------------------------------------------------------------------
  // フォームリセット
  // -----------------------------------------------------------------------
  function resetForm() {
    setObjectiveTitle('');
    setLevel('individual');
    setSelectedDivisionId('');
    setKeyResults([createEmptyKR()]);
    setMessage(null);
  }

  // -----------------------------------------------------------------------
  // KR操作
  // -----------------------------------------------------------------------
  function addKeyResult() {
    if (keyResults.length >= MAX_KEY_RESULTS) return;
    setKeyResults([...keyResults, createEmptyKR()]);
  }

  function removeKeyResult(index: number) {
    if (keyResults.length <= 1) return;
    setKeyResults(keyResults.filter((_, i) => i !== index));
  }

  function updateKeyResult(index: number, field: keyof KeyResultInput, value: string | number) {
    setKeyResults(
      keyResults.map((kr, i) => (i === index ? { ...kr, [field]: value } : kr))
    );
  }

  // -----------------------------------------------------------------------
  // レベル選択の可否判定
  // -----------------------------------------------------------------------
  function isLevelDisabled(lvl: OkrLevel): boolean {
    if (lvl === 'company') return !isGradeAtLeast(memberGrade, 'G4');
    if (lvl === 'division') return !isGradeAtLeast(memberGrade, 'G3');
    return false;
  }

  // -----------------------------------------------------------------------
  // バリデーション
  // -----------------------------------------------------------------------
  function validate(): string | null {
    if (!objectiveTitle.trim()) return 'Objectiveのタイトルを入力してください';
    if (level === 'division' && !selectedDivisionId) return '事業部を選択してください';

    for (let i = 0; i < keyResults.length; i++) {
      const kr = keyResults[i];
      if (!kr.title.trim()) return `KR${i + 1}のタイトルを入力してください`;
      if (kr.targetValue === '' || Number.isNaN(Number(kr.targetValue))) {
        return `KR${i + 1}の目標値を入力してください`;
      }
      if (kr.confidence < 0 || kr.confidence > 100) {
        return `KR${i + 1}の確信度は0~100で入力してください`;
      }
    }

    return null;
  }

  // -----------------------------------------------------------------------
  // 保存処理
  // -----------------------------------------------------------------------
  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const supabase = createClient();

      // 1. Objective を insert
      const { data: newObj, error: objError } = await supabase
        .from('okr_objectives')
        .insert({
          okr_period_id: okrPeriodId,
          member_id: level === 'individual' ? memberId : null,
          division_id: level === 'division' ? selectedDivisionId : null,
          level,
          title: objectiveTitle.trim(),
        })
        .select('id')
        .single();

      if (objError || !newObj) {
        setMessage({ type: 'error', text: objError?.message ?? 'Objectiveの作成に失敗しました' });
        return;
      }

      // 2. Key Results を insert
      const krInserts = keyResults.map((kr, i) => ({
        objective_id: (newObj as { id: string }).id,
        title: kr.title.trim(),
        target_value: Number(kr.targetValue),
        unit: kr.unit.trim(),
        confidence: kr.confidence,
        sort_order: i,
      }));

      const { error: krError } = await supabase
        .from('okr_key_results')
        .insert(krInserts);

      if (krError) {
        setMessage({ type: 'error', text: krError.message });
        return;
      }

      setMessage({ type: 'success', text: 'OKRを作成しました' });
      resetForm();
      setFormOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '予期しないエラーが発生しました';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setSaving(false);
    }
  }

  // -----------------------------------------------------------------------
  // キャンセル
  // -----------------------------------------------------------------------
  function handleCancel() {
    resetForm();
    setFormOpen(false);
  }

  // -----------------------------------------------------------------------
  // レンダリング
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* トグルボタン */}
      {!formOpen && (
        <button
          type="button"
          className={BTN_PRIMARY}
          onClick={() => setFormOpen(true)}
        >
          OKRを作成
        </button>
      )}

      {/* メッセージ */}
      {message && (
        <div
          className={`border px-4 py-3 text-sm ${
            message.type === 'error'
              ? 'border-red-500/50 bg-red-500/10 text-red-400'
              : 'border-[#3b82f6]/50 bg-[#3b82f6]/10 text-[#3b82f6]'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* フォーム本体 */}
      {formOpen && (
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6 space-y-6">
          <h3 className="text-sm font-bold text-[#e5e5e5] uppercase tracking-wider">
            新規OKR作成
          </h3>

          {/* Level選択 */}
          <div className="space-y-2">
            <label className="block text-xs text-[#a3a3a3] uppercase tracking-wider">
              レベル
            </label>
            <div className="flex gap-4">
              {LEVEL_OPTIONS.map((opt) => {
                const disabled = isLevelDisabled(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 text-sm ${
                      disabled ? 'text-[#555555] cursor-not-allowed' : 'text-[#e5e5e5] cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="okr-level"
                      value={opt.value}
                      checked={level === opt.value}
                      disabled={disabled}
                      onChange={() => setLevel(opt.value)}
                      className="accent-[#3b82f6]"
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* 事業部ドロップダウン (division時のみ) */}
          {level === 'division' && (
            <div className="space-y-2">
              <label className="block text-xs text-[#a3a3a3] uppercase tracking-wider">
                事業部
              </label>
              <select
                value={selectedDivisionId}
                onChange={(e) => setSelectedDivisionId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">-- 選択してください --</option>
                {divisions.map((div) => (
                  <option key={div.id} value={div.id}>
                    {div.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Objectiveタイトル */}
          <div className="space-y-2">
            <label className="block text-xs text-[#a3a3a3] uppercase tracking-wider">
              Objective
            </label>
            <textarea
              value={objectiveTitle}
              onChange={(e) => setObjectiveTitle(e.target.value)}
              placeholder="目標を入力..."
              rows={3}
              className={INPUT_CLASS}
            />
          </div>

          {/* Key Results */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs text-[#a3a3a3] uppercase tracking-wider">
                Key Results
              </label>
              {keyResults.length < MAX_KEY_RESULTS && (
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  onClick={addKeyResult}
                >
                  KR追加
                </button>
              )}
            </div>

            {keyResults.map((kr, index) => (
              <div
                key={index}
                className="border border-[#1a1a1a] bg-[#050505] p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#737373] font-bold uppercase tracking-wider">
                    KR{index + 1}
                  </span>
                  {keyResults.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      onClick={() => removeKeyResult(index)}
                    >
                      削除
                    </button>
                  )}
                </div>

                {/* KRタイトル */}
                <input
                  type="text"
                  value={kr.title}
                  onChange={(e) => updateKeyResult(index, 'title', e.target.value)}
                  placeholder="Key Resultのタイトル"
                  className={INPUT_CLASS}
                />

                {/* 目標値 / 単位 / 確信度 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <span className="text-xs text-[#737373]">目標値</span>
                    <input
                      type="number"
                      value={kr.targetValue}
                      onChange={(e) =>
                        updateKeyResult(
                          index,
                          'targetValue',
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                      placeholder="100"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-[#737373]">単位</span>
                    <input
                      type="text"
                      value={kr.unit}
                      onChange={(e) => updateKeyResult(index, 'unit', e.target.value)}
                      placeholder="件, %, 社, 円"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-[#737373]">確信度 (0-100)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={kr.confidence}
                      onChange={(e) =>
                        updateKeyResult(index, 'confidence', Number(e.target.value))
                      }
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* アクションボタン */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              type="button"
              className={BTN_SECONDARY}
              onClick={handleCancel}
              disabled={saving}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
