// =============================================================================
// 期限バナーコンポーネント (Server Component)
// 評価期間の end_date に基づいて残り日数と深刻度を表示する
// =============================================================================

import {
  getDeadlineInfo,
  getDeadlineStyles,
} from '@/lib/utils/deadline';

interface DeadlineBannerProps {
  endDate: string;
}

/** 時計アイコン (SVG) - normal / warning 用 */
function ClockIcon({ className }: { className: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8L10.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

/** 警告アイコン (SVG) - urgent / overdue 用 */
function AlertIcon({ className }: { className: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M7.134 2.5a1 1 0 011.732 0l5.196 9A1 1 0 0113.196 13H2.804a1 1 0 01-.866-1.5l5.196-9z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M8 6v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <rect x="7.25" y="10.5" width="1.5" height="1.5" fill="currentColor" />
    </svg>
  );
}

export default function DeadlineBanner({ endDate }: DeadlineBannerProps) {
  const deadline = getDeadlineInfo(endDate);
  const styles = getDeadlineStyles(deadline.severity);

  const isUrgentOrOverdue = deadline.severity === 'urgent' || deadline.severity === 'overdue';

  return (
    <div
      className={`border ${styles.borderClass} ${styles.containerClass} px-4 py-3 flex items-center gap-3`}
    >
      {isUrgentOrOverdue ? (
        <AlertIcon className={`${styles.textClass} shrink-0`} />
      ) : (
        <ClockIcon className={`${styles.textClass} shrink-0`} />
      )}
      <span className={`text-sm font-medium ${styles.textClass}`}>
        {deadline.label}
      </span>
    </div>
  );
}
