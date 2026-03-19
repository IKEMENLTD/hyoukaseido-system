'use client';

// =============================================================================
// 汎用フォーム自動下書き保存フック
// localStorageベースでデバウンス付き自動保存を行う
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

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
  const [restoredData, setRestoredData] = useState<T | null>(() => {
    const raw = safeGetItem(key);
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw) as { data: T; savedAt: string };
        return parsed.data;
      } catch {
        safeRemoveItem(key);
      }
    }
    return null;
  });
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
      const payload = JSON.stringify({
        data,
        savedAt: new Date().toISOString(),
      });
      safeSetItem(key, payload);
      setLastSaved(new Date());
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
  };
}
