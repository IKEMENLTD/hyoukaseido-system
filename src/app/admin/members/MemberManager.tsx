// =============================================================================
// メンバー管理クライアントコンポーネント
// CRUD操作: 追加・編集・ステータス切替・事業部配属
// =============================================================================

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Grade, MemberStatus } from '@/types/evaluation';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface DivisionMemberRow {
  division_id: string;
  role: string;
  is_primary: boolean;
  is_head: boolean;
  divisions: { name: string } | null;
}

interface MemberRow {
  id: string;
  name: string;
  email: string | null;
  auth_user_id: string | null;
  grade: Grade;
  monthly_salary: number;
  status: MemberStatus;
  hire_date: string | null;
  created_at: string;
  division_members: DivisionMemberRow[];
}

interface DivisionOption {
  id: string;
  name: string;
}

interface MemberManagerProps {
  initialMembers: MemberRow[];
  divisions: DivisionOption[];
  orgId: string;
}

/** メンバー追加/編集フォームの入力値 */
interface MemberFormData {
  name: string;
  email: string;
  grade: Grade;
  monthly_salary: string;
  hire_date: string;
  status: MemberStatus;
}

/** 事業部配属フォームの入力値 */
interface DivisionAssignFormData {
  division_id: string;
  role: string;
  weight: string;
  is_primary: boolean;
  is_head: boolean;
}

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const GRADES: readonly Grade[] = ['G1', 'G2', 'G3', 'G4', 'G5'] as const;

const GRADE_COLORS: Record<Grade, string> = {
  G1: 'text-[#a3a3a3] border-[#333333]',
  G2: 'text-[#a3a3a3] border-[#555555]',
  G3: 'text-[#22d3ee] border-[#22d3ee]',
  G4: 'text-[#3b82f6] border-[#3b82f6]',
  G5: 'text-[#a855f7] border-[#a855f7]',
};

const ROLE_OPTIONS = [
  { value: 'sales', label: '営業' },
  { value: 'engineer', label: 'エンジニア' },
  { value: 'cs', label: 'CS' },
  { value: 'bd', label: 'BD' },
  { value: 'marketing', label: 'マーケティング' },
  { value: 'hr', label: '人事' },
  { value: 'admin', label: '管理' },
] as const;

const EMPTY_FORM: MemberFormData = {
  name: '',
  email: '',
  grade: 'G1',
  monthly_salary: '',
  hire_date: '',
  status: 'active',
};

const EMPTY_DIVISION_FORM: DivisionAssignFormData = {
  division_id: '',
  role: 'sales',
  weight: '100',
  is_primary: true,
  is_head: false,
};

