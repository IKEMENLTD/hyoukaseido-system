// =============================================================================
// 通知チャネル管理コンポーネント (CRUD)
// チャンネルの追加・編集・有効/無効切替
// =============================================================================

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface NotificationChannel {
  id: string;
  type: 'slack' | 'line' | 'chatwork';
  channelName: string;
  webhookUrl: string;
  hasApiToken: boolean;
  isActive: boolean;
  events: string[];
  lastSentAt: string | null;
}

interface NotificationChannelManagerProps {
  channels: NotificationChannel[];
  orgId: string;
}

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const EVENT_LABELS: Record<string, string> = {
  eval_period_start: '評価期間開始',
  eval_submitted: '評価提出完了',
  eval_submission_reminder: '自己評価提出リマインダー',
  manager_eval_request: '上長評価依頼',
  calibration_start: 'キャリブレーション開始',
  calibration_complete: 'キャリブレーション完了',
  feedback_ready: 'フィードバック準備完了',
  okr_period_start: 'OKR期間開始',
  okr_checkin_reminder: 'OKRチェックインリマインダー',
  okr_review_deadline: 'OKR振り返り期限',
  crosssell_toss: 'トスアップ通知',
  crosssell_contracted: 'クロスセル成約',
  bonus_confirmed: 'ボーナス確定',
  one_on_one_reminder: '1on1リマインダー',
  win_session_reminder: 'ウィンセッションリマインダー',
};

const ALL_EVENT_KEYS = Object.keys(EVENT_LABELS);

type ChannelType = 'slack' | 'line' | 'chatwork';

// ---------------------------------------------------------------------------
// チャンネルタイプ別のプレースホルダー・ヘルプ
// ---------------------------------------------------------------------------

const CHANNEL_NAME_PLACEHOLDERS: Record<ChannelType, string> = {
  slack: '例: #general',
  line: '例: 評価通知グループ',
  chatwork: '例: 評価制度通知',
};

const WEBHOOK_URL_PLACEHOLDERS: Record<ChannelType, string> = {
  slack: 'https://hooks.slack.com/services/...',
  line: 'https://api.line.me/v2/bot/message/...',
  chatwork: 'https://api.chatwork.com/v2/rooms/{ルームID}/messages',
};

const WEBHOOK_URL_HELP: Record<ChannelType, string> = {
  slack: 'SlackアプリのIncoming Webhook URLを入力',
  line: 'LINE Messaging APIのWebhook URLを入力',
  chatwork: 'ChatWork APIのルームメッセージURL（https://api.chatwork.com/v2/rooms/ルームID/messages）を入力。APIトークンは環境変数 CHATWORK_API_TOKEN で設定',
};

// ---------------------------------------------------------------------------
// チャンネルタイプ別セットアップ手順
// ---------------------------------------------------------------------------

interface SetupStep {
  title: string;
  description: string;
}

interface SetupGuide {
  label: string;
  colorClass: string;
  borderClass: string;
  steps: SetupStep[];
  notes: string[];
}

