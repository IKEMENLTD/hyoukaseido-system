// =============================================================================
// OKR一覧ページ
// 全社/事業部/個人のObjectiveをOKRTreeで階層表示
// =============================================================================

import OKRTree from '@/components/okr/OKRTree';
import { getCurrentMember } from '@/lib/auth/get-member';
import { createClient } from '@/lib/supabase/server';
import ObjectiveFormClient from './ObjectiveFormClient';

// ---------------------------------------------------------------------------
// Supabaseから取得する生データの型定義
// ---------------------------------------------------------------------------
interface RawKeyResult {
  id: string;
  title: string;
  current_value: number;
  target_value: number;
  unit: string;
  confidence: number;
}

interface RawObjective {
  id: string;
  title: string;
  level: 'company' | 'division' | 'individual';
  status: string;
  members: { name: string } | null;
  okr_key_results: RawKeyResult[];
}

interface OkrPeriod {
  id: string;
  name: string;
  quarter: number;
  fiscal_year: number;
  status: string;
}

// ---------------------------------------------------------------------------
// OKRTreeコンポーネントに渡す型（既存、変更不要）
// ---------------------------------------------------------------------------
interface KeyResultData {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  confidence: number;
}

interface ObjectiveData {
  id: string;
  title: string;
  level: 'company' | 'division' | 'individual';
  memberName?: string;
  keyResults: KeyResultData[];
}

// ---------------------------------------------------------------------------
// 生データをOKRTree用に変換
// ---------------------------------------------------------------------------
function transformObjectives(raw: RawObjective[]): ObjectiveData[] {
  return raw.map((obj) => ({
    id: obj.id,
    title: obj.title,
    level: obj.level,
    memberName: obj.members?.name,
    keyResults: (obj.okr_key_results ?? []).map((kr) => ({
      id: kr.id,
      title: kr.title,
      currentValue: kr.current_value,
      targetValue: kr.target_value,
      unit: kr.unit,
      confidence: kr.confidence,
    })),
  }));
}

export default async function ObjectivesPage() {
  const member = await getCurrentMember();
  if (!member) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">メンバー未登録</h2>
          <p className="text-sm text-[#737373]">ログインユーザーにメンバー情報が紐付けられていません。</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // 最新のアクティブなOKR期間を取得
  const { data: okrPeriod, error: periodError } = await supabase
    .from('okr_periods')
    .select('id, name, quarter, fiscal_year, status')
    .in('status', ['active', 'reviewing', 'planning'])
    .order('start_date', { ascending: false })
    .limit(1)
    .single<OkrPeriod>();

  if (periodError || !okrPeriod) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6 flex items-center justify-center">
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4 sm:p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">アクティブなOKR期間がありません</h2>
          <p className="text-sm text-[#737373]">OKR期間が設定されていないか、現在有効な期間が見つかりません。</p>
        </div>
      </div>
    );
  }

  // その期間のObjectives + Key Results + member名を取得
  const { data: rawObjectives, error: rawObjectivesErr } = await supabase
    .from('okr_objectives')
    .select(`
      id, title, level, status,
      members (name),
      okr_key_results (id, title, current_value, target_value, unit, confidence)
    `)
    .eq('okr_period_id', okrPeriod.id)
    .order('level')
    .returns<RawObjective[]>();
  if (rawObjectivesErr) console.error('[DB] okr_objectives 取得エラー:', rawObjectivesErr);

  // 事業部一覧を取得（フォームで使用）
  const { data: divisions, error: divisionsErr } = await supabase
    .from('divisions')
    .select('id, name')
    .order('name');
  if (divisionsErr) console.error('[DB] divisions 取得エラー:', divisionsErr);

  const typedDivisions = (divisions ?? []) as Array<{ id: string; name: string }>;

  const objectives = transformObjectives(rawObjectives ?? []);

  const companyCount = objectives.filter((o) => o.level === 'company').length;
  const divisionCount = objectives.filter((o) => o.level === 'division').length;
  const individualCount = objectives.filter((o) => o.level === 'individual').length;

  if (objectives.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* ページヘッダー */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
                OKR一覧
              </h1>
              <p className="text-sm text-[#737373] mt-1">
                全社 / 事業部 / 個人のOKRツリー
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 border border-[#333333] text-xs text-[#a3a3a3]">
                {okrPeriod.fiscal_year}年度
              </span>
              <span className="px-3 py-1 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold">
                Q{okrPeriod.quarter}
              </span>
            </div>
          </div>

          {/* OKR作成フォーム */}
          <ObjectiveFormClient
            memberId={member.id}
            memberGrade={member.grade}
            okrPeriodId={okrPeriod.id}
            divisions={typedDivisions}
          />

          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 text-center">
            <h2 className="text-lg font-bold text-[#e5e5e5] mb-2">OKRが登録されていません</h2>
            <p className="text-sm text-[#737373]">この期間にはまだOKRが設定されていません。</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              OKR一覧
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              全社 / 事業部 / 個人のOKRツリー
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 border border-[#333333] text-xs text-[#a3a3a3]">
              {okrPeriod.fiscal_year}年度
            </span>
            <span className="px-3 py-1 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold">
              Q{okrPeriod.quarter}
            </span>
          </div>
        </div>

        {/* OKR作成フォーム */}
        <ObjectiveFormClient
          memberId={member.id}
          memberGrade={member.grade}
          okrPeriodId={okrPeriod.id}
          divisions={typedDivisions}
        />

        {/* OKRツリー */}
        <OKRTree objectives={objectives} />

        {/* サマリー情報 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
              全社 Objectives
            </div>
            <div className="text-2xl font-bold text-[#3b82f6]">{companyCount}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
              事業部 Objectives
            </div>
            <div className="text-2xl font-bold text-[#22d3ee]">{divisionCount}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-2">
              個人 Objectives
            </div>
            <div className="text-2xl font-bold text-[#a3a3a3]">{individualCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
