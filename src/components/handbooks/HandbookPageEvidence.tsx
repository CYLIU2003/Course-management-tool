import { useState } from 'react';
import type { HandbookPage, HandbookSource } from '../../core/handbooks';
import { localHandbookUrl } from '../../api/handbooks';

export default function HandbookPageEvidence({ source, page }: { source: HandbookSource; page: HandbookPage }) {
  const [showTables, setShowTables] = useState(false);
  return <details className="handbook-evidence">
    <summary><span>{source.faculty} {source.label} · PDF {page.page} / {source.pageCount}ページ</span>
      <span className="handbook-evidence-preview">{page.text.replace(/\s+/g, ' ').slice(0, 150) || '文字のないページ（原本を確認）'}</span></summary>
    <div className="handbook-actions">
      <a href={localHandbookUrl(source.localPath, page.page)} target="_blank" rel="noopener noreferrer">このページを原本で開く</a>
      <a href={`${source.url}#page=${page.page}`} target="_blank" rel="noopener noreferrer">大学サイトの原本</a>
      {page.tables.length > 0 && <button type="button" onClick={() => setShowTables(!showTables)}>{showTables ? '表を閉じる' : `科目・単位の表を表示`}</button>}
    </div>
    <pre className="handbook-page-text">{page.text || '文字情報はありません。原本の図・画像を確認してください。'}</pre>
    {showTables && <><p className="small">結合セルや記号の列は原本と照合してください。空欄は必要単位ゼロを意味しません。</p>
      {page.tables.map((table) => <div key={table.index} className="handbook-table-scroll"><table aria-label={`PDF ${page.page}ページの表 ${table.index + 1}`}><tbody>
        {table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, column) => <td key={column}>{cell ?? ''}</td>)}</tr>)}
      </tbody></table></div>)}</>}
  </details>;
}