const SETUP_GUIDES: Record<ChannelType, SetupGuide> = {
  slack: {
    label: 'Slack',
    colorClass: 'text-[#22d3ee]',
    borderClass: 'border-[#22d3ee]',
    steps: [
      {
        title: 'Slackアプリを作成',
        description: 'https://api.slack.com/apps にアクセスし「Create New App」→「From scratch」を選択。ワークスペースを指定してアプリを作成',
      },
      {
        title: 'Incoming Webhooksを有効化',
        description: 'アプリ設定の「Incoming Webhooks」をONに切り替え、「Add New Webhook to Workspace」をクリック',
      },
      {
        title: '通知先チャンネルを選択',
        description: '通知を送信したいSlackチャンネル（例: #評価通知）を選択して「Allow」をクリック',
      },
      {
        title: 'Webhook URLをコピー',
        description: '生成されたURL（https://hooks.slack.com/services/T.../B.../...）をコピーし、下のフォームに貼り付け',
      },
    ],
    notes: [
      '1つのWebhook URLにつき1チャンネルへの送信',
      '複数チャンネルに送信する場合はそれぞれWebhookを作成',
    ],
  },
  line: {
    label: 'LINE',
    colorClass: 'text-[#22c55e]',
    borderClass: 'border-[#22c55e]',
    steps: [
      {
        title: 'LINE Developersにログイン',
        description: 'https://developers.line.biz にアクセスし、LINEアカウントでログイン',
      },
      {
        title: 'プロバイダーとチャネルを作成',
        description: '「プロバイダー作成」→「Messaging APIチャネル」を新規作成。チャネル名は「評価制度通知」等',
      },
      {
        title: 'チャネルアクセストークンを発行',
        description: 'チャネル設定の「Messaging API設定」タブ →「チャネルアクセストークン（長期）」を発行',
      },
      {
        title: 'Webhook URLを設定',
        description: 'Messaging API設定 → Webhook URLに https://api.line.me/v2/bot/message/push を使用。アクセストークンは環境変数 LINE_MESSAGING_CHANNEL_ACCESS_TOKEN に設定',
      },
      {
        title: '友だち追加',
        description: '通知を受け取るユーザーがLINE公式アカウントを友だち追加する必要あり。QRコードは「Messaging API設定」で確認可能',
      },
    ],
    notes: [
      'LINE通知はLINE公式アカウントからのメッセージとして送信される',
      '無料プランは月1,000通まで',
    ],
  },
  chatwork: {
    label: 'ChatWork',
    colorClass: 'text-[#e74c3c]',
    borderClass: 'border-[#e74c3c]',
    steps: [
      {
        title: 'ChatWork APIトークンを取得',
        description: 'ChatWorkにログイン → 右上のアイコン →「サービス連携」→「API」→「APIトークン」でトークンを取得。このトークンを環境変数 CHATWORK_API_TOKEN に設定',
      },
      {
        title: '通知先ルームIDを確認',
        description: 'ChatWorkで通知を送りたいチャットルームを開く。URLの「#!rid」以降の数字がルームID（例: https://www.chatwork.com/#!rid123456789 → ルームIDは 123456789）',
      },
      {
        title: 'Webhook URLを組み立て',
        description: 'https://api.chatwork.com/v2/rooms/{ルームID}/messages の形式でURLを作成（例: https://api.chatwork.com/v2/rooms/123456789/messages）',
      },
      {
        title: 'フォームに入力',
        description: 'チャンネル名に任意の名前、Webhook URLに上記URLを入力し、対象イベントを選択して保存',
      },
    ],
    notes: [
      'APIトークンはメッセージ送信者のアカウントに紐づく',
      'ルームの「メンバー」であるアカウントのトークンが必要',
      '個人DM通知を使う場合はOAuth連携も必要（プロフィール設定から連携）',
    ],
  },
};

// ---------------------------------------------------------------------------
// フォーム状態
// ---------------------------------------------------------------------------

interface ChannelFormState {
  channelType: ChannelType;
  channelName: string;
  webhookUrl: string;
  apiToken: string;
  selectedEvents: string[];
}

/** APIトークンが必要なチャンネルタイプ */
const REQUIRES_API_TOKEN: ReadonlySet<ChannelType> = new Set(['chatwork', 'line']);

const API_TOKEN_LABELS: Record<ChannelType, string> = {
  slack: '',
  chatwork: 'ChatWork APIトークン',
  line: 'LINE チャネルアクセストークン',
};

const API_TOKEN_PLACEHOLDERS: Record<ChannelType, string> = {
  slack: '',
  chatwork: 'ChatWork管理画面 > サービス連携 > API > APIトークンで取得',
  line: 'LINE Developers > チャネル設定 > チャネルアクセストークン（長期）で発行',
};

const INITIAL_FORM: ChannelFormState = {
  channelType: 'slack',
  channelName: '',
  webhookUrl: '',
  apiToken: '',
  selectedEvents: [],
};

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// セットアップガイドパネル（フォーム内 & 単体表示兼用）
// ---------------------------------------------------------------------------

