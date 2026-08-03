'use client';
import { useEffect, useState } from 'react';

export default function CopyLinkButton({ slug }: { slug: string }) {
  const [link, setLink] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setLink(`${window.location.origin}/c/${slug}`);
  }, [slug]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // sem permissão de área de transferência
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className="input grow font-mono text-sm" value={link} readOnly onFocus={(e) => e.currentTarget.select()} />
      <button className="btn-ghost" type="button" onClick={copiar}>
        {copiado ? '✓ Copiado' : '📋 Copiar link'}
      </button>
      {link && (
        <a className="btn-ghost" href={link} target="_blank" rel="noreferrer">
          👁️ Ver página
        </a>
      )}
    </div>
  );
}
