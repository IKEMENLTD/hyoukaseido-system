'use client';

import { useState } from 'react';
import type { Grade } from '@/types/evaluation';
import GradeBar from '@/components/shared/GradeBar';
import { createClient } from '@/lib/supabase/client';

interface UserProfile {
  name: string;
  email: string;
  division: string;
  grade: Grade;
}

interface NotificationSettings {
  lineEnabled: boolean;
  slackEnabled: boolean;
}

interface ProfileClientProps {
  profile: UserProfile;
  memberId: string;
  notificationSettings: NotificationSettings;
}

const GRADE_LABELS: Record<Grade, string> = {
  G1: 'G1 (メンバー)',
  G2: 'G2 (シニアメンバー)',
  G3: 'G3 (リーダー)',
  G4: 'G4 (事業部長)',
  G5: 'G5 (役員)',
};

export default function ProfileClient({ profile, memberId, notificationSettings }: ProfileClientProps) {
  const [notifications, setNotifications] = useState<NotificationSettings>(notificationSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  function handleToggle(channel: keyof NotificationSettings) {
    setNotifications((prev) => ({
      ...prev,
      [channel]: !prev[channel],
    }));
    setSaveMessage(null);
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveMessage(null);

    const supabase = createClient();
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        member_id: memberId,
        line_enabled: notifications.lineEnabled,
        slack_enabled: notifications.slackEnabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'member_id' });

    setIsSaving(false);
    if (error) {
      setSaveMessage('保存に失敗しました');
    } else {
      setSaveMessage('通知設定を保存しました');
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            プロフィール設定
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            アカウント情報と通知設定
          </p>
        </div>

        {/* 基本情報 (readonly) */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              基本情報
            </h3>
          </div>
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#111111] pb-3">
              <span className="text-xs text-[#737373]">名前</span>
              <span className="text-sm text-[#e5e5e5] font-medium">{profile.name}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[#111111] pb-3">
              <span className="text-xs text-[#737373]">メールアドレス</span>
              <span className="text-sm text-[#e5e5e5] font-medium">{profile.email}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[#111111] pb-3">
              <span className="text-xs text-[#737373]">所属事業部</span>
              <span className="text-sm text-[#e5e5e5] font-medium">{profile.division}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#737373]">等級</span>
              <span className="px-2 py-0.5 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold">
                {GRADE_LABELS[profile.grade]}
              </span>
            </div>
          </div>
          {/* 等級プログレス */}
          <div className="border-t border-[#1a1a1a] px-4 py-3">
            <GradeBar grade={profile.grade} />
          </div>
          <div className="border-t border-[#1a1a1a] px-4 py-2">
            <p className="text-[10px] text-[#737373]">
              基本情報の変更は管理者にお問い合わせください
            </p>
          </div>
        </div>

        {/* 通知設定 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              通知設定
            </h3>
          </div>
          <div className="px-4 py-4 space-y-4">
            {/* LINE通知 */}
            <div className="flex items-center justify-between border-b border-[#111111] pb-3">
              <div>
                <span className="text-sm text-[#e5e5e5]">LINE通知</span>
                <p className="text-[10px] text-[#737373] mt-0.5">
                  評価期間の開始・締切リマインド等をLINEで受信
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('lineEnabled')}
                className={`w-12 h-6 flex items-center border transition-colors ${
                  notifications.lineEnabled
                    ? 'bg-[#3b82f6] border-[#3b82f6] justify-end'
                    : 'bg-[#1a1a1a] border-[#333333] justify-start'
                }`}
              >
                <span
                  className={`block w-5 h-5 border transition-colors ${
                    notifications.lineEnabled
                      ? 'bg-[#e5e5e5] border-[#e5e5e5]'
                      : 'bg-[#737373] border-[#737373]'
                  }`}
                />
              </button>
            </div>

            {/* Slack通知 */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-[#e5e5e5]">Slack通知</span>
                <p className="text-[10px] text-[#737373] mt-0.5">
                  1on1リマインド・OKRチェックイン通知等をSlackで受信
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('slackEnabled')}
                className={`w-12 h-6 flex items-center border transition-colors ${
                  notifications.slackEnabled
                    ? 'bg-[#3b82f6] border-[#3b82f6] justify-end'
                    : 'bg-[#1a1a1a] border-[#333333] justify-start'
                }`}
              >
                <span
                  className={`block w-5 h-5 border transition-colors ${
                    notifications.slackEnabled
                      ? 'bg-[#e5e5e5] border-[#e5e5e5]'
                      : 'bg-[#737373] border-[#737373]'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="border-t border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
            {saveMessage !== null ? (
              <span className="text-xs text-[#22d3ee]">{saveMessage}</span>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`px-6 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                isSaving
                  ? 'bg-[#333333] text-[#737373] cursor-not-allowed'
                  : 'bg-[#3b82f6] text-[#050505] hover:bg-[#2563eb]'
              }`}
            >
              {isSaving ? '保存中...' : '通知設定を保存'}
            </button>
          </div>
        </div>

        {/* 戻るボタン */}
        <div className="flex items-center">
          <a
            href="/dashboard"
            className="px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#555555] transition-colors"
          >
            ダッシュボードへ戻る
          </a>
        </div>
      </div>
    </div>
  );
}
