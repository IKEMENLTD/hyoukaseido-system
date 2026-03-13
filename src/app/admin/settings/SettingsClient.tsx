// =============================================================================
// 組織設定 クライアントコンポーネント
// 組織情報、等級定義、バリュー項目のインライン編集機能
// =============================================================================

'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// -----------------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------------

interface Organization {
  id: string;
  name: string;
  fiscalYearStart: number;
}

interface GradeDefinition {
  grade: string;
  name: string;
  salaryRangeMin: number;
  salaryRangeMax: number;
  description: string;
  expectedMultiplier: number;
}

interface ValueItem {
  name: string;
  definition: string;
  axis: string;
  maxScore: number;
}

interface SettingsClientProps {
  org: Organization;
  gradeDefinitions: GradeDefinition[];
  valueItems: ValueItem[];
  orgId: string;
}

interface SectionMessage {
  type: 'success' | 'error';
  text: string;
}

// -----------------------------------------------------------------------------
// 入力スタイル定数
// -----------------------------------------------------------------------------

const INPUT_CLASS =
  'w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] px-3 py-2 text-sm focus:border-[#3b82f6] focus:outline-none';

const INPUT_DISABLED_CLASS =
  'w-full bg-[#111111] border border-[#333333] text-[#e5e5e5] text-sm px-3 py-2 outline-none opacity-60';

const EDIT_BTN_CLASS =
  'px-2 py-1 border border-[#3b82f6] text-[10px] text-[#3b82f6] hover:bg-[#3b82f6] hover:text-[#050505] transition-colors';

const SAVE_BTN_CLASS =
  'px-3 py-1 border border-[#3b82f6] bg-[#3b82f6] text-[10px] text-[#050505] font-bold hover:bg-[#2563eb] transition-colors';

const CANCEL_BTN_CLASS =
  'px-3 py-1 border border-[#333333] text-[10px] text-[#737373] hover:text-[#e5e5e5] hover:border-[#555555] transition-colors';

const SAVING_BTN_CLASS =
  'px-3 py-1 border border-[#333333] text-[10px] text-[#737373] cursor-not-allowed';

// =============================================================================
// メインコンポーネント
// =============================================================================

