// =============================================================================
// トスアップ登録ページ - Client Component
// フォーム操作 + Supabase送信
// =============================================================================

'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TossStatus } from '@/types/crosssell';

// ---------------------------------------------------------------------------
// ステータス表示設定
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<TossStatus, { label: string; color: string }> = {
  tossed: { label: 'トス済', color: 'text-[#f59e0b] border-[#f59e0b]' },
  in_progress: { label: '進行中', color: 'text-[#3b82f6] border-[#3b82f6]' },
  contracted: { label: '受注', color: 'text-[#22d3ee] border-[#22d3ee]' },
  cancelled: { label: 'キャンセル', color: 'text-[#737373] border-[#737373]' },
};

// ---------------------------------------------------------------------------
// Props型定義
// ---------------------------------------------------------------------------

interface TossPageClientProps {
  routes: Array<{
    id: string;
    fromDivision: string;
    toDivision: string;
    condition: string;
    tossBonusRate: number;
    receiveBonusRate: number;
  }>;
  receivers: Array<{
    id: string;
    name: string;
    division: string;
  }>;
  recentTosses: Array<{
    id: string;
    toDivision: string;
    receiverName: string;
    tossDate: string;
    status: TossStatus;
    grossProfit: number | null;
  }>;
  memberId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TossPageClient({
  routes,
  receivers,
  recentTosses,
  memberId,
}: TossPageClientProps) {
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedReceiverId, setSelectedReceiverId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const canSubmit = selectedRouteId !== '' && selectedReceiverId !== '' && !saving;

  const handleSubmit = useCallback(async () => {
    if (!selectedRouteId || !selectedReceiverId) return;
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    const selectedRoute = routes.find((r) => r.id === selectedRouteId);

    const { error } = await supabase.from('crosssell_tosses').insert({
      route_id: selectedRouteId,
      tosser_id: memberId,
      receiver_id: selectedReceiverId,
      toss_date: today,
      status: 'tossed' as const,
      toss_bonus_rate: selectedRoute?.tossBonusRate ?? 0,
      receive_bonus_rate: selectedRoute?.receiveBonusRate ?? 0,
      note: note || null,
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'トスアップを登録しました' });
      setSelectedRouteId('');
      setSelectedReceiverId('');
      setNote('');
    }
    setSaving(false);
  }, [selectedRouteId, selectedReceiverId, note, memberId, routes]);

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            トスアップ登録
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            他事業部への案件トスアップを登録します
          </p>
        </div>

        {/* 成功/エラーメッセージ */}
        {message && (
          <div
            className={`border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-[#22d3ee] text-[#22d3ee] bg-[#22d3ee]/5'
                : 'border-[#ef4444] text-[#ef4444] bg-[#ef4444]/5'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* トスアップフォーム */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              新規トスアップ
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {/* 経路選択 */}
            <div>
              <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
                クロスセル経路
              </label>
              {routes.length === 0 ? (
                <div className="border border-[#1a1a1a] p-4 text-center">
                  <p className="text-sm text-[#737373]">
                    有効なクロスセル経路がありません
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {routes.map((route) => (
                    <label
                      key={route.id}
                      className="flex items-start gap-3 border border-[#1a1a1a] p-3 hover:border-[#333333] transition-colors cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="route"
                        value={route.id}
                        checked={selectedRouteId === route.id}
                        onChange={() => setSelectedRouteId(route.id)}
                        className="mt-1 accent-[#3b82f6]"
                      />
                      <div className="flex-1">
                        <div className="text-sm text-[#e5e5e5]">
                          {route.fromDivision} → {route.toDivision}
                        </div>
                        <div className="text-xs text-[#737373] mt-1">
                          {route.condition}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-[10px] text-[#404040]">
                          <span>
                            トス元ボーナス:{' '}
                            {(route.tossBonusRate * 100).toFixed(1)}%
                          </span>
                          <span>
                            受注側ボーナス:{' '}
                            {(route.receiveBonusRate * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 受け取り担当者 */}
            <div>
              <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
                受け取り担当者
              </label>
              <select
                value={selectedReceiverId}
                onChange={(e) => setSelectedReceiverId(e.target.value)}
                className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] text-sm px-3 py-2 focus:border-[#3b82f6] outline-none"
              >
                <option value="">担当者を選択</option>
                {receivers.map((receiver) => (
                  <option key={receiver.id} value={receiver.id}>
                    {receiver.name} ({receiver.division})
                  </option>
                ))}
              </select>
            </div>

            {/* メモ */}
            <div>
              <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
                メモ / 補足情報
              </label>
              <textarea
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="顧客名、紹介背景、注意事項など"
                className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] text-sm px-3 py-2 focus:border-[#3b82f6] outline-none resize-none placeholder:text-[#404040]"
              />
            </div>

            {/* 送信ボタン */}
            <div className="flex items-center justify-end">
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className={`px-6 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                  canSubmit
                    ? 'bg-[#3b82f6] text-[#e5e5e5] hover:bg-[#2563eb] cursor-pointer'
                    : 'bg-[#333333] text-[#737373] cursor-not-allowed'
                }`}
              >
                {saving ? '登録中...' : 'トスアップを登録'}
              </button>
            </div>
          </div>
        </div>

        {/* 最近のトスアップ */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              最近のトスアップ
            </h3>
          </div>
          <div className="overflow-x-auto">
            {recentTosses.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-[#737373]">
                  トスアップの履歴はありません
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1a1a] text-[#737373]">
                    <th className="px-4 py-2 text-left font-medium">宛先</th>
                    <th className="px-4 py-2 text-left font-medium">担当者</th>
                    <th className="px-4 py-2 text-left font-medium">日付</th>
                    <th className="px-4 py-2 text-center font-medium">
                      ステータス
                    </th>
                    <th className="px-4 py-2 text-right font-medium">粗利</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTosses.map((toss) => {
                    const statusConfig = STATUS_CONFIG[toss.status];
                    return (
                      <tr
                        key={toss.id}
                        className="border-b border-[#111111] hover:bg-[#111111] transition-colors"
                      >
                        <td className="px-4 py-3 text-[#e5e5e5]">
                          {toss.toDivision}
                        </td>
                        <td className="px-4 py-3 text-[#a3a3a3]">
                          {toss.receiverName}
                        </td>
                        <td className="px-4 py-3 text-[#737373]">
                          {toss.tossDate}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 border text-xs font-bold ${statusConfig.color}`}
                          >
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-[#e5e5e5] font-bold">
                          {toss.grossProfit !== null
                            ? `${toss.grossProfit.toLocaleString()}円`
                            : '---'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
