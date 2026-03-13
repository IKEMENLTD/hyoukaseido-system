// =============================================================================
// 新規1on1記録 - クライアントコンポーネント
// フォーム操作 + OKR進捗取得 + Supabaseへの送信
// =============================================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { MeetingType } from '@/types/evaluation';

// -----------------------------------------------------------------------------
// 定数
// -----------------------------------------------------------------------------

const MEETING_TYPE_OPTIONS: ReadonlyArray<{
  value: MeetingType;
  label: string;
  description: string;
}> = [
  {
    value: 'weekly_checkin',
    label: '週次チェックイン',
    description: '15-30分の短い進捗確認',
  },
  {
    value: 'monthly_1on1',
    label: '月次1on1',
    description: '30-60分のキャリア/成長面談',
  },
  {
    value: 'quarterly_review',
    label: '四半期レビュー',
    description: 'OKR/KPIの振り返りと次期計画',
  },
  {
    value: 'semi_annual_feedback',
    label: '半期フィードバック',
    description: '評価結果のフィードバック面談',
  },
];

// -----------------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------------

interface OneOnOneNewClientProps {
  managerId: string;
  teamMembers: Array<{ id: string; name: string }>;
}

interface OkrKeyResultData {
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  confidence: number;
}

interface OkrObjectiveData {
  objectiveTitle: string;
  keyResults: OkrKeyResultData[];
}

interface RawKeyResult {
  title: string;
  current_value: number;
  target_value: number | null;
  unit: string | null;
  confidence: number;
}

interface RawObjective {
  title: string;
  okr_key_results: RawKeyResult[];
}

interface FormMessage {
  type: 'success' | 'error';
  text: string;
}

// -----------------------------------------------------------------------------
// コンポーネント
// -----------------------------------------------------------------------------

