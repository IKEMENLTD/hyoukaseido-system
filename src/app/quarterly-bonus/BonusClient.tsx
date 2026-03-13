// =============================================================================
// 四半期ボーナス管理クライアントコンポーネント (Q-01)
// 承認・新規追加のインタラクティブ操作
// =============================================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BonusType, BonusStatus } from '@/types/evaluation';
import { createClient } from '@/lib/supabase/client';

// -----------------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------------

interface DisplayBonus {
  id: string;
  memberName: string;
  divisionName: string;
  okrPeriodName: string;
  bonusType: BonusType;
  amount: number;
  calculationBasis: string;
  approvedBy: string | null;
  status: BonusStatus;
  createdAt: string;
}

interface MemberOption {
  id: string;
  name: string;
}

interface DivisionOption {
  id: string;
  name: string;
}

interface OkrPeriodOption {
  id: string;
  name: string;
}

interface BonusClientProps {
  bonuses: DisplayBonus[];
  isAdmin: boolean;
  currentMemberId: string;
  members: MemberOption[];
  divisions: DivisionOption[];
  okrPeriods: OkrPeriodOption[];
}

// -----------------------------------------------------------------------------
// 定数
// -----------------------------------------------------------------------------

const BONUS_TYPE_LABELS: Record<BonusType, { label: string; color: string }> = {
  kpi_achievement: { label: 'KPI達成', color: 'text-[#3b82f6] border-[#3b82f6]' },
  okr_stretch: { label: 'OKRストレッチ', color: 'text-[#a855f7] border-[#a855f7]' },
  special: { label: '特別', color: 'text-[#22d3ee] border-[#22d3ee]' },
};

const STATUS_LABELS: Record<BonusStatus, { label: string; color: string }> = {
  pending: { label: '承認待ち', color: 'text-[#f59e0b] border-[#f59e0b]' },
  approved: { label: '承認済み', color: 'text-[#3b82f6] border-[#3b82f6]' },
  paid: { label: '支給済み', color: 'text-[#22d3ee] border-[#22d3ee]' },
};

// -----------------------------------------------------------------------------
// コンポーネント
// -----------------------------------------------------------------------------

