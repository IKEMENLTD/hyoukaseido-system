'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Grade } from '@/types/evaluation';
import GradeBar from '@/components/shared/GradeBar';
import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserProfile {
  name: string;
  email: string;
  division: string;
  grade: Grade;
}

interface NotificationSettings {
  lineEnabled: boolean;
  slackEnabled: boolean;
  chatworkEnabled: boolean;
}

interface OAuthLink {
  provider: 'slack' | 'line' | 'chatwork';
  providerDisplayName: string | null;
  linkedAt: string;
}

type ProviderKey = OAuthLink['provider'];

interface ProfileClientProps {
  profile: UserProfile;
  memberId: string;
  notificationSettings: NotificationSettings;
  linkedAccounts: OAuthLink[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRADE_LABELS: Record<Grade, string> = {
  G1: 'G1 (メンバー)',
  G2: 'G2 (シニアメンバー)',
  G3: 'G3 (リーダー)',
  G4: 'G4 (事業部長)',
  G5: 'G5 (役員)',
};

interface ProviderMeta {
  label: string;
  description: string;
  colorClass: string;
  notifKey: keyof NotificationSettings;
}

const PROVIDER_META: Record<ProviderKey, ProviderMeta> = {
  slack: {
    label: 'Slack',
    description: '1on1リマインド・OKRチェックイン通知等をSlackで受信',
    colorClass: 'text-[#22d3ee]',
    notifKey: 'slackEnabled',
  },
  line: {
    label: 'LINE',
    description: '評価期間の開始・締切リマインド等をLINEで受信',
    colorClass: 'text-[#22c55e]',
    notifKey: 'lineEnabled',
  },
  chatwork: {
    label: 'ChatWork',
    description: '評価通知・フィードバック通知等をChatWorkで受信',
    colorClass: 'text-[#ef4444]',
    notifKey: 'chatworkEnabled',
  },
};

const PROVIDERS: ProviderKey[] = ['slack', 'line', 'chatwork'];

// ---------------------------------------------------------------------------
// SVG Icons (no emoji, SVG only)
// ---------------------------------------------------------------------------

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" />
      <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
      <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z" />
      <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z" />
      <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z" />
      <path d="M14 20.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5z" />
      <path d="M10 9.5C10 10.33 9.33 11 8.5 11h-5C2.67 11 2 10.33 2 9.5S2.67 8 3.5 8h5c.83 0 1.5.67 1.5 1.5z" />
      <path d="M10 3.5C10 4.33 9.33 5 8.5 5S7 4.33 7 3.5 7.67 2 8.5 2s1.5.67 1.5 1.5z" />
    </svg>
  );
}

function LineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M21 11c0-4.97-4.48-9-10-9S1 6.03 1 11c0 4.17 3.13 7.66 7.36 8.66.29.06.68.19.78.43.09.22.06.56.03.78l-.13.76c-.04.22-.17.87.76.47s5.04-2.97 6.88-5.08C19.13 14.36 21 12.85 21 11z" />
    </svg>
  );
}

function ChatWorkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="13" y2="13" />
    </svg>
  );
}

function ProviderIcon({ provider, className }: { provider: ProviderKey; className?: string }) {
  switch (provider) {
    case 'slack':
      return <SlackIcon className={className} />;
    case 'line':
      return <LineIcon className={className} />;
    case 'chatwork':
      return <ChatWorkIcon className={className} />;
  }
}

// ---------------------------------------------------------------------------
// Toggle Switch Component
// ---------------------------------------------------------------------------

