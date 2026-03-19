// =============================================================================
// 自己評価概要ページ (Server Component)
// ログインユーザーの評価期間ステータス、各評価区分へのナビゲーション
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import { getOrCreateEvaluation } from '@/lib/evaluation/get-or-create-evaluation';
import type { EvalPeriodStatus } from '@/types/evaluation';

const STATUS_CONFIG: Record<EvalPeriodStatus, { label: string; color: string }> = {
  planning: { label: '計画中', color: 'text-[#737373] border-[#737373]' },
  target_setting: { label: '目標設定', color: 'text-[#f59e0b] border-[#f59e0b]' },
  self_eval: { label: '自己評価', color: 'text-[#3b82f6] border-[#3b82f6]' },
  manager_eval: { label: '上長評価', color: 'text-[#22d3ee] border-[#22d3ee]' },
  calibration: { label: 'キャリブレーション', color: 'text-[#a855f7] border-[#a855f7]' },
  feedback: { label: 'フィードバック', color: 'text-[#22d3ee] border-[#22d3ee]' },
  closed: { label: '完了', color: 'text-[#a3a3a3] border-[#a3a3a3]' },
};

interface SelfEvalPageProps {
  params: Promise<{ periodId: string }>;
}

export default async function SelfEvalPage(props: SelfEvalPageProps) {
  const { periodId } = await props.params;

  // 認証チェック
  const member = await getCurrentMember();
  if (!member) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">メンバー未登録</h2>
          <p className="text-sm text-[#737373]">
            ログインユーザーにメンバー情報が紐付けられていません。
            管理者にお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  // 評価期間の取得
  const supabase = await createClient();
  const { data: period, error: periodErr } = await supabase
    .from('eval_periods')
    .select('id, name, half, fiscal_year, start_date, end_date, status')
    .eq('id', periodId)
    .single();
  if (periodErr) console.error('[DB] eval_periods 取得エラー:', periodErr);

  if (!period) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">評価期間が見つかりません</h2>
          <p className="text-sm text-[#737373]">
            指定された評価期間は存在しません。URLを確認してください。
          </p>
        </div>
      </div>
    );
  }

  const evalPeriod = period as {
    id: string;
    name: string;
    half: string | null;
    fiscal_year: number | null;
    start_date: string;
    end_date: string;
    status: EvalPeriodStatus;
  };

  // 評価レコードの取得または作成
  const evaluation = await getOrCreateEvaluation(member.id, periodId);
  if (!evaluation) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">評価データを作成できません</h2>
          <p className="text-sm text-[#737373]">
            事業部への所属が確認できません。
          </p>
          <p className="text-sm text-[#737373] mt-2">
            メンバーの事業部配属が設定されていない可能性があります。管理者に確認してください。
          </p>
          <a
            href="/history"
            className="inline-block mt-4 px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#e5e5e5] hover:text-[#e5e5e5] transition-colors"
          >
            評価・査定に戻る
          </a>
        </div>
      </div>
    );
  }

  // 事業部名を取得
  const { data: division, error: divisionErr } = await supabase
    .from('divisions')
    .select('name')
    .eq('id', evaluation.division_id)
    .single();
  if (divisionErr) console.error('[DB] divisions 取得エラー:', divisionErr);

  const divisionName = (division as { name: string } | null)?.name ?? '不明';

  // 提出済みかどうか
  const isSubmitted = evaluation.status !== 'draft';

  // 各セクションの完了状態を判定
  const hasQuantitative = evaluation.quantitative_score !== null;
  const hasQualitative = evaluation.qualitative_score !== null;
  const hasValue = evaluation.value_score !== null;

  const evalSections = [
    {
      href: `/self/${periodId}/quantitative`,
      label: '定量評価',
      title: 'KPI',
      description: '売上/商談数等の自己実績入力',
      accentColor: 'text-[#3b82f6]',
      borderColor: 'hover:border-[#3b82f6]',
      score: evaluation.quantitative_score,
      completed: hasQuantitative,
    },
    {
      href: `/self/${periodId}/qualitative`,
      label: '定性評価',
      title: '行動',
      description: '行動評価の自己チェック',
      accentColor: 'text-[#22d3ee]',
      borderColor: 'hover:border-[#22d3ee]',
      score: evaluation.qualitative_score,
      completed: hasQualitative,
    },
    {
      href: `/self/${periodId}/values`,
      label: 'バリュー評価',
      title: 'VALUE',
      description: '企業価値への貢献度自己評価',
      accentColor: 'text-[#a855f7]',
      borderColor: 'hover:border-[#a855f7]',
      score: evaluation.value_score,
      completed: hasValue,
    },
    {
      href: `/self/${periodId}/summary`,
      label: 'サマリー',
      title: '総合',
      description: '自己評価の確認と提出',
      accentColor: 'text-[#e5e5e5]',
      borderColor: 'hover:border-[#e5e5e5]',
      score: evaluation.total_score,
      completed: isSubmitted,
    },
  ];

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              自己評価
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              {evalPeriod.name}
            </p>
          </div>
          <span className={`px-3 py-1 border text-xs font-bold ${STATUS_CONFIG[evalPeriod.status].color}`}>
            {STATUS_CONFIG[evalPeriod.status].label}
          </span>
        </div>

        {/* 自分の情報 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg text-[#e5e5e5] font-bold">
                {member.name}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold">
                  {evaluation.grade_at_eval}
                </span>
                <span className="text-xs text-[#737373]">{divisionName}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#737373]">フェーズ</div>
              <div className="text-sm text-[#a3a3a3] font-bold">
                {evaluation.phase_at_eval === 'profitable' ? '黒字' : '赤字'}
              </div>
            </div>
          </div>
        </div>

        {/* 期間情報 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3">
          <div className="flex items-center justify-between text-xs text-[#737373]">
            <span>評価期間: {evalPeriod.start_date} ~ {evalPeriod.end_date}</span>
            <span>ステータス: {isSubmitted ? '提出済' : '下書き'}</span>
          </div>
        </div>

        {/* 提出済みの場合の通知 */}
        {isSubmitted && (
          <div className="border border-[#22d3ee] bg-[#0a0a0a] px-4 py-3">
            <p className="text-sm text-[#22d3ee]">
              自己評価は提出済みです。内容は閲覧のみ可能です。
            </p>
          </div>
        )}

        {/* 評価メニュー */}
        <div className="grid grid-cols-2 lg:grid-cols-2 sm:grid-cols-4 gap-4">
          {evalSections.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className={`border border-[#1a1a1a] bg-[#0a0a0a] p-4 ${section.borderColor} transition-colors block`}
            >
              <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
                {section.label}
              </div>
              <div className={`text-lg font-bold ${section.accentColor}`}>
                {section.title}
              </div>
              <div className="text-xs text-[#404040] mt-1">{section.description}</div>
              {section.score !== null ? (
                <div className="mt-3 text-sm font-bold text-[#3b82f6]">
                  {Number(section.score).toFixed(1)}点
                </div>
              ) : (
                <div className="mt-3 text-xs text-[#404040]">
                  {section.completed ? '入力済' : '未入力'}
                </div>
              )}
            </a>
          ))}
        </div>

        {/* アクションボタン */}
        <div className="flex items-center justify-between">
          <a
            href="/history"
            className="px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
          >
            評価履歴へ
          </a>
        </div>
      </div>
    </div>
  );
}