export default function BonusClient({
  bonuses: initialBonuses,
  isAdmin,
  currentMemberId,
  members,
  divisions,
  okrPeriods,
}: BonusClientProps) {
  const router = useRouter();
  const [bonuses, setBonuses] = useState<DisplayBonus[]>(initialBonuses);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- 新規追加フォーム ---
  const [showForm, setShowForm] = useState(false);
  const [formMemberId, setFormMemberId] = useState('');
  const [formDivisionId, setFormDivisionId] = useState('');
  const [formOkrPeriodId, setFormOkrPeriodId] = useState(okrPeriods[0]?.id ?? '');
  const [formBonusType, setFormBonusType] = useState<BonusType>('kpi_achievement');
  const [formAmount, setFormAmount] = useState('');
  const [formBasis, setFormBasis] = useState('');
  const [saving, setSaving] = useState(false);

  // -------------------------------------------------------------------------
  // 承認処理
  // -------------------------------------------------------------------------
  const handleApprove = async (bonusId: string) => {
    setApprovingId(bonusId);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase
      .from('quarterly_bonuses')
      .update({
        status: 'approved' as const,
        approved_by: currentMemberId,
      })
      .eq('id', bonusId)
      .eq('status', 'pending');

    setApprovingId(null);

    if (error) {
      setMessage({ type: 'error', text: '承認に失敗しました。再度お試しください。' });
      return;
    }

    setBonuses((prev) =>
      prev.map((b) =>
        b.id === bonusId
          ? { ...b, status: 'approved' as BonusStatus, approvedBy: '自分' }
          : b,
      ),
    );
    setMessage({ type: 'success', text: 'ボーナスを承認しました。' });
    router.refresh();
  };

  // -------------------------------------------------------------------------
  // 新規追加処理
  // -------------------------------------------------------------------------
  const handleCreate = async () => {
    if (!formMemberId || !formDivisionId || !formOkrPeriodId || !formAmount) {
      setMessage({ type: 'error', text: '必須項目を入力してください。' });
      return;
    }

    const amount = parseInt(formAmount, 10);
    if (Number.isNaN(amount) || amount <= 0) {
      setMessage({ type: 'error', text: '金額は正の整数で入力してください。' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.from('quarterly_bonuses').insert({
      okr_period_id: formOkrPeriodId,
      member_id: formMemberId,
      division_id: formDivisionId,
      bonus_type: formBonusType,
      amount,
      calculation_basis: formBasis || null,
      status: 'pending' as const,
    });

    setSaving(false);

    if (error) {
      setMessage({ type: 'error', text: '登録に失敗しました。再度お試しください。' });
      return;
    }

    setShowForm(false);
    setFormMemberId('');
    setFormDivisionId('');
    setFormAmount('');
    setFormBasis('');
    setFormBonusType('kpi_achievement');
    setMessage({ type: 'success', text: 'ボーナスを登録しました。' });
    router.refresh();
  };

  return (
    <>
      {/* メッセージ */}
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

      {/* 新規追加フォーム (G4/G5のみ) */}
      {isAdmin && (
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              新規ボーナス登録
            </h3>
            <button
              type="button"
              onClick={() => { setShowForm(!showForm); setMessage(null); }}
              className="px-3 py-1 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold hover:bg-[#3b82f6]/10"
            >
              {showForm ? '閉じる' : '新規追加'}
            </button>
          </div>

          {showForm && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* メンバー */}
                <div>
                  <label className="block text-xs text-[#a3a3a3] mb-1">対象メンバー</label>
                  <select
                    value={formMemberId}
                    onChange={(e) => setFormMemberId(e.target.value)}
                    className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none"
                  >
                    <option value="">選択してください</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                {/* 事業部 */}
                <div>
                  <label className="block text-xs text-[#a3a3a3] mb-1">事業部</label>
                  <select
                    value={formDivisionId}
                    onChange={(e) => setFormDivisionId(e.target.value)}
                    className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none"
                  >
                    <option value="">選択してください</option>
                    {divisions.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* OKR期間 */}
                <div>
                  <label className="block text-xs text-[#a3a3a3] mb-1">OKR期間</label>
                  <select
                    value={formOkrPeriodId}
                    onChange={(e) => setFormOkrPeriodId(e.target.value)}
                    className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none"
                  >
                    {okrPeriods.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* 種別 */}
                <div>
                  <label className="block text-xs text-[#a3a3a3] mb-1">種別</label>
                  <select
                    value={formBonusType}
                    onChange={(e) => setFormBonusType(e.target.value as BonusType)}
                    className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none"
                  >
                    <option value="kpi_achievement">KPI達成</option>
                    <option value="okr_stretch">OKRストレッチ</option>
                    <option value="special">特別</option>
                  </select>
                </div>

                {/* 金額 */}
                <div>
                  <label className="block text-xs text-[#a3a3a3] mb-1">金額 (円)</label>
                  <input
                    type="number"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none"
                    placeholder="50000"
                    min="1"
                  />
                </div>

                {/* 算定根拠 */}
                <div>
                  <label className="block text-xs text-[#a3a3a3] mb-1">算定根拠</label>
                  <input
                    type="text"
                    value={formBasis}
                    onChange={(e) => setFormBasis(e.target.value)}
                    className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none"
                    placeholder="KPI達成率120%に基づく"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={saving}
                  className={`px-4 py-2 border text-xs font-bold ${
                    saving
                      ? 'border-[#333333] text-[#737373] cursor-not-allowed'
                      : 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20'
                  }`}
                >
                  {saving ? '登録中...' : '登録'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                  className="px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] font-bold hover:border-[#555555]"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ボーナス一覧テーブル */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="border-b border-[#1a1a1a] px-4 py-3">
          <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
            ボーナス一覧
          </h3>
        </div>
        {bonuses.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[#737373]">ボーナスデータはまだ登録されていません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#737373]">
                  <th className="px-4 py-2 text-left font-medium">メンバー</th>
                  <th className="px-4 py-2 text-left font-medium">事業部</th>
                  <th className="px-4 py-2 text-center font-medium">種別</th>
                  <th className="px-4 py-2 text-right font-medium">金額</th>
                  <th className="px-4 py-2 text-left font-medium">算定根拠</th>
                  <th className="px-4 py-2 text-center font-medium">ステータス</th>
                  <th className="px-4 py-2 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {bonuses.map((bonus) => {
                  const typeConfig = BONUS_TYPE_LABELS[bonus.bonusType];
                  const statusConfig = STATUS_LABELS[bonus.status];
                  const isApproving = approvingId === bonus.id;

                  return (
                    <tr
                      key={bonus.id}
                      className="border-b border-[#111111] hover:bg-[#111111] transition-colors"
                    >
                      <td className="px-4 py-3 text-[#e5e5e5] font-medium">{bonus.memberName}</td>
                      <td className="px-4 py-3 text-[#737373]">{bonus.divisionName}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 border text-[10px] font-bold ${typeConfig.color}`}>
                          {typeConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[#e5e5e5] font-bold">
                        {bonus.amount.toLocaleString()}円
                      </td>
                      <td className="px-4 py-3 text-[#737373] text-xs max-w-xs">
                        {bonus.calculationBasis}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 border text-[10px] font-bold ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {bonus.status === 'pending' && isAdmin ? (
                          <button
                            type="button"
                            onClick={() => handleApprove(bonus.id)}
                            disabled={isApproving}
                            className={`px-2 py-1 border text-[10px] font-bold ${
                              isApproving
                                ? 'border-[#333333] text-[#737373] cursor-not-allowed'
                                : 'border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6]/10'
                            }`}
                          >
                            {isApproving ? '処理中...' : '承認'}
                          </button>
                        ) : bonus.status === 'pending' ? (
                          <span className="text-[10px] text-[#f59e0b]">承認待ち</span>
                        ) : (
                          <span className="text-[10px] text-[#404040]">
                            {bonus.approvedBy ?? '---'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export type { DisplayBonus, MemberOption, DivisionOption, OkrPeriodOption };