function SetupGuidePanel({ type }: { type: ChannelType }) {
  const [expanded, setExpanded] = useState(false);
  const guide = SETUP_GUIDES[type];

  return (
    <div className={`border ${guide.borderClass}/30 bg-[#111111]`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <span className={`text-xs font-bold ${guide.colorClass}`}>
          {guide.label} セットアップ手順
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          className={`text-[#737373] transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="2,4 6,8 10,4" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {guide.steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <span className={`text-[10px] font-bold ${guide.colorClass} mt-0.5 shrink-0`}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="text-xs font-medium text-[#e5e5e5]">{step.title}</p>
                <p className="text-[11px] text-[#737373] mt-0.5 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}

          {guide.notes.length > 0 && (
            <div className="border-t border-[#1a1a1a] pt-3 mt-3">
              <p className="text-[10px] text-[#525252] uppercase tracking-wider mb-2">
                注意事項
              </p>
              {guide.notes.map((note, i) => (
                <p key={i} className="text-[11px] text-[#525252] leading-relaxed">
                  - {note}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

export default function NotificationChannelManager({
  channels,
  orgId,
}: NotificationChannelManagerProps) {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ChannelFormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // イベントチェックボックス操作
  // -----------------------------------------------------------------------

  const toggleEvent = useCallback((eventKey: string) => {
    setForm((prev) => {
      const exists = prev.selectedEvents.includes(eventKey);
      return {
        ...prev,
        selectedEvents: exists
          ? prev.selectedEvents.filter((e) => e !== eventKey)
          : [...prev.selectedEvents, eventKey],
      };
    });
  }, []);

  // -----------------------------------------------------------------------
  // 追加フォームを開く
  // -----------------------------------------------------------------------

  const openAddForm = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setErrorMessage(null);
    setShowAddForm(true);
  }, []);

  // -----------------------------------------------------------------------
  // 編集フォームを開く
  // -----------------------------------------------------------------------

  const openEditForm = useCallback((channel: NotificationChannel) => {
    setShowAddForm(false);
    setErrorMessage(null);
    setForm({
      channelType: channel.type,
      channelName: channel.channelName,
      webhookUrl: channel.webhookUrl,
      apiToken: '',
      selectedEvents: [...channel.events],
    });
    setEditingId(channel.id);
  }, []);

  // -----------------------------------------------------------------------
  // フォームを閉じる
  // -----------------------------------------------------------------------

  const closeForm = useCallback(() => {
    setShowAddForm(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setErrorMessage(null);
  }, []);

  // -----------------------------------------------------------------------
  // バリデーション
  // -----------------------------------------------------------------------

  const validate = useCallback((mode: 'add' | 'edit'): string | null => {
    if (!form.channelName.trim()) return 'チャンネル名を入力してください';
    if (!form.webhookUrl.trim()) return 'Webhook URLを入力してください';

    const url = form.webhookUrl.trim();
    if (!url.startsWith('https://')) return 'Webhook URLはhttps://で始まる必要があります';

    if (form.channelType === 'slack' && !url.includes('hooks.slack.com/')) {
      return 'Slack Webhook URLの形式が正しくありません（hooks.slack.com を含む必要があります）';
    }
    if (form.channelType === 'chatwork' && !url.includes('api.chatwork.com/v2/rooms/')) {
      return 'ChatWork URLの形式が正しくありません（https://api.chatwork.com/v2/rooms/{ルームID}/messages）';
    }
    if (form.channelType === 'line' && !url.includes('api.line.me/')) {
      return 'LINE URLの形式が正しくありません（api.line.me を含む必要があります）';
    }

    // 追加時はAPIトークン必須、編集時は空欄なら既存値を維持するのでOK
    if (mode === 'add' && REQUIRES_API_TOKEN.has(form.channelType) && !form.apiToken.trim()) {
      return `${API_TOKEN_LABELS[form.channelType]}を入力してください`;
    }

    if (form.selectedEvents.length === 0) return 'イベントを1つ以上選択してください';
    return null;
  }, [form]);

  // -----------------------------------------------------------------------
  // 追加保存
  // -----------------------------------------------------------------------

  const handleAdd = useCallback(async () => {
    const err = validate(editingId ? 'edit' : 'add');
    if (err) {
      setErrorMessage(err);
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.from('notification_channels').insert({
        org_id: orgId,
        type: form.channelType,
        channel_name: form.channelName.trim(),
        webhook_url: form.webhookUrl.trim(),
        api_token: REQUIRES_API_TOKEN.has(form.channelType) ? form.apiToken.trim() : null,
        is_active: true,
        events: form.selectedEvents,
      });

      if (error) {
        setErrorMessage(`保存に失敗しました: ${error.message}`);
        return;
      }

      closeForm();
      router.refresh();
    } catch {
      setErrorMessage('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  }, [form, orgId, validate, closeForm, router]);

  // -----------------------------------------------------------------------
  // 編集保存
  // -----------------------------------------------------------------------

  const handleEdit = useCallback(async () => {
    if (!editingId) return;

    const err = validate(editingId ? 'edit' : 'add');
    if (err) {
      setErrorMessage(err);
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const updateData: Record<string, unknown> = {
        channel_name: form.channelName.trim(),
        webhook_url: form.webhookUrl.trim(),
        events: form.selectedEvents,
      };
      // APIトークンが入力された場合のみ更新（空欄なら既存値を維持）
      if (form.apiToken.trim()) {
        updateData.api_token = form.apiToken.trim();
      }
      const { error } = await supabase
        .from('notification_channels')
        .update(updateData)
        .eq('id', editingId);

      if (error) {
        setErrorMessage(`更新に失敗しました: ${error.message}`);
        return;
      }

      closeForm();
      router.refresh();
    } catch {
      setErrorMessage('更新中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  }, [editingId, form, validate, closeForm, router]);

  // -----------------------------------------------------------------------
  // 有効/無効トグル
  // -----------------------------------------------------------------------

  const handleToggleActive = useCallback(
    async (channel: NotificationChannel) => {
      setTogglingId(channel.id);

      try {
        const supabase = createClient();
        const { error } = await supabase
          .from('notification_channels')
          .update({ is_active: !channel.isActive })
          .eq('id', channel.id);

        if (error) {
          setErrorMessage(`切替に失敗しました: ${error.message}`);
          return;
        }

        router.refresh();
      } catch {
        setErrorMessage('切替中にエラーが発生しました');
      } finally {
        setTogglingId(null);
      }
    },
    [router],
  );

  // -----------------------------------------------------------------------
  // テスト送信
  // -----------------------------------------------------------------------

  const handleTestSend = useCallback(
    async (channel: NotificationChannel) => {
      setTestingId(channel.id);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        // サーバーサイドAPI経由でテスト送信 (CORS回避 + webhook URL非露出)
        const response = await fetch('/api/notifications/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId: channel.id }),
          signal: AbortSignal.timeout(15000),
        });

        const data = (await response.json()) as {
          success?: boolean;
          error?: string;
          channelName?: string;
        };

        if (!response.ok) {
          setErrorMessage(data.error ?? `テスト送信失敗: HTTP ${response.status}`);
          return;
        }

        setSuccessMessage(`${channel.channelName} にテスト送信しました`);
      } catch {
        setErrorMessage('テスト送信に失敗しました。しばらく待ってから再試行してください。');
      } finally {
        setTestingId(null);
      }
    },
    [],
  );

  // -----------------------------------------------------------------------
  // フォーム描画
  // -----------------------------------------------------------------------

  const renderForm = (mode: 'add' | 'edit') => (
    <div className="border border-[#3b82f6] bg-[#0a0a0a] p-4 space-y-4">
      <h3 className="text-sm font-bold text-[#e5e5e5]">
        {mode === 'add' ? 'チャンネル追加' : 'チャンネル編集'}
      </h3>

      {/* チャンネルタイプ (追加時のみ) */}
      {mode === 'add' && (
        <div>
          <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-2">
            タイプ
          </div>
          <div className="flex items-center gap-4">
            {(['slack', 'line', 'chatwork'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="channelType"
                  value={t}
                  checked={form.channelType === t}
                  onChange={() => setForm((prev) => ({ ...prev, channelType: t }))}
                  className="accent-[#3b82f6]"
                />
                <span className="text-xs text-[#e5e5e5] uppercase font-bold">{t}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* セットアップガイド (タイプ連動) */}
      {mode === 'add' && <SetupGuidePanel type={form.channelType} />}

      {/* チャンネル名 */}
      <div>
        <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">
          チャンネル名
        </div>
        <input
          type="text"
          value={form.channelName}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, channelName: e.target.value }))
          }
          placeholder={CHANNEL_NAME_PLACEHOLDERS[form.channelType]}
          className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none"
        />
      </div>

      {/* Webhook URL */}
      <div>
        <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">
          Webhook URL
        </div>
        <input
          type="text"
          value={form.webhookUrl}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, webhookUrl: e.target.value }))
          }
          placeholder={WEBHOOK_URL_PLACEHOLDERS[form.channelType]}
          className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none"
        />
        <p className="text-[10px] text-[#525252] mt-1">
          {WEBHOOK_URL_HELP[form.channelType]}
        </p>
      </div>

      {/* APIトークン (ChatWork / LINE のみ) */}
      {REQUIRES_API_TOKEN.has(form.channelType) && (
        <div>
          <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">
            {API_TOKEN_LABELS[form.channelType]}
            <span className="text-[#ef4444] ml-1">必須</span>
          </div>
          <input
            type="password"
            value={form.apiToken}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, apiToken: e.target.value }))
            }
            placeholder={API_TOKEN_PLACEHOLDERS[form.channelType]}
            autoComplete="off"
            className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none font-mono"
          />
          {mode === 'edit' && (
            <p className="text-[10px] text-[#525252] mt-1">
              変更する場合のみ入力（空欄なら既存のトークンを維持）
            </p>
          )}
        </div>
      )}

      {/* イベント選択 */}
      <div>
        <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-2">
          対象イベント
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {ALL_EVENT_KEYS.map((eventKey) => (
            <label
              key={eventKey}
              className="flex items-center gap-2 px-3 py-2 border border-[#1a1a1a] cursor-pointer hover:border-[#333333]"
            >
              <input
                type="checkbox"
                checked={form.selectedEvents.includes(eventKey)}
                onChange={() => toggleEvent(eventKey)}
                className="accent-[#3b82f6]"
              />
              <span className="text-xs text-[#a3a3a3]">
                {EVENT_LABELS[eventKey]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* エラー */}
      {errorMessage && (
        <div className="text-xs text-[#ef4444] border border-[#ef4444] px-3 py-2">
          {errorMessage}
        </div>
      )}

      {/* ボタン */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={mode === 'add' ? handleAdd : handleEdit}
          className="px-4 py-2 bg-[#3b82f6] text-xs text-[#050505] font-bold hover:bg-[#2563eb] disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={closeForm}
          className="px-4 py-2 border border-[#333333] text-xs text-[#a3a3a3] hover:border-[#e5e5e5] hover:text-[#e5e5e5] disabled:opacity-50"
        >
          キャンセル
        </button>
      </div>
    </div>
  );

  // -----------------------------------------------------------------------
  // メイン描画
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            通知設定
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            LINE/Slack/ChatWork通知チャンネルの設定
          </p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          disabled={showAddForm}
          className="px-4 py-2 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold hover:bg-[#3b82f6] hover:text-[#050505] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          チャンネル追加
        </button>
      </div>

      {/* 追加フォーム */}
      {showAddForm && renderForm('add')}

      {/* グローバルメッセージ (トグル・テスト送信等) */}
      {errorMessage && !showAddForm && !editingId && (
        <div className="text-xs text-[#ef4444] border border-[#ef4444] px-3 py-2">
          {errorMessage}
        </div>
      )}
      {successMessage && !showAddForm && !editingId && (
        <div className="text-xs text-[#22d3ee] border border-[#22d3ee]/30 bg-[#22d3ee]/5 px-3 py-2">
          {successMessage}
        </div>
      )}

      {/* チャンネル一覧 */}
      <div className="space-y-4">
        {channels.length === 0 && !showAddForm && (
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-6 sm:p-12 text-center">
            <p className="text-sm text-[#737373]">
              通知チャンネルはまだ登録されていません
            </p>
          </div>
        )}

        {channels.map((channel) => (
          <div key={channel.id}>
            {editingId === channel.id ? (
              renderForm('edit')
            ) : (
              <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
                {/* ヘッダー */}
                <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 border text-[10px] font-bold uppercase ${
                        channel.type === 'slack'
                          ? 'text-[#22d3ee] border-[#22d3ee]'
                          : channel.type === 'chatwork'
                            ? 'text-[#e74c3c] border-[#e74c3c]'
                            : 'text-[#22c55e] border-[#22c55e]'
                      }`}
                    >
                      {channel.type}
                    </span>
                    <span className="text-sm font-bold text-[#e5e5e5]">
                      {channel.channelName}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold ${
                      channel.isActive ? 'text-[#22d3ee]' : 'text-[#404040]'
                    }`}
                  >
                    {channel.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* 内容 */}
                <div className="p-4 space-y-3">
                  {/* Webhook URL (マスク表示) */}
                  <div>
                    <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">
                      Webhook URL
                    </div>
                    <div className="text-xs text-[#404040] font-mono">
                      {channel.webhookUrl.substring(0, 30)}...
                    </div>
                  </div>

                  {/* APIトークン状態 (ChatWork / LINE のみ) */}
                  {(channel.type === 'chatwork' || channel.type === 'line') && (
                    <div>
                      <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">
                        {API_TOKEN_LABELS[channel.type]}
                      </div>
                      <div className={`text-xs font-medium ${channel.hasApiToken ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        {channel.hasApiToken ? '設定済み' : '未設定 - 編集から設定してください'}
                      </div>
                    </div>
                  )}

                  {/* 対象イベント */}
                  <div>
                    <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">
                      対象イベント
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {channel.events.map((event) => (
                        <span
                          key={event}
                          className="px-2 py-0.5 border border-[#333333] text-[10px] text-[#a3a3a3]"
                        >
                          {EVENT_LABELS[event] ?? event}
                        </span>
                      ))}
                      {channel.events.length === 0 && (
                        <span className="text-[10px] text-[#404040]">
                          イベント未設定
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 最終送信 */}
                  <div>
                    <div className="text-[10px] text-[#737373] uppercase tracking-wider mb-1">
                      最終送信
                    </div>
                    <div className="text-xs text-[#a3a3a3]">
                      {channel.lastSentAt ?? '未送信'}
                    </div>
                  </div>

                  {/* 操作ボタン */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#1a1a1a]">
                    <button
                      type="button"
                      onClick={() => openEditForm(channel)}
                      className="px-3 py-1 border border-[#333333] text-[10px] text-[#a3a3a3] hover:border-[#3b82f6] hover:text-[#3b82f6]"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      disabled={testingId === channel.id}
                      onClick={() => handleTestSend(channel)}
                      className={`px-3 py-1 border text-[10px] ${
                        testingId === channel.id
                          ? 'border-[#333333] text-[#737373] cursor-not-allowed opacity-50'
                          : 'border-[#333333] text-[#a3a3a3] hover:border-[#22d3ee] hover:text-[#22d3ee]'
                      }`}
                    >
                      {testingId === channel.id ? '送信中...' : 'テスト送信'}
                    </button>
                    <button
                      type="button"
                      disabled={togglingId === channel.id}
                      onClick={() => handleToggleActive(channel)}
                      className={`px-3 py-1 border text-[10px] ${
                        channel.isActive
                          ? 'border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-[#050505]'
                          : 'border-[#22d3ee] text-[#22d3ee] hover:bg-[#22d3ee] hover:text-[#050505]'
                      } disabled:opacity-50`}
                    >
                      {togglingId === channel.id
                        ? '処理中...'
                        : channel.isActive
                          ? '無効化'
                          : '有効化'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 利用可能イベント一覧 */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="border-b border-[#1a1a1a] px-4 py-3">
          <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
            利用可能な通知イベント
          </h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {ALL_EVENT_KEYS.map((event) => (
              <div
                key={event}
                className="flex items-center gap-2 px-3 py-2 border border-[#1a1a1a]"
              >
                <div className="w-2 h-2 bg-[#333333]" />
                <span className="text-xs text-[#a3a3a3]">
                  {EVENT_LABELS[event]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 各チャンネルのセットアップガイド */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="border-b border-[#1a1a1a] px-4 py-3">
          <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
            チャンネル追加ガイド
          </h3>
        </div>
        <div className="p-4 space-y-2">
          {(Object.keys(SETUP_GUIDES) as ChannelType[]).map((type) => (
            <SetupGuidePanel key={type} type={type} />
          ))}
        </div>
      </div>
    </div>
  );
}
