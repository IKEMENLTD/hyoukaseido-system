// =============================================================================
// CSV出力ユーティリティ
// BOM付きUTF-8でCSV生成 → ブラウザダウンロード
// =============================================================================

/**
 * CSV値のエスケープ処理
 * カンマ・改行・ダブルクォートを含む場合はダブルクォートで囲む
 */
function escapeCsvValue(value: string): string {
  // 数式インジェクション防止: Excel等で数式として解釈される先頭文字をエスケープ
  let escaped = value;
  if (/^[=+\-@\t\r]/.test(escaped)) {
    escaped = `'${escaped}`;
  }
  if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"') || escaped !== value) {
    return `"${escaped.replace(/"/g, '""')}"`;
  }
  return escaped;
}

/**
 * CSVファイルを生成してブラウザでダウンロードする
 * @param filename - ファイル名（.csv拡張子含む）
 * @param headers - ヘッダー行の配列
 * @param rows - データ行の二次元配列
 */
export function downloadCSV(
  filename: string,
  headers: string[],
  rows: string[][]
): void {
  const headerLine = headers.map(escapeCsvValue).join(',');
  const dataLines = rows.map((row) =>
    row.map(escapeCsvValue).join(',')
  );

  const csvContent = [headerLine, ...dataLines].join('\r\n');

  // BOM付きUTF-8（Excel日本語対応）
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
