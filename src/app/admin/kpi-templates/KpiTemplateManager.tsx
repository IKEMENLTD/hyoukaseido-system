// =============================================================================
// KPIテンプレート管理 クライアントコンポーネント
// テンプレートCRUD + KPI項目の編集機能
// =============================================================================

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { EvalType } from '@/types/evaluation';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface KpiItemData {
  id: string;
  name: string;
  weight: number;
  measurementUnit: string;
  description: string;
  thresholdS: number | null;
  thresholdA: number | null;
  thresholdB: number | null;
  thresholdC: number | null;
  sortOrder: number;
}

interface KpiTemplateData {
  id: string;
  divisionId: string;
  divisionName: string;
  role: string;
  evalType: EvalType | null;
  version: number;
  isActive: boolean;
  items: KpiItemData[];
}

interface Division {
  id: string;
  name: string;
}

interface KpiTemplateManagerProps {
  templates: KpiTemplateData[];
  divisions: Division[];
}

type Mode = 'list' | 'create' | 'edit';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const EVAL_TYPE_LABELS: Record<EvalType, { label: string; color: string }> = {
  quantitative: { label: '定量', color: 'text-[#3b82f6] border-[#3b82f6]' },
  qualitative: { label: '定性', color: 'text-[#22d3ee] border-[#22d3ee]' },
  value: { label: 'バリュー', color: 'text-[#a855f7] border-[#a855f7]' },
};

const DEFAULT_EVAL_TYPE_CONFIG = {
  label: '未設定',
  color: 'text-[#737373] border-[#737373]',
};

const EVAL_TYPE_OPTIONS: { value: EvalType; label: string }[] = [
  { value: 'quantitative', label: '定量' },
  { value: 'qualitative', label: '定性' },
  { value: 'value', label: 'バリュー' },
];

const INPUT_CLASS =
  'w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none';

const INPUT_NARROW_CLASS =
  'bg-[#111111] border border-[#333333] text-[#e5e5e5] px-2 py-1 text-xs focus:border-[#3b82f6] focus:outline-none';

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function createEmptyItem(index: number): KpiItemData {
  return {
    id: `new-${Date.now()}-${index}`,
    name: '',
    weight: 0,
    measurementUnit: '',
    description: '',
    thresholdS: null,
    thresholdA: null,
    thresholdB: null,
    thresholdC: null,
    sortOrder: index,
  };
}

