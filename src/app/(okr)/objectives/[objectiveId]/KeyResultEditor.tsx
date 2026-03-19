'use client';

// =============================================================================
// KR編集コンポーネント
// インライン編集でtitle, targetValue, unitを更新
// =============================================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateKeyResult } from '@/lib/okr/actions';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface Checkin {
  date: string;
  value: number;
  confidence: number;
  note: string;
}

interface KeyResultEditorProps {
  keyResult: {
    id: string;
    title: string;
    targetValue: number;
    currentValue: number;
    unit: string;
    confidence: number;
    finalScore: number | null;
    checkins: Checkin[];
  };
  canEdit: boolean;
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function getProgressColor(ratio: number): string {
  if (ratio >= 0.7) return 'bg-[#3b82f6]';
  if (ratio >= 0.4) return 'bg-[#22d3ee]';
  return 'bg-[#ef4444]';
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 70) return 'text-[#22d3ee]';
  if (confidence >= 40) return 'text-[#f59e0b]';
  return 'text-[#ef4444]';
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export default function KeyResultEditor({ keyResult, canEdit }: KeyResultEditorProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(keyResult.title);
  const [targetValue, setTargetValue] = useState(String(keyResult.targetValue));
  const [unit, setUnit] = useState(keyResult.unit);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const kr = keyResult;
  const ratio = kr.targetValue === 0 ? 0 : Math.min(kr.currentValue / kr.targetValue, 1);
  const percent = Math.round(ratio * 100);

  const handleCancel = () => {
    setIsEditing(false);
    setTitle(kr.title);
    setTargetValue(String(kr.targetValue));
    setUnit(kr.unit);
    setMessage(null);
  };

  const handleSave = async () => {
    const parsedTarget = Number(targetValue);
    if (!Number.isFinite(parsedTarget) || parsedTarget < 0) {
      setMessage({ type: 'error', text: '目標値は0以上の数値で入力してください' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const result = await updateKeyResult(kr.id, {
      title: title,
      targetValue: parsedTarget,
      unit: unit,
    });

    setSaving(false);

    if (result.success) {
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Key Resultを更新しました' });
      router.refresh();
    } else {
      setMessage({ type: 'error', text: result.error ?? '更新に失敗しました' });
    }
  };

  return (
    <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
      {/* メッセージ */}
      {message && (
        <div className={`border-b px-4 py-2 text-xs ${
          message.type === 'success' ? 'border-[#22d3ee] text-[#22d3ee]' : 'border-[#ef4444] text-[#ef4444]'
        }`}>
          {message.text}
        </div>
      )}

      {/* KRヘッダー */}
      <div className="border-b border-[#1a1a1a] px-4 py-3">
        {isEditing ? (
          <div className="space-y-3">
            {/* タイトル編集 */}
            <div>
              <label className="text-xs text-[#737373] uppercase tracking-wider block mb-1">
                タイトル
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333333] text-[#e5e5e5] px-3 py-1.5 text-sm focus:border-[#3b82f6] outline-none"
              />
            </div>

            {/* 目標値・単位 */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-[#737373] uppercase tracking-wider block mb-1">
                  目標値
                </label>
                <input
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  min="0"
                  step="any"
                  className="w-full bg-[#0a0a0a] border border-[#333333] text-[#e5e5e5] px-3 py-1.5 text-sm focus:border-[#3b82f6] outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-[#737373] uppercase tracking-wider block mb-1">
                  単位
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#333333] text-[#e5e5e5] px-3 py-1.5 text-sm focus:border-[#3b82f6] outline-none"
                />
              </div>
            </div>

            {/* 保存・キャンセルボタン */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 bg-[#3b82f6] text-xs text-white font-bold hover:bg-[#2563eb] disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-1.5 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm text-[#e5e5e5] font-medium">
                  {kr.title}
                </h3>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => { setIsEditing(true); setMessage(null); }}
                    className="text-[#737373] hover:text-[#3b82f6] transition-colors"
                    title="Key Resultを編集"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                    >
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-[#a3a3a3]">
                  {kr.currentValue}/{kr.targetValue} {kr.unit}
                </span>
                <span className={`text-sm font-bold ${getConfidenceColor(kr.confidence)}`}>
                  自信度 {kr.confidence}%
                </span>
              </div>
            </div>
            <div className="mt-2 h-2 bg-[#1a1a1a]">
              <div
                className={`h-full ${getProgressColor(ratio)}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* チェックイン履歴 */}
      <div className="px-4 py-3">
        <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
          チェックイン履歴
        </div>
        {kr.checkins.length === 0 ? (
          <p className="text-xs text-[#737373]">チェックインなし</p>
        ) : (
          <div className="space-y-2">
            {kr.checkins.map((checkin) => (
              <div
                key={checkin.date}
                className="flex items-center gap-4 py-1 border-b border-[#111111] last:border-b-0"
              >
                <span className="text-xs text-[#737373] w-24 flex-shrink-0">
                  {checkin.date}
                </span>
                <span className="text-xs text-[#e5e5e5] font-medium w-16 flex-shrink-0">
                  {checkin.value} {kr.unit}
                </span>
                <span className={`text-xs w-12 flex-shrink-0 ${getConfidenceColor(checkin.confidence)}`}>
                  {checkin.confidence}%
                </span>
                <span className="text-xs text-[#a3a3a3] truncate">
                  {checkin.note}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
