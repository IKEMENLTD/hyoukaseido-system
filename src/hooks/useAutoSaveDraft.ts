'use client';

// =============================================================================
// 汎用フォーム自動下書き保存フック
// localStorageベースでデバウンス付き自動保存を行う
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface DraftWrapper<T> {
  data: T;
  savedAt: string;
}

function isDraftWrapper<T>(value: unknown): value is DraftWrapper<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'savedAt' in value
  );
}

interface UseAutoSaveDraftReturn<T> {
  /** 最終保存日時 (未保存ならnull) */
  lastSaved: Date | null;
  /** 下書きをクリアする (送信成功時に呼ぶ) */
  clearDraft: () => void;
  /** localStorageに下書きが存在するか */
  hasDraft: boolean;
  /** 復元された下書きデータ (存在しない場合null) */
  restoredData: T | null;
  /** 復元バナーを閉じる / 復元を破棄する */
  dismissRestore: () => void;
  /** 下書き保存時のISOタイムスタンプ (未保存 or 旧形式ならnull) */
  draftSavedAt: string | null;
}

// ---------------------------------------------------------------------------
// localStorage 安全操作ヘルパー
// ---------------------------------------------------------------------------

function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage がフルまたは無効な場合は無視
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  } catch {
    // 無視
  }
}

// ---------------------------------------------------------------------------
// フック本体
// ---------------------------------------------------------------------------

/**
 * フォームの自動下書き保存フック
 * @param key - localStorage key (ページ固有、例: "draft-self-quant-{evaluationId}")
 * @param data - 保存するフォームデータ
 * @param debounceMs - デバウンス間隔（デフォルト1000ms）
 * @returns { lastSaved, clearDraft, hasDraft, restoredData, dismissRestore }
 */
export function useAutoSaveDraft<T>(
  key: string,
  data: T,
  debounceMs: number = 1000,
): UseAutoSaveDraftReturn<T> {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // 初回マウント時にlocalStorageから復元（lazy initializer）
  // restoredData と draftSavedAt を同時に初期化するため、一度だけパースする
  const initialParsed = useRef<{ data: T | null; savedAt: string | null } | undefined>(undefined);
  if (initialParsed.current === undefined) {
    const raw = safeGetItem(key);
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isDraftWrapper<T>(parsed)) {
          initialParsed.current = { data: parsed.data, savedAt: parsed.savedAt };
        } else {
          // 旧形式: dataが直接保存されている、savedAtはnull
          initialParsed.current = { data: parsed as T, savedAt: null };
        }
      } catch {
        safeRemoveItem(key);
        initialParsed.current = { data: null, savedAt: null };
      }
    } else {
      initialParsed.current = { data: null, savedAt: null };
    }
  }

  const [restoredData, setRestoredData] = useState<T | null>(initialParsed.current.data);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(initialParsed.current.savedAt);
  const [hasDraft, setHasDraft] = useState(() => safeGetItem(key) !== null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);

  // -----------------------------------------------------------------------
  // data変更時のデバウンス保存 (初回マウント時はスキップ)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const now = new Date();
      const isoString = now.toISOString();
      const payload = JSON.stringify({
        data,
        savedAt: isoString,
      });
      safeSetItem(key, payload);
      setLastSaved(now);
      setDraftSavedAt(isoString);
      setHasDraft(true);
    }, debounceMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [key, data, debounceMs]);

  // -----------------------------------------------------------------------
  // clearDraft: 送信成功時に呼ぶ
  // -----------------------------------------------------------------------
  const clearDraft = useCallback(() => {
    safeRemoveItem(key);
    setLastSaved(null);
    setDraftSavedAt(null);
    setHasDraft(false);
    setRestoredData(null);
  }, [key]);

  // -----------------------------------------------------------------------
  // dismissRestore: 復元バナーを閉じる
  // -----------------------------------------------------------------------
  const dismissRestore = useCallback(() => {
    setRestoredData(null);
  }, []);

  return {
    lastSaved,
    clearDraft,
    hasDraft,
    restoredData,
    dismissRestore,
    draftSavedAt,
  };
}
