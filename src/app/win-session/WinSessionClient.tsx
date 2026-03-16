// =============================================================================
// ウィンセッション Client Component
// 投稿フォーム + セッション一覧表示
// =============================================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WinSessionEntry {
  id: string;
  entryMemberId: string;
  memberName: string;
  divisionName: string;
  winDescription: string;
  category: string | null;
}

interface WinSession {
  id: string;
  sessionDate: string;
  facilitator: string;
  entries: WinSessionEntry[];
}

interface WinSessionClientProps {
  sessions: WinSession[];
  memberId: string;
  memberDivisionId: string;
  orgId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  '受注': 'text-[#3b82f6] border-[#3b82f6]',
  '顧客成功': 'text-[#22d3ee] border-[#22d3ee]',
  'プロダクト': 'text-[#a855f7] border-[#a855f7]',
  'マーケ': 'text-[#f59e0b] border-[#f59e0b]',
  'クロスセル': 'text-[#22d3ee] border-[#22d3ee]',
  'その他': 'text-[#a3a3a3] border-[#333333]',
};

const CATEGORY_OPTIONS = [
  '受注',
  '顧客成功',
  'プロダクト',
  'マーケ',
  'クロスセル',
  'その他',
] as const;

interface FormMessage {
  type: 'success' | 'error';
  text: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WinSessionClient({
  sessions: initialSessions,
  memberId,
  memberDivisionId,
  orgId,
}: WinSessionClientProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState<WinSession[]>(initialSessions);
  const [category, setCategory] = useState('');
  const [winDescription, setWinDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<FormMessage | null>(null);

  const canSubmit = winDescription.trim().length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSaving(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const today = new Date().toISOString().split('T')[0];

      // 今日のセッションを検索、なければ作成
      let sessionId: string;

      const { data: existingSession } = await supabase
        .from('win_sessions')
        .select('id')
        .eq('session_date', today)
        .single();

      if (existingSession) {
        sessionId = existingSession.id as string;
      } else {
        const { data: newSession, error: sessionError } = await supabase
          .from('win_sessions')
          .insert({
            org_id: orgId,
            session_date: today,
            facilitator_id: memberId,
          })
          .select('id')
          .single();

        if (sessionError || !newSession) {
          setMessage({
            type: 'error',
            text: sessionError?.message ?? 'セッション作成に失敗しました',
          });
          setSaving(false);
          return;
        }
        sessionId = newSession.id as string;
      }

      // エントリー投稿
      const { error: entryError } = await supabase
        .from('win_session_entries')
        .insert({
          session_id: sessionId,
          member_id: memberId,
          division_id: memberDivisionId,
          win_description: winDescription.trim(),
          category: category || null,
        });

      if (entryError) {
        setMessage({
          type: 'error',
          text: entryError.message ?? '投稿に失敗しました',
        });
        setSaving(false);
        return;
      }

      // 成功: セッション一覧をリフレッシュ
      const { data: refreshedRaw } = await supabase
        .from('win_sessions')
        .select(`
          id, session_date,
          facilitator:members!win_sessions_facilitator_id_fkey (name),
          win_session_entries (
            id, member_id, win_description, category,
            members (name),
            divisions (name)
          )
        `)
        .order('session_date', { ascending: false })
        .limit(10);

      if (refreshedRaw) {
        const refreshed = (
          refreshedRaw as unknown as Array<{
            id: string;
            session_date: string;
            facilitator: { name: string } | null;
            win_session_entries: Array<{
              id: string;
              member_id: string;
              win_description: string;
              category: string | null;
              members: { name: string } | null;
              divisions: { name: string } | null;
            }>;
          }>
        ).map((s) => ({
          id: s.id,
          sessionDate: s.session_date,
          facilitator: s.facilitator?.name ?? '未設定',
          entries: (s.win_session_entries ?? []).map((e) => ({
            id: e.id,
            entryMemberId: e.member_id,
            memberName: e.members?.name ?? '不明',
            divisionName: e.divisions?.name ?? '不明',
            winDescription: e.win_description,
            category: e.category,
          })),
        }));
        setSessions(refreshed);
      }

      // フォームリセット
      setCategory('');
      setWinDescription('');
      setMessage({ type: 'success', text: 'WINを投稿しました' });
    } catch {
      setMessage({ type: 'error', text: '予期しないエラーが発生しました' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    setDeletingId(entryId);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase
      .from('win_session_entries')
      .delete()
      .eq('id', entryId)
      .eq('member_id', memberId); // 自分の投稿のみ削除可

    setDeletingId(null);

    if (error) {
      setMessage({ type: 'error', text: '削除に失敗しました' });
      return;
    }

    // ローカルステートから即座に反映
    setSessions((prev) =>
      prev.map((s) => ({
        ...s,
        entries: s.entries.filter((e) => e.id !== entryId),
      })).filter((s) => s.entries.length > 0)
    );
    setMessage({ type: 'success', text: '投稿を削除しました' });
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div>
          <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
            ウィンセッション
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            週次の成果共有セッション
          </p>
        </div>

        {/* メッセージ */}
        {message && (
          <div
            className={`border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-[#22c55e]/30 bg-[#22c55e]/5 text-[#22c55e]'
                : 'border-[#ef4444]/30 bg-[#ef4444]/5 text-[#ef4444]'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 新規エントリー投稿 */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              今週のWINを投稿
            </h3>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
                カテゴリ
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-[#111111] border border-[#333333] text-[#e5e5e5] text-sm px-3 py-2 focus:border-[#3b82f6] outline-none"
              >
                <option value="">カテゴリを選択</option>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
                WIN内容
              </label>
              <textarea
                rows={3}
                value={winDescription}
                onChange={(e) => setWinDescription(e.target.value)}
                placeholder="今週達成した成果、嬉しかったことを記入してください"
                className="w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] text-sm px-3 py-2 focus:border-[#3b82f6] outline-none resize-none placeholder:text-[#404040]"
              />
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className={`px-6 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                  canSubmit
                    ? 'bg-[#3b82f6] text-[#050505] hover:bg-[#2563eb] cursor-pointer'
                    : 'bg-[#333333] text-[#737373] cursor-not-allowed'
                }`}
              >
                {saving ? '投稿中...' : '投稿'}
              </button>
            </div>
          </div>
        </div>

        {/* 過去のセッション */}
        {sessions.length === 0 ? (
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-12 text-center">
            <p className="text-sm text-[#737373]">
              まだセッションがありません。最初のWINを投稿しましょう。
            </p>
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="border border-[#1a1a1a] bg-[#0a0a0a]">
              <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#e5e5e5] font-bold">
                    {session.sessionDate}
                  </span>
                  <span className="text-xs text-[#737373]">
                    {session.entries.length}件のWIN
                  </span>
                </div>
                <span className="text-xs text-[#404040]">
                  ファシリテーター: {session.facilitator}
                </span>
              </div>
              <div className="divide-y divide-[#111111]">
                {session.entries.map((entry) => {
                  const categoryColor = entry.category
                    ? CATEGORY_COLORS[entry.category] ?? 'text-[#a3a3a3] border-[#333333]'
                    : 'text-[#a3a3a3] border-[#333333]';
                  return (
                    <div key={entry.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#e5e5e5] font-bold">
                            {entry.memberName}
                          </span>
                          <span className="text-[10px] text-[#404040]">
                            {entry.divisionName}
                          </span>
                          {entry.category && (
                            <span
                              className={`px-2 py-0.5 border text-[10px] font-bold ${categoryColor}`}
                            >
                              {entry.category}
                            </span>
                          )}
                        </div>
                        {entry.entryMemberId === memberId && (
                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(entry.id)}
                            disabled={deletingId === entry.id}
                            className="px-2 py-0.5 border border-[#333333] text-[10px] text-[#737373] hover:border-[#ef4444] hover:text-[#ef4444] transition-colors disabled:opacity-50"
                          >
                            {deletingId === entry.id ? '...' : '削除'}
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-[#a3a3a3] leading-relaxed">
                        {entry.winDescription}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