export default function OneOnOneNewClient({
  managerId,
  teamMembers,
}: OneOnOneNewClientProps) {
  const router = useRouter();

  // フォーム状態
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [meetingType, setMeetingType] = useState<MeetingType | ''>('');
  const [okrProgressText, setOkrProgressText] = useState('');
  const [blockers, setBlockers] = useState('');
  const [actionItems, setActionItems] = useState('');
  const [notes, setNotes] = useState('');

  // UI状態
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<FormMessage | null>(null);
  const [okrData, setOkrData] = useState<OkrObjectiveData[]>([]);
  const [okrLoading, setOkrLoading] = useState(false);

  // メンバー選択時にOKR進捗を取得
  useEffect(() => {
    if (!selectedMemberId) {
      setOkrData([]);
      return;
    }

    let cancelled = false;

    const fetchOkr = async () => {
      setOkrLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('okr_objectives')
        .select(
          'title, okr_key_results (title, current_value, target_value, unit, confidence)',
        )
        .eq('member_id', selectedMemberId)
        .eq('status', 'active');

      if (cancelled) return;

      const rows = data as RawObjective[] | null;
      const mapped: OkrObjectiveData[] = (rows ?? []).map((obj) => ({
        objectiveTitle: obj.title,
        keyResults: (obj.okr_key_results ?? []).map((kr) => ({
          title: kr.title,
          currentValue: kr.current_value,
          targetValue: kr.target_value ?? 0,
          unit: kr.unit ?? '',
          confidence: kr.confidence,
        })),
      }));

      setOkrData(mapped);
      setOkrLoading(false);
    };

    fetchOkr();

    return () => {
      cancelled = true;
    };
  }, [selectedMemberId]);

  // 送信処理
  const handleSubmit = useCallback(async () => {
    if (!selectedMemberId || !meetingType) return;

    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.from('one_on_ones').insert({
      member_id: selectedMemberId,
      manager_id: managerId,
      meeting_date: meetingDate,
      meeting_type: meetingType,
      okr_progress: okrProgressText || null,
      blockers: blockers || null,
      action_items: actionItems || null,
      notes: notes || null,
    });

    setSaving(false);

    if (error) {
      setMessage({
        type: 'error',
        text: `保存に失敗しました: ${error.message}`,
      });
    } else {
      setMessage({ type: 'success', text: '1on1記録を保存しました' });
      // 2秒後に履歴ページへ遷移
      setTimeout(() => {
        router.push('/one-on-one/history');
      }, 2000);
    }
  }, [
    selectedMemberId,
    managerId,
    meetingDate,
    meetingType,
    okrProgressText,
    blockers,
    actionItems,
    notes,
    router,
  ]);

  const isFormValid = selectedMemberId !== '' && meetingType !== '';

  // チームメンバーが0人の場合
  if (teamMembers.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">
            面談対象メンバーがいません
          </h2>
          <p className="text-sm text-[#737373] mb-4">
            同じ部門に所属するメンバーが見つかりませんでした。
          </p>
          <a
            href="/one-on-one/history"
            className="inline-block px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
          >
            履歴へ戻る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            新規1on1記録
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            1on1面談の内容を記録します
          </p>
        </div>

        {/* メッセージ */}
        {message && (
          <div
            className={`border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-[#22c55e]/30 bg-[#22c55e]/5 text-[#22c55e]'
                : 'border-[#ef4444]/30 bg-[#ef4444]/5 text-[#ef4444]'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* フォーム */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              面談情報
            </h3>
          </div>
          <div className="p-4 space-y-5">
            {/* 面談対象メンバー */}
            <div>
              <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
                面談対象メンバー
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="bg-[#111111] border border-[#333333] text-[#e5e5e5] text-sm px-3 py-2 focus:border-[#3b82f6] outline-none min-w-[240px]"
              >
                <option value="">選択してください</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 日付 */}
            <div>
              <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
                面談日
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="bg-[#111111] border border-[#333333] text-[#e5e5e5] text-sm px-3 py-2 focus:border-[#3b82f6] outline-none"
              />
            </div>

            {/* ミーティング種別 */}
            <div>
              <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
                ミーティング種別
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MEETING_TYPE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 border p-3 transition-colors cursor-pointer ${
                      meetingType === option.value
                        ? 'border-[#3b82f6] bg-[#3b82f6]/5'
                        : 'border-[#1a1a1a] hover:border-[#333333]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="meetingType"
                      value={option.value}
                      checked={meetingType === option.value}
                      onChange={(e) =>
                        setMeetingType(e.target.value as MeetingType)
                      }
                      className="mt-1 accent-[#3b82f6]"
                    />
                    <div>
                      <div className="text-sm text-[#e5e5e5]">
                        {option.label}
                      </div>
                      <div className="text-[10px] text-[#404040]">
                        {option.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* OKR進捗 */}
            <div>
              <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
                OKR進捗
              </label>

              {/* OKRデータ表示 */}
              {okrLoading && (
                <div className="text-xs text-[#404040] py-2">
                  OKRデータを読み込み中...
                </div>
              )}

              {!okrLoading && selectedMemberId && okrData.length === 0 && (
                <div className="text-xs text-[#404040] border border-[#1a1a1a] p-3 mb-2">
                  このメンバーにはアクティブなOKRがありません
                </div>
              )}

              {!okrLoading && okrData.length > 0 && (
                <div className="space-y-3 mb-2">
                  {okrData.map((objective) => (
                    <div
                      key={objective.objectiveTitle}
                      className="border border-[#1a1a1a] p-3"
                    >
                      <div className="text-sm text-[#e5e5e5] font-bold mb-2">
                        {objective.objectiveTitle}
                      </div>
                      <div className="space-y-2">
                        {objective.keyResults.map((kr) => {
                          const progress =
                            kr.targetValue > 0
                              ? Math.min(
                                  (kr.currentValue / kr.targetValue) * 100,
                                  100,
                                )
                              : 0;
                          return (
                            <div
                              key={kr.title}
                              className="flex items-center gap-3"
                            >
                              <div className="flex-1">
                                <div className="text-xs text-[#a3a3a3] mb-1">
                                  {kr.title}:{' '}
                                  {kr.currentValue.toLocaleString()} /{' '}
                                  {kr.targetValue.toLocaleString()} {kr.unit}
                                </div>
                                <div className="h-1.5 bg-[#1a1a1a] w-full">
                                  <div
                                    className="h-full bg-[#3b82f6]"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                              <div className="text-[10px] text-[#404040] w-16 text-right">
                                自信度 {kr.confidence}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                rows={3}
                value={okrProgressText}
                onChange={(e) => setOkrProgressText(e.target.value)}
                placeholder="OKR進捗について補足があれば記入"
                className="w-full mt-2 bg-[#111111] border border-[#333333] text-[#e5e5e5] text-sm px-3 py-2 focus:border-[#3b82f6] outline-none resize-none placeholder:text-[#404040]"
              />
            </div>

            {/* ブロッカー */}
            <div>
              <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
                ブロッカー / 課題
              </label>
              <textarea
                rows={3}
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                placeholder="現在の障害や課題を記入"
                className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] text-sm px-3 py-2 focus:border-[#3b82f6] outline-none resize-none placeholder:text-[#404040]"
              />
            </div>

            {/* アクションアイテム */}
            <div>
              <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
                アクションアイテム
              </label>
              <textarea
                rows={3}
                value={actionItems}
                onChange={(e) => setActionItems(e.target.value)}
                placeholder="次回までに実行するアクションを記入"
                className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] text-sm px-3 py-2 focus:border-[#3b82f6] outline-none resize-none placeholder:text-[#404040]"
              />
            </div>

            {/* メモ */}
            <div>
              <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
                その他メモ
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="面談中のメモ、感想など"
                className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] text-sm px-3 py-2 focus:border-[#3b82f6] outline-none resize-none placeholder:text-[#404040]"
              />
            </div>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="flex items-center justify-between">
          <a
            href="/one-on-one/history"
            className="px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
          >
            履歴へ戻る
          </a>
          <button
            type="button"
            disabled={!isFormValid || saving}
            onClick={handleSubmit}
            className={`px-6 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
              isFormValid && !saving
                ? 'bg-[#3b82f6] text-[#e5e5e5] hover:bg-[#2563eb] cursor-pointer'
                : 'bg-[#333333] text-[#737373] cursor-not-allowed'
            }`}
          >
            {saving ? '保存中...' : '記録を保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