function parseNumericInput(value: string): number | null {
  if (value.trim() === '') return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export default function KpiTemplateManager({
  templates: initialTemplates,
  divisions,
}: KpiTemplateManagerProps) {
  const router = useRouter();

  // --- 状態 ---
  const [templates, setTemplates] = useState<KpiTemplateData[]>(initialTemplates);
  const [mode, setMode] = useState<Mode>('list');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingItems, setEditingItems] = useState<KpiItemData[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // テンプレート作成フォーム
  const [newDivisionId, setNewDivisionId] = useState(divisions[0]?.id ?? '');
  const [newRole, setNewRole] = useState('');
  const [newEvalType, setNewEvalType] = useState<EvalType>('quantitative');

  // --- メッセージの自動消去 ---
  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  // --- モード切替 ---
  const switchToList = useCallback(() => {
    setMode('list');
    setEditingTemplateId(null);
    setEditingItems([]);
    setDeletedItemIds([]);
  }, []);

  const switchToCreate = useCallback(() => {
    setMode('create');
    setMessage(null);
    setNewRole('');
    setNewEvalType('quantitative');
    if (divisions.length > 0) setNewDivisionId(divisions[0].id);
  }, [divisions]);

  const switchToEdit = useCallback(
    (templateId: string) => {
      const tpl = templates.find((t) => t.id === templateId);
      if (!tpl) return;
      setMode('edit');
      setEditingTemplateId(templateId);
      setEditingItems(tpl.items.map((item) => ({ ...item })));
      setDeletedItemIds([]);
      setMessage(null);
    },
    [templates],
  );

  // --- ウェイト合計 ---
  const editingTotalWeight = useMemo(
    () => editingItems.reduce((sum, item) => sum + item.weight, 0),
    [editingItems],
  );

  // --- テンプレート作成 ---
  const handleCreateTemplate = useCallback(async () => {
    if (!newDivisionId || !newRole.trim()) {
      showMessage('error', '事業部と職種を入力してください');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('kpi_templates')
        .insert({
          division_id: newDivisionId,
          role: newRole.trim(),
          eval_type: newEvalType,
          version: 1,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);
      if (!data) throw new Error('テンプレートの作成結果を取得できません');

      const divisionName = divisions.find((d) => d.id === newDivisionId)?.name ?? '不明';
      const newTemplate: KpiTemplateData = {
        id: data.id,
        divisionId: newDivisionId,
        divisionName,
        role: newRole.trim(),
        evalType: newEvalType,
        version: 1,
        isActive: true,
        items: [],
      };
      setTemplates((prev) => [...prev, newTemplate]);
      showMessage('success', 'テンプレートを作成しました');
      // 作成後、そのテンプレートの編集モードへ
      setMode('edit');
      setEditingTemplateId(data.id);
      setEditingItems([]);
      setDeletedItemIds([]);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '不明なエラーが発生しました';
      showMessage('error', `作成に失敗しました: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [newDivisionId, newRole, newEvalType, divisions, showMessage, router]);

  // --- テンプレート複製 ---
  const handleDuplicate = useCallback(
    async (templateId: string) => {
      const source = templates.find((t) => t.id === templateId);
      if (!source) return;
      setSaving(true);
      try {
        const supabase = createClient();
        // テンプレート本体を複製
        const { data: newTpl, error: tplError } = await supabase
          .from('kpi_templates')
          .insert({
            division_id: source.divisionId,
            role: source.role,
            eval_type: source.evalType,
            version: source.version + 1,
            is_active: true,
          })
          .select('id')
          .single();

        if (tplError || !newTpl) throw new Error(tplError?.message ?? '複製に失敗しました');

        // KPI項目を複製
        if (source.items.length > 0) {
          const { error: itemsError } = await supabase.from('kpi_items').insert(
            source.items.map((item) => ({
              template_id: newTpl.id,
              name: item.name,
              weight: item.weight,
              measurement_unit: item.measurementUnit || null,
              description: item.description || null,
              threshold_s: item.thresholdS,
              threshold_a: item.thresholdA,
              threshold_b: item.thresholdB,
              threshold_c: item.thresholdC,
              sort_order: item.sortOrder,
            })),
          );
          if (itemsError) throw new Error(`項目の複製に失敗しました: ${itemsError.message}`);
        }

        showMessage('success', `テンプレートを複製しました (v${source.version + 1})`);
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '不明なエラー';
        showMessage('error', msg);
      } finally {
        setSaving(false);
      }
    },
    [templates, showMessage, router],
  );

  // --- KPI項目の編集操作 ---
  const updateItem = useCallback(
    (index: number, field: keyof KpiItemData, value: string | number | null) => {
      setEditingItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
      );
    },
    [],
  );

  const addItem = useCallback(() => {
    setEditingItems((prev) => [...prev, createEmptyItem(prev.length)]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setEditingItems((prev) => {
      const item = prev[index];
      if (item && !item.id.startsWith('new-')) {
        setDeletedItemIds((ids) => [...ids, item.id]);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // --- KPI項目の保存 ---
  const handleSaveItems = useCallback(async () => {
    if (!editingTemplateId) return;
    setSaving(true);
    try {
      const supabase = createClient();

      // 削除
      for (const id of deletedItemIds) {
        const { error } = await supabase.from('kpi_items').delete().eq('id', id);
        if (error) throw new Error(`削除エラー: ${error.message}`);
      }

      // 新規項目
      const newItems = editingItems.filter((i) => i.id.startsWith('new-'));
      if (newItems.length > 0) {
        const { error } = await supabase.from('kpi_items').insert(
          newItems.map((item) => ({
            template_id: editingTemplateId,
            name: item.name,
            weight: item.weight,
            measurement_unit: item.measurementUnit || null,
            description: item.description || null,
            threshold_s: item.thresholdS,
            threshold_a: item.thresholdA,
            threshold_b: item.thresholdB,
            threshold_c: item.thresholdC,
            sort_order: item.sortOrder,
          })),
        );
        if (error) throw new Error(`新規項目の追加エラー: ${error.message}`);
      }

      // 既存項目の更新
      const existingItems = editingItems.filter((i) => !i.id.startsWith('new-'));
      for (const item of existingItems) {
        const { error } = await supabase
          .from('kpi_items')
          .update({
            name: item.name,
            weight: item.weight,
            measurement_unit: item.measurementUnit || null,
            description: item.description || null,
            threshold_s: item.thresholdS,
            threshold_a: item.thresholdA,
            threshold_b: item.thresholdB,
            threshold_c: item.thresholdC,
            sort_order: item.sortOrder,
          })
          .eq('id', item.id);
        if (error) throw new Error(`更新エラー: ${error.message}`);
      }

      showMessage('success', 'KPI項目を保存しました');
      router.refresh();

      // ローカルステートも更新
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplateId ? { ...t, items: [...editingItems] } : t,
        ),
      );
      switchToList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '不明なエラーが発生しました';
      showMessage('error', `保存に失敗しました: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [editingTemplateId, editingItems, deletedItemIds, showMessage, router, switchToList]);

  // --- 描画: テンプレート作成フォーム ---
  const renderCreateForm = () => (
    <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-3 sm:p-6 space-y-4">
      <h2 className="text-sm font-bold text-[#e5e5e5]">テンプレート新規作成</h2>

      {/* 事業部 */}
      <div>
        <label className="block text-xs text-[#a3a3a3] mb-1">事業部</label>
        <select
          className={INPUT_CLASS}
          value={newDivisionId}
          onChange={(e) => setNewDivisionId(e.target.value)}
        >
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* 職種 */}
      <div>
        <label className="block text-xs text-[#a3a3a3] mb-1">職種</label>
        <input
          type="text"
          className={INPUT_CLASS}
          placeholder="例: sales, engineer"
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
        />
      </div>

      {/* 評価種別 */}
      <div>
        <label className="block text-xs text-[#a3a3a3] mb-1">評価種別</label>
        <div className="flex items-center gap-4 mt-1">
          {EVAL_TYPE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="evalType"
                value={opt.value}
                checked={newEvalType === opt.value}
                onChange={() => setNewEvalType(opt.value)}
                className="accent-[#3b82f6]"
              />
              <span className="text-xs text-[#e5e5e5]">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ボタン */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={handleCreateTemplate}
          className="px-4 py-2 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold hover:bg-[#3b82f6]/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '保存中...' : '作成'}
        </button>
        <button
          type="button"
          onClick={switchToList}
          className="px-4 py-2 border border-[#333333] text-xs text-[#737373] hover:text-[#e5e5e5]"
        >
          キャンセル
        </button>
      </div>
    </div>
  );

  // --- 描画: KPI項目編集フォーム ---
  const renderEditForm = () => {
    const tpl = templates.find((t) => t.id === editingTemplateId);
    if (!tpl) return null;

    const typeConfig = tpl.evalType
      ? EVAL_TYPE_LABELS[tpl.evalType]
      : DEFAULT_EVAL_TYPE_CONFIG;

    return (
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        {/* ヘッダー */}
        <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold text-[#e5e5e5]">{tpl.divisionName}</span>
            <span className="text-xs text-[#737373]">{tpl.role}</span>
            <span className={`px-2 py-0.5 border text-[10px] font-bold ${typeConfig.color}`}>
              {typeConfig.label}
            </span>
          </div>
          <span className="text-xs text-[#3b82f6] font-bold">編集中</span>
        </div>

        {/* 項目一覧 */}
        <div className="p-4 space-y-3">
          {editingItems.length === 0 && (
            <p className="text-xs text-[#404040] text-center py-4">
              項目がありません。「項目追加」ボタンで追加してください。
            </p>
          )}

          {editingItems.map((item, idx) => (
            <div key={item.id} className="border border-[#1a1a1a] p-3 space-y-2">
              {/* 行1: 番号+名前 */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#404040] w-5 shrink-0">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  placeholder="項目名"
                  value={item.name}
                  onChange={(e) => updateItem(idx, 'name', e.target.value)}
                  className={`${INPUT_NARROW_CLASS} flex-1`}
                />
              </div>

              {/* 行2: ウェイト + 単位 + 削除 */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="WT%"
                    value={item.weight}
                    onChange={(e) => updateItem(idx, 'weight', Number(e.target.value) || 0)}
                    className={`${INPUT_NARROW_CLASS} w-16 text-right`}
                  />
                  <span className="text-[10px] text-[#737373]">%</span>
                </div>
                <input
                  type="text"
                  placeholder="単位"
                  value={item.measurementUnit}
                  onChange={(e) => updateItem(idx, 'measurementUnit', e.target.value)}
                  className={`${INPUT_NARROW_CLASS} w-20`}
                />
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="px-2 py-1 border border-red-900/50 text-[10px] text-red-400 hover:bg-red-950/30"
                >
                  削除
                </button>
              </div>

              {/* 行3: 説明文 */}
              <input
                type="text"
                placeholder="説明文"
                value={item.description}
                onChange={(e) => updateItem(idx, 'description', e.target.value)}
                className={`${INPUT_NARROW_CLASS} w-full`}
              />

              {/* 行4: S/A/B/C 閾値 (2x2グリッド) */}
              <div>
                <span className="text-[10px] text-[#737373] mb-1 block">閾値</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['S', 'A', 'B', 'C'] as const).map((rank) => {
                    const fieldKey = `threshold${rank}` as
                      | 'thresholdS'
                      | 'thresholdA'
                      | 'thresholdB'
                      | 'thresholdC';
                    return (
                      <div key={rank} className="flex items-center gap-1">
                        <span className="text-[10px] text-[#737373]">{rank}:</span>
                        <input
                          type="text"
                          placeholder="---"
                          value={item[fieldKey] ?? ''}
                          onChange={(e) =>
                            updateItem(idx, fieldKey, parseNumericInput(e.target.value))
                          }
                          className={`${INPUT_NARROW_CLASS} w-full text-right`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* 項目追加ボタン */}
          <button
            type="button"
            onClick={addItem}
            className="w-full border border-dashed border-[#333333] text-xs text-[#737373] py-2 hover:border-[#3b82f6] hover:text-[#3b82f6]"
          >
            + 項目追加
          </button>
        </div>

        {/* フッター */}
        <div className="border-t border-[#1a1a1a] px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-[#404040]">
              {editingItems.length}項目 / ウェイト合計: {editingTotalWeight}%
            </span>
            {editingTotalWeight !== 100 && editingItems.length > 0 && (
              <span className="text-[10px] text-[#f59e0b] font-bold">
                ウェイト合計が100%ではありません
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={switchToList}
              className="px-3 py-1.5 border border-[#333333] text-[10px] text-[#737373] hover:text-[#e5e5e5]"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveItems}
              className="px-3 py-1.5 border border-[#3b82f6] text-[10px] text-[#3b82f6] font-bold hover:bg-[#3b82f6]/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- 描画: テンプレートカード (一覧用) ---
  const renderTemplateCard = (template: KpiTemplateData) => {
    const typeConfig = template.evalType
      ? EVAL_TYPE_LABELS[template.evalType]
      : DEFAULT_EVAL_TYPE_CONFIG;
    const sortedItems = [...template.items].sort((a, b) => a.sortOrder - b.sortOrder);
    const totalWeight = sortedItems.reduce((sum, item) => sum + item.weight, 0);

    return (
      <div key={template.id} className="border border-[#1a1a1a] bg-[#0a0a0a]">
        {/* ヘッダー */}
        <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold text-[#e5e5e5]">{template.divisionName}</span>
            <span className="text-xs text-[#737373]">{template.role}</span>
            <span className={`px-2 py-0.5 border text-[10px] font-bold ${typeConfig.color}`}>
              {typeConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#404040]">v{template.version}</span>
            <span
              className={`text-[10px] font-bold ${
                template.isActive ? 'text-[#22d3ee]' : 'text-[#404040]'
              }`}
            >
              {template.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* 項目テーブル */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a1a1a] text-[#737373]">
                <th className="px-4 py-2 text-left font-medium">項目名</th>
                <th className="px-4 py-2 text-right font-medium">ウェイト</th>
                <th className="px-4 py-2 text-left font-medium">単位</th>
                <th className="px-4 py-2 text-left font-medium">バー</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-[#404040] text-xs">
                    項目がありません
                  </td>
                </tr>
              )}
              {sortedItems.map((item) => (
                <tr key={item.id} className="border-b border-[#111111]">
                  <td className="px-4 py-2 text-[#e5e5e5]">{item.name}</td>
                  <td className="px-4 py-2 text-right text-[#a3a3a3]">{item.weight}%</td>
                  <td className="px-4 py-2 text-[#737373]">{item.measurementUnit || '---'}</td>
                  <td className="px-4 py-2">
                    <div className="h-1.5 bg-[#1a1a1a] w-full max-w-24">
                      <div
                        className="h-full bg-[#3b82f6]"
                        style={{
                          width: `${(item.weight / (totalWeight > 0 ? totalWeight : 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* フッター */}
        <div className="border-t border-[#1a1a1a] px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] text-[#404040]">
            {sortedItems.length}項目 / ウェイト合計: {totalWeight}%
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => switchToEdit(template.id)}
              className="px-2 py-1 border border-[#333333] text-[10px] text-[#737373] hover:border-[#3b82f6] hover:text-[#3b82f6]"
            >
              編集
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleDuplicate(template.id)}
              className="px-2 py-1 border border-[#333333] text-[10px] text-[#737373] hover:border-[#22d3ee] hover:text-[#22d3ee] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '処理中...' : '複製'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- メイン描画 ---
  return (
    <div className="space-y-4">
      {/* メッセージ */}
      {message && (
        <div
          className={`border px-4 py-3 text-xs ${
            message.type === 'success'
              ? 'border-[#22d3ee]/30 bg-[#22d3ee]/5 text-[#22d3ee]'
              : 'border-red-900 bg-red-950/30 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* リスト or 作成 or 編集 */}
      {mode === 'create' && renderCreateForm()}

      {mode === 'edit' && renderEditForm()}

      {mode === 'list' && (
        <>
          {templates.length === 0 && (
            <div className="border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-8 text-center text-[#737373] text-sm">
              データがありません
            </div>
          )}
          <div className="space-y-4">
            {templates.map((tpl) => renderTemplateCard(tpl))}
          </div>
        </>
      )}

      {/* テンプレート追加ボタン (list / edit モード時) */}
      {mode === 'list' && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={switchToCreate}
            className="px-4 py-2 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold hover:bg-[#3b82f6]/10"
          >
            テンプレート追加
          </button>
        </div>
      )}
    </div>
  );
}
