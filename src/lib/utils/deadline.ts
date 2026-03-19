// =============================================================================
// 期限計算ヘルパー
// end_date から残り日数・表示ラベル・深刻度を算出する
// =============================================================================

export type DeadlineSeverity = 'normal' | 'warning' | 'urgent' | 'overdue';

export interface DeadlineInfo {
  daysLeft: number;
  label: string;
  severity: DeadlineSeverity;
}

/**
 * end_date 文字列 (YYYY-MM-DD) から期限情報を算出する。
 * 日付の比較は日単位（時刻を無視）で行う。
 */
export function getDeadlineInfo(endDate: string): DeadlineInfo {
  const end = new Date(endDate + 'T23:59:59');
  const now = new Date();

  // 日単位の差分を計算（end_date の終わりまでの残り日数）
  const diffMs = end.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    const overdueDays = Math.abs(daysLeft);
    return {
      daysLeft,
      label: `期限を${overdueDays}日過ぎています`,
      severity: 'overdue',
    };
  }

  if (daysLeft <= 3) {
    return {
      daysLeft,
      label: `期限まであと${daysLeft}日 - お早めに提出してください`,
      severity: 'urgent',
    };
  }

  if (daysLeft <= 7) {
    return {
      daysLeft,
      label: `期限まであと${daysLeft}日`,
      severity: 'warning',
    };
  }

  // 8日以上
  const formattedEnd = endDate; // YYYY-MM-DD そのまま
  return {
    daysLeft,
    label: `期限: ${formattedEnd} (あと${daysLeft}日)`,
    severity: 'normal',
  };
}

/** severity に応じたスタイルクラスを返す */
export function getDeadlineStyles(severity: DeadlineSeverity): {
  containerClass: string;
  textClass: string;
  borderClass: string;
} {
  switch (severity) {
    case 'normal':
      return {
        containerClass: 'bg-[#1a1a1a]',
        textClass: 'text-[#a3a3a3]',
        borderClass: 'border-[#1a1a1a]',
      };
    case 'warning':
      return {
        containerClass: 'bg-[#f59e0b]/10',
        textClass: 'text-[#f59e0b]',
        borderClass: 'border-[#f59e0b]/30',
      };
    case 'urgent':
      return {
        containerClass: 'bg-[#ef4444]/10',
        textClass: 'text-[#ef4444]',
        borderClass: 'border-[#ef4444]/30',
      };
    case 'overdue':
      return {
        containerClass: 'bg-[#ef4444]/20',
        textClass: 'text-[#ef4444]',
        borderClass: 'border-[#ef4444]/40',
      };
  }
}
