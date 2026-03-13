// =============================================================================
// 週次チェックイン - クライアントコンポーネント
// フォーム表示 + Supabaseへのチェックイン送信
// =============================================================================

'use client';

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import CheckinForm from '@/components/okr/CheckinForm';

interface KeyResultForCheckin {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
}

interface CheckinEntry {
  keyResultId: string;
  value: number;
  confidence: number;
  note: string;
  blockers: string;
}

interface CheckinPageClientProps {
  keyResults: KeyResultForCheckin[];
  memberId: string;
}

interface StatusMessage {
  type: 'success' | 'error';
  text: string;
}

export default function CheckinPageClient({
  keyResults,
  memberId,
}: CheckinPageClientProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  const handleSubmit = useCallback(
    async (data: CheckinEntry[]) => {
      setSaving(true);
      setMessage(null);

      const supabase = createClient();
      const today = new Date().toISOString().split('T')[0];

      const inserts = data.map((entry) => ({
        key_result_id: entry.keyResultId,
        member_id: memberId,
        checkin_date: today,
        value: entry.value,
        confidence: entry.confidence,
        note: entry.note,
        blockers: entry.blockers,
      }));

      const { error } = await supabase.from('okr_checkins').insert(inserts);

      if (error) {
        setMessage({ type: 'error', text: error.message });
        setSaving(false);
        return;
      }

      // key_resultsのcurrent_valueとconfidenceも更新
      for (const entry of data) {
        const { error: updateError } = await supabase
          .from('okr_key_results')
          .update({ current_value: entry.value, confidence: entry.confidence })
          .eq('id', entry.keyResultId);

        if (updateError) {
          setMessage({
            type: 'error',
            text: `KR更新エラー: ${updateError.message}`,
          });
          setSaving(false);
          return;
        }
      }

      setMessage({ type: 'success', text: 'チェックインを送信しました' });
      setSaving(false);
    },
    [memberId]
  );

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              週次チェックイン
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              各Key Resultの進捗と自信度を更新してください
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 border border-[#333333] text-xs text-[#a3a3a3]">
              {today}
            </span>
          </div>
        </div>

        {/* チェックインガイド */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
          <div className="text-xs text-[#737373] space-y-1">
            <p>1. 各KRの現在の進捗値を入力してください</p>
            <p>2. 達成できる自信度 (0-100%) を更新してください</p>
            <p>3. コメントで進捗の背景を共有してください</p>
            <p>4. ブロッカーがあれば記載してください</p>
          </div>
        </div>

        {/* ステータスメッセージ */}
        {message && (
          <div
            className={`border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-[#22d3ee]/30 bg-[#22d3ee]/5 text-[#22d3ee]'
                : 'border-[#ef4444]/30 bg-[#ef4444]/5 text-[#ef4444]'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* チェックインフォーム */}
        {keyResults.length === 0 ? (
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 text-center">
            <p className="text-sm text-[#737373]">
              アクティブなKey Resultがありません
            </p>
          </div>
        ) : (
          <div className={saving ? 'pointer-events-none opacity-60' : ''}>
            <CheckinForm keyResults={keyResults} onSubmit={handleSubmit} />
          </div>
        )}
      </div>
    </div>
  );
}
