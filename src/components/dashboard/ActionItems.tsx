// =============================================================================
// アクションアイテムコンポーネント (Server Component)
// ダッシュボード上部に「やるべきこと」リストを表示する
// =============================================================================

import Link from 'next/link';
import type { EvalPeriodStatus, EvaluationStatus, Grade } from '@/types/evaluation';

// -----------------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------------

/** アクションアイテムの緊急度 */
type ActionSeverity = 'info' | 'warning' | 'urgent';

/** 1つのアクションアイテム */
interface ActionItem {
  id: string;
  severity: ActionSeverity;
  title: string;
  description: string;
  href: string;
}

/** コンポーネントProps */
interface ActionItemsProps {
  memberGrade: Grade;
  memberId: string;
  divisionIds: string[];
  orgId: string;
  /** アクティブな評価期間一覧（status が planning/closed 以外） */
  evalPeriods: ReadonlyArray<{
    id: string;
    name: string;
    status: EvalPeriodStatus;
  }>;
  /** 当期の自分の評価レコード */
  myEvaluations: ReadonlyArray<{
    id: string;
    eval_period_id: string;
    status: EvaluationStatus;
  }>;
  /** 部下の評価レコード（マネージャー/管理者用） */
  subordinateEvaluations: ReadonlyArray<{
    id: string;
    eval_period_id: string;
    member_id: string;
    member_name: string;
    status: EvaluationStatus;
  }>;
  /** 自分の最新OKRチェックイン日（ISO文字列 or null） */
  latestCheckinDate: string | null;
  /** 部下との最新1on1日付マップ（マネージャー/管理者用） */
  subordinateLastOneOnOne: ReadonlyArray<{
    member_id: string;
    member_name: string;
    last_meeting_date: string | null;
  }>;
}

// -----------------------------------------------------------------------------
// SVGアイコン
// INDUSTRIAL VOID: strokeLinecap="square", strokeLinejoin="miter"
// -----------------------------------------------------------------------------

function InfoIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="8" stroke="#3b82f6" strokeWidth="1.5" />
      <line
        x1="10" y1="9" x2="10" y2="14"
        stroke="#3b82f6" strokeWidth="1.5"
        strokeLinecap="square" strokeLinejoin="miter"
      />
      <rect x="9.25" y="6" width="1.5" height="1.5" fill="#3b82f6" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10 2L19 18H1L10 2Z"
        stroke="#f59e0b" strokeWidth="1.5"
        strokeLinecap="square" strokeLinejoin="miter"
        fill="none"
      />
      <line
        x1="10" y1="8" x2="10" y2="13"
        stroke="#f59e0b" strokeWidth="1.5"
        strokeLinecap="square" strokeLinejoin="miter"
      />
      <rect x="9.25" y="14.5" width="1.5" height="1.5" fill="#f59e0b" />
    </svg>
  );
}

function UrgentIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="2" y="2" width="16" height="16"
        stroke="#ef4444" strokeWidth="1.5"
        strokeLinecap="square" strokeLinejoin="miter"
        fill="none"
      />
      <line
        x1="10" y1="6" x2="10" y2="11"
        stroke="#ef4444" strokeWidth="1.5"
        strokeLinecap="square" strokeLinejoin="miter"
      />
      <rect x="9.25" y="12.5" width="1.5" height="1.5" fill="#ef4444" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4 10L8 14L16 6"
        stroke="#22d3ee" strokeWidth="1.5"
        strokeLinecap="square" strokeLinejoin="miter"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <line
        x1="3" y1="8" x2="13" y2="8"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="square" strokeLinejoin="miter"
      />
      <path
        d="M9 4L13 8L9 12"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="square" strokeLinejoin="miter"
        fill="none"
      />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// アイコンセレクタ
// -----------------------------------------------------------------------------

function SeverityIcon({ severity }: { severity: ActionSeverity }) {
  switch (severity) {
    case 'info':
      return <InfoIcon />;
    case 'warning':
      return <WarningIcon />;
    case 'urgent':
      return <UrgentIcon />;
  }
}

