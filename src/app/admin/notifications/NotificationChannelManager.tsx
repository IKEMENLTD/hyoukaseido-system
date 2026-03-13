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
  type: 'slack' | 'line';
  channelName: string;
  webhookUrl: string;
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
  feedback_ready: 'フィードバック準備完了',
  okr_checkin_reminder: 'OKRチェックインリマインダー',
  okr_period_start: 'OKR期間開始',
  one_on_one_reminder: '1on1リマインダー',
  win_session_reminder: 'ウィンセッションリマインダー',
};

const ALL_EVENT_KEYS = Object.keys(EVENT_LABELS);

type ChannelType = 'slack' | 'line';

// ---------------------------------------------------------------------------
// フォーム状態
// ---------------------------------------------------------------------------

interface ChannelFormState {
  channelType: ChannelType;
  channelName: string;
  webhookUrl: string;
  selectedEvents: string[];
}

const INITIAL_FORM: ChannelFormState = {
  channelType: 'slack',
  channelName: '',
  webhookUrl: '',
  selectedEvents: [],
};

// ---------------------------------------------------------------------------
// コンポーネント
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

  const validate = useCallback((): string | null => {
    if (!form.channelName.trim()) return 'チャンネル名を入力してください';
    if (!form.webhookUrl.trim()) return 'Webhook URLを入力してください';
    if (form.selectedEvents.length === 0) return 'イベントを1つ以上選択してください';
    return null;
  }, [form]);

  // -----------------------------------------------------------------------
  // 追加保存
  // -----------------------------------------------------------------------

  const handleAdd = useCallback(async () => {
    const err = validate();
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

    const err = validate();
    if (err) {
      setErrorMessage(err);
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('notification_channels')
        .update({
          channel_name: form.channelName.trim(),
          webhook_url: form.webhookUrl.trim(),
          events: form.selectedEvents,
        })
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
        const body =
          channel.type === 'slack'
            ? { text: '[テスト] 評価制度システムからのテスト通知です' }
            : { messages: [{ type: 'text', text: '[テスト] 評価制度システムからのテスト通知です' }] };

        const response = await fetch(channel.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          setErrorMessage(`テスト送信失敗: HTTP ${response.status}`);
          return;
        }

        setSuccessMessage(`${channel.channelName} にテスト送信しました`);
      } catch {
        setErrorMessage('テスト送信に失敗しました。Webhook URLを確認してください。');
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
            {(['slack', 'line'] as const).map((t) => (
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
          placeholder="例: #general"
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
          placeholder="https://hooks.slack.com/services/..."
          className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none"
        />
      </div>

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
            LINE/Slack通知チャンネルの設定
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
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-12 text-center">
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
    </div>
  );
}