function ToggleSwitch({
  enabled,
  onToggle,
  disabled,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`w-12 h-6 flex items-center border transition-colors ${
        disabled
          ? 'bg-[#111111] border-[#222222] cursor-not-allowed opacity-40 justify-start'
          : enabled
            ? 'bg-[#3b82f6] border-[#3b82f6] justify-end'
            : 'bg-[#1a1a1a] border-[#333333] justify-start'
      }`}
    >
      <span
        className={`block w-5 h-5 border transition-colors ${
          disabled
            ? 'bg-[#333333] border-[#333333]'
            : enabled
              ? 'bg-[#e5e5e5] border-[#e5e5e5]'
              : 'bg-[#737373] border-[#737373]'
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ProfileClient({
  profile,
  memberId,
  notificationSettings,
  linkedAccounts: initialLinkedAccounts,
}: ProfileClientProps) {
  const searchParams = useSearchParams();
  const linkedProvider = searchParams.get('linked');

  const [notifications, setNotifications] = useState<NotificationSettings>(notificationSettings);
  const [linkedAccounts, setLinkedAccounts] = useState<OAuthLink[]>(initialLinkedAccounts);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<ProviderKey | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Show success banner when redirected back from OAuth
  useEffect(() => {
    if (linkedProvider && PROVIDERS.includes(linkedProvider as ProviderKey)) {
      const meta = PROVIDER_META[linkedProvider as ProviderKey];
      setSuccessBanner(`${meta.label}のアカウント連携が完了しました`);

      const timer = setTimeout(() => {
        setSuccessBanner(null);
        // Remove query param from URL without reload
        const url = new URL(window.location.href);
        url.searchParams.delete('linked');
        window.history.replaceState({}, '', url.toString());
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [linkedProvider]);

  const isLinked = useCallback(
    (provider: ProviderKey): boolean => {
      return linkedAccounts.some((a) => a.provider === provider);
    },
    [linkedAccounts],
  );

  const getLink = useCallback(
    (provider: ProviderKey): OAuthLink | undefined => {
      return linkedAccounts.find((a) => a.provider === provider);
    },
    [linkedAccounts],
  );

  function handleToggle(key: keyof NotificationSettings) {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setSaveMessage(null);
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('notification_preferences')
        .upsert(
          {
            member_id: memberId,
            line_enabled: notifications.lineEnabled,
            slack_enabled: notifications.slackEnabled,
            chatwork_enabled: notifications.chatworkEnabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'member_id' },
        );

      if (error) {
        setSaveMessage('保存に失敗しました');
      } else {
        setSaveMessage('通知設定を保存しました');
      }
    } catch {
      setSaveMessage('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }

  function handleConnect(provider: ProviderKey) {
    window.location.href = `/api/oauth/${provider}/initiate`;
  }

  async function handleDisconnect(provider: ProviderKey) {
    const meta = PROVIDER_META[provider];
    const confirmed = window.confirm(`${meta.label}の連携を解除しますか？`);
    if (!confirmed) return;

    setDisconnecting(provider);

    try {
      const res = await fetch(`/api/oauth/${provider}/disconnect`, {
        method: 'POST',
      });

      if (res.ok) {
        setLinkedAccounts((prev) => prev.filter((a) => a.provider !== provider));
        // Also disable notifications for this provider
        const notifKey = meta.notifKey;
        setNotifications((prev) => ({ ...prev, [notifKey]: false }));
      } else {
        setSaveMessage(`${meta.label}の連携解除に失敗しました`);
      }
    } catch {
      setSaveMessage(`${meta.label}の連携解除に失敗しました`);
    } finally {
      setDisconnecting(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] p-3 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Success Banner */}
        {successBanner !== null && (
          <div className="border border-[#22c55e]/30 bg-[#22c55e]/5 px-4 py-3 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="square">
              <polyline points="3,8 7,12 13,4" />
            </svg>
            <span className="text-sm text-[#22c55e]">{successBanner}</span>
          </div>
        )}

        {/* Page Header */}
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            プロフィール設定
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            アカウント情報と通知設定
          </p>
        </div>

        {/* Basic Info (readonly) */}
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
          {/* Grade Progress */}
          <div className="border-t border-[#1a1a1a] px-4 py-3">
            <GradeBar grade={profile.grade} />
          </div>
          <div className="border-t border-[#1a1a1a] px-4 py-2">
            <p className="text-[10px] text-[#737373]">
              基本情報の変更は管理者にお問い合わせください
            </p>
          </div>
        </div>

        {/* Notification & OAuth Section */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              通知設定
            </h3>
          </div>

          <div className="px-4 py-4 space-y-4">
            {/* Description */}
            <div className="border border-[#1a1a1a] bg-[#111111] px-3 py-2">
              <p className="text-[11px] text-[#737373] leading-relaxed">
                アカウントを連携すると、個人宛の通知を受け取れます
              </p>
            </div>

            {/* Provider Cards */}
            {PROVIDERS.map((provider) => {
              const meta = PROVIDER_META[provider];
              const linked = isLinked(provider);
              const link = getLink(provider);
              const isDisconnecting = disconnecting === provider;

              return (
                <div
                  key={provider}
                  className="border border-[#1a1a1a] bg-[#0d0d0d]"
                >
                  <div className="px-4 py-3">
                    {/* Provider Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ProviderIcon provider={provider} className={meta.colorClass} />
                        <span className="text-sm font-medium text-[#e5e5e5]">
                          {meta.label}
                        </span>
                      </div>

                      {linked ? (
                        <button
                          type="button"
                          onClick={() => handleDisconnect(provider)}
                          disabled={isDisconnecting}
                          className={`px-3 py-1 border text-xs tracking-wider transition-colors ${
                            isDisconnecting
                              ? 'border-[#333333] text-[#737373] cursor-not-allowed'
                              : 'border-[#333333] text-[#a3a3a3] hover:border-[#ef4444] hover:text-[#ef4444]'
                          }`}
                        >
                          {isDisconnecting ? '解除中...' : '連携解除'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConnect(provider)}
                          className="px-3 py-1 bg-[#3b82f6] text-[#050505] text-xs font-bold tracking-wider hover:bg-[#2563eb] transition-colors"
                        >
                          アカウント連携
                        </button>
                      )}
                    </div>

                    {/* Link Status */}
                    <div className="mt-2">
                      {linked && link ? (
                        <span className="text-xs text-[#737373]">
                          連携済み: {link.providerDisplayName ?? meta.label}
                        </span>
                      ) : (
                        <span className="text-xs text-[#737373]">未連携</span>
                      )}
                    </div>

                    {/* Notification Toggle (only when linked) */}
                    {linked && (
                      <div className="mt-3 border-t border-[#1a1a1a] pt-3 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-[#e5e5e5]">通知を受け取る</span>
                          <p className="text-[10px] text-[#737373] mt-0.5">
                            {meta.description}
                          </p>
                        </div>
                        <ToggleSwitch
                          enabled={notifications[meta.notifKey]}
                          onToggle={() => handleToggle(meta.notifKey)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save Button */}
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

        {/* Back Button */}
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