export default function SettingsClient({
  org,
  gradeDefinitions: initialGrades,
  valueItems: initialValues,
  orgId,
}: SettingsClientProps) {
  // ---------------------------------------------------------------------------
  // 組織情報 state
  // ---------------------------------------------------------------------------
  const [orgEditMode, setOrgEditMode] = useState(false);
  const [orgName, setOrgName] = useState(org.name);
  const [fiscalYearStart, setFiscalYearStart] = useState(org.fiscalYearStart);
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgMessage, setOrgMessage] = useState<SectionMessage | null>(null);

  // ---------------------------------------------------------------------------
  // 等級定義 state
  // ---------------------------------------------------------------------------
  const [gradeEditMode, setGradeEditMode] = useState(false);
  const [gradeDefinitions, setGradeDefinitions] = useState<GradeDefinition[]>(initialGrades);
  const [gradeBackup, setGradeBackup] = useState<GradeDefinition[]>(initialGrades);
  const [gradeSaving, setGradeSaving] = useState(false);
  const [gradeMessage, setGradeMessage] = useState<SectionMessage | null>(null);

  // ---------------------------------------------------------------------------
  // バリュー項目 state
  // ---------------------------------------------------------------------------
  const [valueEditMode, setValueEditMode] = useState(false);
  const [valueItems, setValueItems] = useState<ValueItem[]>(initialValues);
  const [valueBackup, setValueBackup] = useState<ValueItem[]>(initialValues);
  const [valueSaving, setValueSaving] = useState(false);
  const [valueMessage, setValueMessage] = useState<SectionMessage | null>(null);

  // ---------------------------------------------------------------------------
  // 組織情報 保存
  // ---------------------------------------------------------------------------
  const handleOrgSave = useCallback(async () => {
    if (!orgName.trim()) {
      setOrgMessage({ type: 'error', text: '組織名を入力してください' });
      return;
    }
    if (fiscalYearStart < 1 || fiscalYearStart > 12) {
      setOrgMessage({ type: 'error', text: '会計年度開始月は1~12の範囲で入力してください' });
      return;
    }

    setOrgSaving(true);
    setOrgMessage(null);

    const supabase = createClient();
    const { error } = await supabase
      .from('organizations')
      .update({
        name: orgName.trim(),
        fiscal_year_start: fiscalYearStart,
      })
      .eq('id', orgId);

    setOrgSaving(false);

    if (error) {
      setOrgMessage({ type: 'error', text: `保存に失敗しました: ${error.message}` });
      return;
    }

    setOrgMessage({ type: 'success', text: '組織情報を保存しました' });
    setOrgEditMode(false);
  }, [orgName, fiscalYearStart, orgId]);

  const handleOrgCancel = useCallback(() => {
    setOrgName(org.name);
    setFiscalYearStart(org.fiscalYearStart);
    setOrgEditMode(false);
    setOrgMessage(null);
  }, [org]);

  // ---------------------------------------------------------------------------
  // 等級定義 保存
  // ---------------------------------------------------------------------------
  const handleGradeEdit = useCallback(() => {
    setGradeBackup(gradeDefinitions.map((g) => ({ ...g })));
    setGradeEditMode(true);
    setGradeMessage(null);
  }, [gradeDefinitions]);

  const handleGradeCancel = useCallback(() => {
    setGradeDefinitions(gradeBackup.map((g) => ({ ...g })));
    setGradeEditMode(false);
    setGradeMessage(null);
  }, [gradeBackup]);

  const updateGrade = useCallback(
    (index: number, field: keyof Omit<GradeDefinition, 'grade'>, value: string | number) => {
      setGradeDefinitions((prev) => {
        const next = prev.map((g) => ({ ...g }));
        if (field === 'name' || field === 'description') {
          next[index] = { ...next[index], [field]: value as string };
        } else {
          next[index] = { ...next[index], [field]: Number(value) };
        }
        return next;
      });
    },
    [],
  );

  const handleGradeSave = useCallback(async () => {
    setGradeSaving(true);
    setGradeMessage(null);

    const supabase = createClient();
    let hasError = false;

    for (const grade of gradeDefinitions) {
      const { error } = await supabase
        .from('grade_definitions')
        .update({
          name: grade.name,
          description: grade.description,
          salary_range_min: grade.salaryRangeMin,
          salary_range_max: grade.salaryRangeMax,
          expected_multiplier: grade.expectedMultiplier,
        })
        .eq('grade', grade.grade)
        .eq('org_id', orgId);

      if (error) {
        setGradeMessage({ type: 'error', text: `${grade.grade}の保存に失敗: ${error.message}` });
        hasError = true;
        break;
      }
    }

    setGradeSaving(false);

    if (!hasError) {
      setGradeBackup(gradeDefinitions.map((g) => ({ ...g })));
      setGradeMessage({ type: 'success', text: '等級定義を保存しました' });
      setGradeEditMode(false);
    }
  }, [gradeDefinitions, orgId]);

  // ---------------------------------------------------------------------------
  // バリュー項目 保存
  // ---------------------------------------------------------------------------
  const handleValueEdit = useCallback(() => {
    setValueBackup(valueItems.map((v) => ({ ...v })));
    setValueEditMode(true);
    setValueMessage(null);
  }, [valueItems]);

  const handleValueCancel = useCallback(() => {
    setValueItems(valueBackup.map((v) => ({ ...v })));
    setValueEditMode(false);
    setValueMessage(null);
  }, [valueBackup]);

  const updateValue = useCallback(
    (index: number, field: keyof ValueItem, value: string | number) => {
      setValueItems((prev) => {
        const next = prev.map((v) => ({ ...v }));
        if (field === 'name' || field === 'definition' || field === 'axis') {
          next[index] = { ...next[index], [field]: value as string };
        } else {
          next[index] = { ...next[index], [field]: Number(value) };
        }
        return next;
      });
    },
    [],
  );

  const handleValueSave = useCallback(async () => {
    setValueSaving(true);
    setValueMessage(null);

    const supabase = createClient();
    let hasError = false;

    for (const item of valueItems) {
      const { error } = await supabase
        .from('value_items')
        .update({
          definition: item.definition,
          axis: item.axis,
          max_score: item.maxScore,
        })
        .eq('name', item.name)
        .eq('org_id', orgId);

      if (error) {
        setValueMessage({ type: 'error', text: `${item.name}の保存に失敗: ${error.message}` });
        hasError = true;
        break;
      }
    }

    setValueSaving(false);

    if (!hasError) {
      setValueBackup(valueItems.map((v) => ({ ...v })));
      setValueMessage({ type: 'success', text: 'バリュー項目を保存しました' });
      setValueEditMode(false);
    }
  }, [valueItems, orgId]);

  // ---------------------------------------------------------------------------
  // メッセージ表示ヘルパー
  // ---------------------------------------------------------------------------
  const renderMessage = (message: SectionMessage | null) => {
    if (!message) return null;
    const color = message.type === 'success' ? 'text-[#22d3ee]' : 'text-[#ef4444]';
    return <p className={`text-xs ${color} mt-2`}>{message.text}</p>;
  };

  // ===========================================================================
  // JSX
  // ===========================================================================

  return (
    <>
      {/* ------------------------------------------------------------------- */}
      {/* 組織情報 */}
      {/* ------------------------------------------------------------------- */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
            組織情報
          </h3>
          {!orgEditMode ? (
            <button
              type="button"
              className={EDIT_BTN_CLASS}
              onClick={() => {
                setOrgEditMode(true);
                setOrgMessage(null);
              }}
            >
              編集
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {orgSaving ? (
                <span className={SAVING_BTN_CLASS}>保存中...</span>
              ) : (
                <>
                  <button type="button" className={CANCEL_BTN_CLASS} onClick={handleOrgCancel}>
                    キャンセル
                  </button>
                  <button type="button" className={SAVE_BTN_CLASS} onClick={handleOrgSave}>
                    保存
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
                組織名
              </label>
              <input
                type="text"
                disabled={!orgEditMode}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className={orgEditMode ? INPUT_CLASS : INPUT_DISABLED_CLASS}
              />
            </div>
            <div>
              <label className="block text-xs text-[#737373] uppercase tracking-wider mb-2">
                会計年度開始月
              </label>
              <input
                type="number"
                disabled={!orgEditMode}
                min={1}
                max={12}
                value={fiscalYearStart}
                onChange={(e) => setFiscalYearStart(Number(e.target.value))}
                className={orgEditMode ? INPUT_CLASS : INPUT_DISABLED_CLASS}
              />
            </div>
          </div>
          {renderMessage(orgMessage)}
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 等級定義 */}
      {/* ------------------------------------------------------------------- */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
            等級定義
          </h3>
          {!gradeEditMode ? (
            <button
              type="button"
              className={EDIT_BTN_CLASS}
              onClick={handleGradeEdit}
            >
              編集
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {gradeSaving ? (
                <span className={SAVING_BTN_CLASS}>保存中...</span>
              ) : (
                <>
                  <button type="button" className={CANCEL_BTN_CLASS} onClick={handleGradeCancel}>
                    キャンセル
                  </button>
                  <button type="button" className={SAVE_BTN_CLASS} onClick={handleGradeSave}>
                    保存
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {gradeDefinitions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[#737373]">等級定義が登録されていません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#737373]">
                  <th className="px-4 py-2 text-center font-medium">等級</th>
                  <th className="px-4 py-2 text-left font-medium">名称</th>
                  <th className="px-4 py-2 text-left font-medium">概要</th>
                  <th className="px-4 py-2 text-right font-medium">給与レンジ</th>
                  <th className="px-4 py-2 text-right font-medium">期待倍率</th>
                </tr>
              </thead>
              <tbody>
                {gradeDefinitions.map((grade, idx) => (
                  <tr key={grade.grade} className="border-b border-[#111111]">
                    <td className="px-4 py-2 text-center">
                      <span className="px-2 py-0.5 border border-[#3b82f6] text-xs text-[#3b82f6] font-bold">
                        {grade.grade}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {gradeEditMode ? (
                        <input
                          type="text"
                          value={grade.name}
                          onChange={(e) => updateGrade(idx, 'name', e.target.value)}
                          className={INPUT_CLASS}
                        />
                      ) : (
                        <span className="text-[#e5e5e5] font-medium">{grade.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {gradeEditMode ? (
                        <input
                          type="text"
                          value={grade.description}
                          onChange={(e) => updateGrade(idx, 'description', e.target.value)}
                          className={INPUT_CLASS}
                        />
                      ) : (
                        <span className="text-[#737373] text-xs">{grade.description || '---'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {gradeEditMode ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={grade.salaryRangeMin}
                            onChange={(e) => updateGrade(idx, 'salaryRangeMin', e.target.value)}
                            className={`${INPUT_CLASS} w-28 text-right`}
                          />
                          <span className="text-[#737373] text-xs">~</span>
                          <input
                            type="number"
                            value={grade.salaryRangeMax}
                            onChange={(e) => updateGrade(idx, 'salaryRangeMax', e.target.value)}
                            className={`${INPUT_CLASS} w-28 text-right`}
                          />
                        </div>
                      ) : (
                        <span className="text-[#a3a3a3] text-xs block text-right">
                          {grade.salaryRangeMin.toLocaleString()} ~ {grade.salaryRangeMax.toLocaleString()}円
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {gradeEditMode ? (
                        <input
                          type="number"
                          step="0.1"
                          value={grade.expectedMultiplier}
                          onChange={(e) => updateGrade(idx, 'expectedMultiplier', e.target.value)}
                          className={`${INPUT_CLASS} w-20 text-right`}
                        />
                      ) : (
                        <span className="text-[#a3a3a3] block text-right">
                          x{grade.expectedMultiplier.toFixed(1)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {renderMessage(gradeMessage)}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* バリュー項目 */}
      {/* ------------------------------------------------------------------- */}
      <div className="border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[#a3a3a3] uppercase tracking-wider">
            バリュー項目 (全社共通)
          </h3>
          {!valueEditMode ? (
            <button
              type="button"
              className={EDIT_BTN_CLASS}
              onClick={handleValueEdit}
            >
              編集
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {valueSaving ? (
                <span className={SAVING_BTN_CLASS}>保存中...</span>
              ) : (
                <>
                  <button type="button" className={CANCEL_BTN_CLASS} onClick={handleValueCancel}>
                    キャンセル
                  </button>
                  <button type="button" className={SAVE_BTN_CLASS} onClick={handleValueSave}>
                    保存
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {valueItems.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[#737373]">バリュー項目が登録されていません</p>
          </div>
        ) : valueEditMode ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#737373]">
                  <th className="px-4 py-2 text-left font-medium">名称</th>
                  <th className="px-4 py-2 text-left font-medium">定義</th>
                  <th className="px-4 py-2 text-left font-medium">軸</th>
                  <th className="px-4 py-2 text-right font-medium">最大スコア</th>
                </tr>
              </thead>
              <tbody>
                {valueItems.map((item, idx) => (
                  <tr key={item.name} className="border-b border-[#111111]">
                    <td className="px-4 py-2">
                      <span className="text-[#e5e5e5] font-bold text-sm">{item.name}</span>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={item.definition}
                        onChange={(e) => updateValue(idx, 'definition', e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={item.axis}
                        onChange={(e) => updateValue(idx, 'axis', e.target.value)}
                        className={`${INPUT_CLASS} w-32`}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.maxScore}
                        onChange={(e) => updateValue(idx, 'maxScore', e.target.value)}
                        className={`${INPUT_CLASS} w-20 text-right`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {renderMessage(valueMessage)}
          </div>
        ) : (
          <div className="divide-y divide-[#111111]">
            {valueItems.map((item) => (
              <div key={item.name} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-[#e5e5e5] font-bold">{item.name}</div>
                  <div className="text-xs text-[#737373] mt-0.5">{item.definition}</div>
                </div>
                <div className="flex items-center gap-3">
                  {item.axis && (
                    <span className="px-2 py-0.5 border border-[#333333] text-[10px] text-[#404040]">
                      {item.axis}
                    </span>
                  )}
                  <span className="text-xs text-[#a3a3a3]">Max: {item.maxScore}</span>
                </div>
              </div>
            ))}
            {renderMessage(valueMessage)}
          </div>
        )}
      </div>
    </>
  );
}
