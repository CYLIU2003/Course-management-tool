import { useEffect, useState } from 'react';

interface Faq { url: string; applicability: string; retrievedAt: string; entries: Array<{ question: string; answer: string }> }
export default function TapFaq() {
  const [faq, setFaq] = useState<Faq | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/tap/faq', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('TAPのFAQを読み込めませんでした。');
      setFaq(await response.json());
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(String(reason)); });
    return () => controller.abort();
  }, []);
  return <div>{error && <p role="alert">{error}</p>}{faq && <details><summary>教学課のTAP関連FAQ</summary><p>{faq.applicability}</p>
    {faq.entries.map((entry) => <div key={entry.question}><h4>{entry.question}</h4><p style={{ whiteSpace: 'pre-wrap' }}>{entry.answer}</p></div>)}
    <a href={faq.url} target="_blank" rel="noopener noreferrer">教学課の原文</a></details>}</div>;
}
