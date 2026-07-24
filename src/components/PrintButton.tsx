'use client';

export default function PrintButton({ label = '🖨️ Imprimir / Salvar PDF' }: { label?: string }) {
  return (
    <button type="button" className="btn-primary print:hidden" onClick={() => window.print()}>
      {label}
    </button>
  );
}
