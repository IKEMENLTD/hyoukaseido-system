// =============================================================================
// OKR詳細ページ
// Objective詳細とKey Result進捗を表示
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { getCurrentMember } from '@/lib/auth/get-member';
import { notFound } from 'next/navigation';
import ObjectiveActions from './ObjectiveActions';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface CheckinRow {
  checkin_date: string;
  value: number;
  confidence: number;
  note: string | null;
}

interface KeyResultRow {
  id: string;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
  confidence: number;
  final_score: number | null;
  okr_checkins: CheckinRow[];
}

interface ObjectiveRow {
  id: string;
  title: string;
  level: string;
  status: string;
  created_at: string;
  members: { name: string } | null;
  divisions: { name: string } | null;
  okr_periods: { name: string } | null;
}

interface Checkin {
  date: string;
  value: number;
  confidence: number;
  note: string;
}

interface KeyResult {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  confidence: number;
  finalScore: number | null;
  checkins: Checkin[];
}

// ---------------------------------------------------------------------------
// ヘルパー関数
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
// ページコンポーネント
// ---------------------------------------------------------------------------

interface ObjectiveDetailPageProps {
  params: Promise<{ objectiveId: string }>;
}

export default async function ObjectiveDetailPage(props: ObjectiveDetailPageProps) {
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

  const { objectiveId } = await props.params;

  // Supabaseクライアント
  const supabase = await createClient();

  // Objective詳細取得
  const { data: objective, error: objError } = await supabase
    .from('okr_objectives')
    .select(`
      id, title, level, status, created_at, member_id,
      members (name),
      divisions (name),
      okr_periods (name)
    `)
    .eq('id', objectiveId)
    .single();

  if (objError || !objective) {
    notFound();
  }

  const typedObjective = objective as unknown as ObjectiveRow;

  // Key Results + チェックイン履歴取得
  const { data: rawKeyResults, error: rawKeyResultsErr } = await supabase
    .from('okr_key_results')
    .select(`
      id, title, target_value, current_value, unit, confidence, final_score,
      okr_checkins (checkin_date, value, confidence, note)
    `)
    .eq('objective_id', objectiveId)
    .order('sort_order');
  if (rawKeyResultsErr) console.error('[DB] okr_key_results 取得エラー:', rawKeyResultsErr);

  // データ変換
  const periodName = typedObjective.okr_periods?.name ?? '';
  const memberName =
    typedObjective.level === 'individual'
      ? typedObjective.members?.name ?? ''
      : typedObjective.divisions?.name ?? '全社';

  const keyResults: KeyResult[] = (
    (rawKeyResults as unknown as KeyResultRow[]) ?? []
  ).map((kr) => {
    // チェックインをcheckin_dateの降順でソート
    const sortedCheckins = [...(kr.okr_checkins ?? [])].sort(
      (a, b) => (b.checkin_date > a.checkin_date ? 1 : b.checkin_date < a.checkin_date ? -1 : 0),
    );

    return {
      id: kr.id,
      title: kr.title,
      targetValue: kr.target_value,
      currentValue: kr.current_value,
      unit: kr.unit,
      confidence: kr.confidence,
      finalScore: kr.final_score,
      checkins: sortedCheckins.map((c) => ({
        date: c.checkin_date,
        value: c.value,
        confidence: c.confidence,
        note: c.note ?? '',
      })),
    };
  });

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Objectiveヘッダー */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-6 py-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-2 py-0.5 border border-[#22d3ee] text-xs text-[#22d3ee] font-bold uppercase">
              {typedObjective.level}
            </span>
            <span className="px-2 py-0.5 border border-[#333333] text-xs text-[#a3a3a3]">
              {periodName}
            </span>
            <span className="px-2 py-0.5 border border-[#3b82f6] text-xs text-[#3b82f6]">
              {typedObjective.status}
            </span>
          </div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            {typedObjective.title}
          </h1>
          <p className="text-sm text-[#737373] mt-2">
            {memberName}
          </p>
          <div className="mt-4">
            <ObjectiveActions
              objectiveId={objectiveId}
              currentTitle={typedObjective.title}
              canEdit={
                (typedObjective as unknown as { member_id: string | null }).member_id === member.id
                || ['G3', 'G4', 'G5'].includes(member.grade)
              }
              canDelete={['G4', 'G5'].includes(member.grade)}
            />
          </div>
        </div>

        {/* Key Results */}
        <div className="space-y-4">
          {keyResults.map((kr) => {
            const ratio = kr.targetValue === 0 ? 0 : Math.min(kr.currentValue / kr.targetValue, 1);
            const percent = Math.round(ratio * 100);

            return (
              <div key={kr.id} className="border border-[#1a1a1a] bg-[#0a0a0a]">
                {/* KRヘッダー */}
                <div className="border-b border-[#1a1a1a] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm text-[#e5e5e5] font-medium">
                      {kr.title}
                    </h3>
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
          })}
        </div>
      </div>
    </div>
  );
}