type ModalMode = 'closed' | 'add' | 'edit' | 'assign';

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export default function MemberManager({
  initialMembers,
  divisions,
  orgId,
}: MemberManagerProps) {
  const router = useRouter();
  const supabase = createClient();

  // --- State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [assignMemberId, setAssignMemberId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MemberFormData>(EMPTY_FORM);
  const [divisionForm, setDivisionForm] = useState<DivisionAssignFormData>(EMPTY_DIVISION_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- 派生データ ---
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return initialMembers;
    const q = searchQuery.trim().toLowerCase();
    return initialMembers.filter((m) => m.name.toLowerCase().includes(q));
  }, [initialMembers, searchQuery]);

  const activeCount = useMemo(
    () => initialMembers.filter((m) => m.status === 'active').length,
    [initialMembers]
  );
  const inactiveCount = useMemo(
    () => initialMembers.filter((m) => m.status === 'inactive').length,
    [initialMembers]
  );
  const linkedCount = useMemo(
    () => initialMembers.filter((m) => m.auth_user_id !== null).length,
    [initialMembers]
  );
  const pendingCount = useMemo(
    () => initialMembers.filter((m) => m.email && !m.auth_user_id).length,
    [initialMembers]
  );

  // --- ヘルパー ---
  const clearMessages = useCallback(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
  }, []);

  const closeModal = useCallback(() => {
    setModalMode('closed');
    setEditingMemberId(null);
    setAssignMemberId(null);
    setFormData(EMPTY_FORM);
    setDivisionForm(EMPTY_DIVISION_FORM);
    clearMessages();
  }, [clearMessages]);

  const openAddModal = useCallback(() => {
    setFormData(EMPTY_FORM);
    setModalMode('add');
    clearMessages();
  }, [clearMessages]);

  const openEditModal = useCallback(
    (member: MemberRow) => {
      setEditingMemberId(member.id);
      setFormData({
        name: member.name,
        email: member.email ?? '',
        grade: member.grade,
        monthly_salary: String(member.monthly_salary),
        hire_date: member.hire_date ?? '',
        status: member.status,
      });
      setModalMode('edit');
      clearMessages();
    },
    [clearMessages]
  );

  const openAssignModal = useCallback(
    (memberId: string) => {
      setAssignMemberId(memberId);
      setDivisionForm({
        ...EMPTY_DIVISION_FORM,
        division_id: divisions.length > 0 ? divisions[0].id : '',
      });
      setModalMode('assign');
      clearMessages();
    },
    [clearMessages, divisions]
  );

  // --- フォーム更新 ---
  const updateFormField = useCallback(
    <K extends keyof MemberFormData>(field: K, value: MemberFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const updateDivisionField = useCallback(
    <K extends keyof DivisionAssignFormData>(field: K, value: DivisionAssignFormData[K]) => {
      setDivisionForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // --- バリデーション ---
  const validateMemberForm = useCallback((): string | null => {
    if (!formData.name.trim()) return '名前を入力してください';
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      return 'メールアドレスの形式が正しくありません';
    }
    const salary = Number(formData.monthly_salary);
    if (!formData.monthly_salary || isNaN(salary) || salary <= 0) {
      return '月額給与を正しく入力してください';
    }
    return null;
  }, [formData]);

  const validateDivisionForm = useCallback((): string | null => {
    if (!divisionForm.division_id) return '事業部を選択してください';
    const weight = Number(divisionForm.weight);
    if (isNaN(weight) || weight < 1 || weight > 100) {
      return 'ウェイトは1〜100の範囲で入力してください';
    }
    return null;
  }, [divisionForm]);

  // --- CRUD操作 ---

  /** メンバー追加 */
  const handleAddMember = useCallback(async () => {
    const validationError = validateMemberForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from('members')
      .insert({
        org_id: orgId,
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        grade: formData.grade,
        monthly_salary: Number(formData.monthly_salary),
        hire_date: formData.hire_date || null,
        status: formData.status,
      })
      .select()
      .single();

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(`メンバーの追加に失敗しました: ${error.message}`);
      return;
    }

    setSuccessMessage('メンバーを追加しました');
    closeModal();
    router.refresh();
  }, [supabase, orgId, formData, validateMemberForm, closeModal, router]);

  /** メンバー編集 */
  const handleEditMember = useCallback(async () => {
    if (!editingMemberId) return;

    const validationError = validateMemberForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from('members')
      .update({
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        grade: formData.grade,
        monthly_salary: Number(formData.monthly_salary),
        hire_date: formData.hire_date || null,
        status: formData.status,
      })
      .eq('id', editingMemberId);

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(`メンバーの更新に失敗しました: ${error.message}`);
      return;
    }

    setSuccessMessage('メンバー情報を更新しました');
    closeModal();
    router.refresh();
  }, [supabase, editingMemberId, formData, validateMemberForm, closeModal, router]);

  /** ステータス切替 */
  const handleToggleStatus = useCallback(
    async (memberId: string, currentStatus: MemberStatus) => {
      const newStatus: MemberStatus = currentStatus === 'active' ? 'inactive' : 'active';
      setErrorMessage(null);

      const { error } = await supabase
        .from('members')
        .update({ status: newStatus })
        .eq('id', memberId);

      if (error) {
        setErrorMessage(`ステータスの変更に失敗しました: ${error.message}`);
        return;
      }

      setSuccessMessage(
        newStatus === 'active' ? 'メンバーを有効化しました' : 'メンバーを無効化しました'
      );
      router.refresh();
    },
    [supabase, router]
  );

  /** 事業部配属 */
  const handleAssignDivision = useCallback(async () => {
    if (!assignMemberId) return;

    const validationError = validateDivisionForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase.from('division_members').insert({
      member_id: assignMemberId,
      division_id: divisionForm.division_id,
      role: divisionForm.role,
      weight: Number(divisionForm.weight),
      is_primary: divisionForm.is_primary,
      is_head: divisionForm.is_head,
    });

    setIsSubmitting(false);

    if (error) {
      if (error.code === '23505') {
        setErrorMessage('このメンバーは既にこの事業部に配属されています');
      } else {
        setErrorMessage(`事業部配属に失敗しました: ${error.message}`);
      }
      return;
    }

    setSuccessMessage('事業部に配属しました');
    closeModal();
    router.refresh();
  }, [supabase, assignMemberId, divisionForm, validateDivisionForm, closeModal, router]);

  /** フォーム送信 */
  const handleSubmit = useCallback(() => {
    if (modalMode === 'add') return handleAddMember();
    if (modalMode === 'edit') return handleEditMember();
    if (modalMode === 'assign') return handleAssignDivision();
  }, [modalMode, handleAddMember, handleEditMember, handleAssignDivision]);

  // --- 描画 ---
  return (
    <div className="min-h-screen bg-[#050505] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ページヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#e5e5e5] tracking-wider">
              メンバー管理
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              組織メンバーの追加、編集、無効化
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 border border-[#3b82f6] bg-[#3b82f6] text-xs text-white font-bold hover:bg-[#2563eb] transition-colors"
          >
            メンバー追加
          </button>
        </div>

        {/* 成功メッセージ */}
        {successMessage && modalMode === 'closed' && (
          <div className="border border-emerald-900 bg-emerald-950/30 px-4 py-3 text-xs text-emerald-400 flex items-center justify-between">
            <span>{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-600 hover:text-emerald-400 text-xs ml-4"
            >
              閉じる
            </button>
          </div>
        )}

        {/* エラーメッセージ (モーダル外) */}
        {errorMessage && modalMode === 'closed' && (
          <div className="border border-red-900 bg-red-950/30 px-4 py-3 text-xs text-red-400">
            {errorMessage}
          </div>
        )}

        {/* サマリー */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">合計</div>
            <div className="text-2xl font-bold text-[#e5e5e5]">{initialMembers.length}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">アクティブ</div>
            <div className="text-2xl font-bold text-[#22d3ee]">{activeCount}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">ログイン済</div>
            <div className="text-2xl font-bold text-emerald-400">{linkedCount}</div>
          </div>
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="text-xs text-[#737373] uppercase tracking-wider mb-1">未ログイン</div>
            <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
          </div>
        </div>

        {/* メンバーテーブル */}
        <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
              メンバー一覧
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="名前で検索..."
                className="bg-[#111111] border border-[#333333] text-sm px-3 py-1 text-[#e5e5e5] placeholder:text-[#404040] outline-none w-48 focus:border-[#3b82f6]"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#737373]">
                  <th className="px-4 py-2 text-left font-medium">名前</th>
                  <th className="px-4 py-2 text-center font-medium">等級</th>
                  <th className="px-4 py-2 text-left font-medium">メール / 認証</th>
                  <th className="px-4 py-2 text-left font-medium">所属事業部</th>
                  <th className="px-4 py-2 text-right font-medium">月額給与</th>
                  <th className="px-4 py-2 text-center font-medium">ステータス</th>
                  <th className="px-4 py-2 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[#737373] text-sm">
                      {searchQuery.trim() ? '該当するメンバーが見つかりません' : 'データがありません'}
                    </td>
                  </tr>
                )}
                {filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    className={`border-b border-[#111111] hover:bg-[#111111] transition-colors ${
                      member.status === 'inactive' ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-[#e5e5e5] font-medium">{member.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 border text-xs font-bold ${GRADE_COLORS[member.grade]}`}
                      >
                        {member.grade}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[#737373]">
                          {member.email ?? '---'}
                        </span>
                        {member.auth_user_id ? (
                          <span className="text-[10px] font-bold text-emerald-400">
                            LINKED
                          </span>
                        ) : member.email ? (
                          <span className="text-[10px] font-bold text-amber-400">
                            PENDING
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-[#404040]">
                            NO EMAIL
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {member.division_members.map((dm) => (
                          <span
                            key={dm.division_id}
                            className={`text-xs px-2 py-0.5 ${
                              dm.is_primary
                                ? 'text-[#a3a3a3] border border-[#333333]'
                                : 'text-[#404040] border border-[#1a1a1a]'
                            }`}
                          >
                            {dm.divisions?.name ?? '不明'} ({dm.role})
                          </span>
                        ))}
                        {member.division_members.length === 0 && (
                          <span className="text-xs text-[#404040]">未配属</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-[#a3a3a3]">
                      {member.monthly_salary.toLocaleString()}円
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs font-bold ${
                          member.status === 'active' ? 'text-[#22d3ee]' : 'text-[#404040]'
                        }`}
                      >
                        {member.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(member)}
                          className="px-2 py-1 border border-[#333333] text-[10px] text-[#a3a3a3] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(member.id, member.status)}
                          className={`px-2 py-1 border text-[10px] transition-colors ${
                            member.status === 'active'
                              ? 'border-[#333333] text-[#a3a3a3] hover:border-red-700 hover:text-red-400'
                              : 'border-[#333333] text-[#a3a3a3] hover:border-emerald-700 hover:text-emerald-400'
                          }`}
                        >
                          {member.status === 'active' ? '無効化' : '有効化'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openAssignModal(member.id)}
                          className="px-2 py-1 border border-[#333333] text-[10px] text-[#a3a3a3] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors"
                        >
                          配属
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- モーダル --- */}
      {modalMode !== 'closed' && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] w-full max-w-lg mx-4">
            {/* モーダルヘッダー */}
            <div className="border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#e5e5e5] uppercase tracking-wider">
                {modalMode === 'add' && 'メンバー追加'}
                {modalMode === 'edit' && 'メンバー編集'}
                {modalMode === 'assign' && '事業部配属'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-[#737373] hover:text-[#e5e5e5] text-xs transition-colors"
              >
                閉じる
              </button>
            </div>

            {/* モーダルボディ */}
            <div className="px-6 py-4 space-y-4">
              {/* エラーメッセージ (モーダル内) */}
              {errorMessage && (
                <div className="border border-red-900 bg-red-950/30 px-3 py-2 text-xs text-red-400">
                  {errorMessage}
                </div>
              )}

              {/* メンバーフォーム (追加 / 編集) */}
              {(modalMode === 'add' || modalMode === 'edit') && (
                <>
                  {/* 名前 */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">名前</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateFormField('name', e.target.value)}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                      placeholder="山田 太郎"
                    />
                  </div>

                  {/* Googleメールアドレス */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">
                      Googleメールアドレス
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateFormField('email', e.target.value)}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                      placeholder="user@gmail.com"
                    />
                    <p className="text-[10px] text-[#404040] mt-1">
                      このメールでGoogleログインすると自動的にアカウントが紐づきます
                    </p>
                  </div>

                  {/* 等級 */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">等級</label>
                    <select
                      value={formData.grade}
                      onChange={(e) => updateFormField('grade', e.target.value as Grade)}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                    >
                      {GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 月額給与 */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">月額給与 (円)</label>
                    <input
                      type="number"
                      value={formData.monthly_salary}
                      onChange={(e) => updateFormField('monthly_salary', e.target.value)}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                      placeholder="300000"
                      min={0}
                    />
                  </div>

                  {/* 入社日 */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">入社日</label>
                    <input
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) => updateFormField('hire_date', e.target.value)}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                    />
                  </div>

                  {/* ステータス */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">ステータス</label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        updateFormField('status', e.target.value as MemberStatus)
                      }
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </>
              )}

              {/* 事業部配属フォーム */}
              {modalMode === 'assign' && (
                <>
                  {/* 事業部 */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">事業部</label>
                    <select
                      value={divisionForm.division_id}
                      onChange={(e) => updateDivisionField('division_id', e.target.value)}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                    >
                      {divisions.length === 0 && (
                        <option value="">事業部が登録されていません</option>
                      )}
                      {divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 職種 */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">職種</label>
                    <select
                      value={divisionForm.role}
                      onChange={(e) => updateDivisionField('role', e.target.value)}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* ウェイト */}
                  <div>
                    <label className="block text-xs text-[#737373] mb-1">ウェイト (%)</label>
                    <input
                      type="number"
                      value={divisionForm.weight}
                      onChange={(e) => updateDivisionField('weight', e.target.value)}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-sm px-3 py-2 text-white outline-none focus:border-[#3b82f6]"
                      min={1}
                      max={100}
                    />
                  </div>

                  {/* チェックボックス */}
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-xs text-[#a3a3a3] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={divisionForm.is_primary}
                        onChange={(e) => updateDivisionField('is_primary', e.target.checked)}
                        className="accent-[#3b82f6]"
                      />
                      主所属
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[#a3a3a3] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={divisionForm.is_head}
                        onChange={(e) => updateDivisionField('is_head', e.target.checked)}
                        className="accent-[#3b82f6]"
                      />
                      事業部長
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* モーダルフッター */}
            <div className="border-t border-[#1a1a1a] px-6 py-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="px-4 py-2 border border-[#1a1a1a] text-xs text-[#a3a3a3] hover:text-[#e5e5e5] hover:border-[#333333] transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#3b82f6] border border-[#3b82f6] text-xs text-white font-bold hover:bg-[#2563eb] transition-colors disabled:opacity-50"
              >
                {isSubmitting
                  ? '処理中...'
                  : modalMode === 'add'
                    ? '追加'
                    : modalMode === 'edit'
                      ? '更新'
                      : '配属'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