// -----------------------------------------------------------------------------
// アクションアイテム収集ロジック
// -----------------------------------------------------------------------------

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function collectActionItems(props: ActionItemsProps): ActionItem[] {
  const items: ActionItem[] = [];
  const now = Date.now();
  const isManager = props.memberGrade === 'G3';
  const isAdmin = props.memberGrade === 'G4' || props.memberGrade === 'G5';
  const isMember = props.memberGrade === 'G1' || props.memberGrade === 'G2';

  // -----------------------------------------------------------------------
  // メンバー向け (G1/G2)
  // -----------------------------------------------------------------------
  if (isMember) {
    // 自己評価未提出チェック
    for (const period of props.evalPeriods) {
      if (period.status === 'self_eval') {
        const myEval = props.myEvaluations.find(
          (e) => e.eval_period_id === period.id
        );
        if (!myEval || myEval.status === 'draft') {
          items.push({
            id: `self-eval-${period.id}`,
            severity: 'urgent',
            title: '自己評価を提出してください',
            description: `${period.name}の自己評価がまだ提出されていません。`,
            href: `/evaluations?period=${period.id}`,
          });
        }
      }
    }

    // OKRチェックインが7日以上前
    if (props.latestCheckinDate) {
      const lastCheckin = new Date(props.latestCheckinDate).getTime();
      if (now - lastCheckin > SEVEN_DAYS_MS) {
        items.push({
          id: 'okr-checkin-overdue',
          severity: 'warning',
          title: 'OKRチェックインをしましょう',
          description: '最終チェックインから7日以上経過しています。',
          href: '/okr',
        });
      }
    } else {
      // チェックインが一度もない場合
      items.push({
        id: 'okr-checkin-none',
        severity: 'warning',
        title: 'OKRチェックインをしましょう',
        description: 'まだチェックインが記録されていません。',
        href: '/okr',
      });
    }
  }

  // -----------------------------------------------------------------------
  // マネージャー向け (G3) + 管理者向け (G4/G5)
  // -----------------------------------------------------------------------
  if (isManager || isAdmin) {
    // 部下の上長評価が未完了
    const pendingManagerEvals = props.subordinateEvaluations.filter((e) => {
      const period = props.evalPeriods.find((p) => p.id === e.eval_period_id);
      return (
        period &&
        (period.status === 'manager_eval' || period.status === 'self_eval') &&
        e.status === 'self_submitted'
      );
    });
    if (pendingManagerEvals.length > 0) {
      items.push({
        id: 'manager-eval-pending',
        severity: 'urgent',
        title: `${pendingManagerEvals.length}人の上長評価が残っています`,
        description: '部下が自己評価を提出済みです。上長評価を完了してください。',
        href: '/evaluations',
      });
    }

    // 1on1が30日以上空いている部下
    for (const sub of props.subordinateLastOneOnOne) {
      if (!sub.last_meeting_date) {
        items.push({
          id: `1on1-never-${sub.member_id}`,
          severity: 'warning',
          title: `${sub.member_name}さんとの1on1を設定しましょう`,
          description: 'まだ1on1が記録されていません。',
          href: '/one-on-one',
        });
      } else {
        const lastMeeting = new Date(sub.last_meeting_date).getTime();
        if (now - lastMeeting > THIRTY_DAYS_MS) {
          items.push({
            id: `1on1-overdue-${sub.member_id}`,
            severity: 'warning',
            title: `${sub.member_name}さんとの1on1を設定しましょう`,
            description: `最終1on1から30日以上経過しています。`,
            href: '/one-on-one',
          });
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // 管理者向け (G4/G5)
  // -----------------------------------------------------------------------
  if (isAdmin) {
    // 評価期間フェーズ情報
    for (const period of props.evalPeriods) {
      if (
        period.status === 'self_eval' ||
        period.status === 'manager_eval'
      ) {
        const statusLabel =
          period.status === 'self_eval' ? '自己評価' : '上長評価';
        items.push({
          id: `period-phase-${period.id}`,
          severity: 'info',
          title: `${period.name}: ${statusLabel}フェーズ中`,
          description: '進行中の評価フェーズがあります。',
          href: '/admin/eval-periods',
        });
      }
    }

    // キャリブレーション待ち
    const calibrationPeriods = props.evalPeriods.filter(
      (p) => p.status === 'calibration'
    );
    if (calibrationPeriods.length > 0) {
      const calibrationEvals = props.subordinateEvaluations.filter((e) =>
        calibrationPeriods.some((p) => p.id === e.eval_period_id) &&
        e.status === 'manager_submitted'
      );
      if (calibrationEvals.length > 0) {
        items.push({
          id: 'calibration-pending',
          severity: 'urgent',
          title: `キャリブレーション対象: ${calibrationEvals.length}件`,
          description: '上長評価が完了し、キャリブレーション待ちの評価があります。',
          href: '/admin/calibration',
        });
      }
    }
  }

  return items;
}

// -----------------------------------------------------------------------------
// メインコンポーネント
// -----------------------------------------------------------------------------

export default function ActionItems(props: ActionItemsProps) {
  const items = collectActionItems(props);

  return (
    <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
      <div className="border-b border-[#1a1a1a] px-4 py-3">
        <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
          やるべきこと
        </h3>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-6 flex items-center justify-center gap-3">
          <CheckIcon />
          <span className="text-sm text-[#22d3ee] font-medium">
            すべて完了です
          </span>
        </div>
      ) : (
        <ul className="divide-y divide-[#1a1a1a]">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-4 px-4 py-3 hover:bg-[#111111] transition-colors group"
              >
                <div className="flex-shrink-0">
                  <SeverityIcon severity={item.severity} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#e5e5e5] truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-[#737373] mt-0.5 truncate">
                    {item.description}
                  </p>
                </div>
                <div className="flex-shrink-0 text-[#737373] group-hover:text-[#e5e5e5] transition-colors">
                  <ArrowIcon />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
