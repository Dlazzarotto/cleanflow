'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestExtraAction } from '@/lib/actions/extras';

interface CatalogItem {
  id: string;
  name: string;
}

export default function ExtraServiceForm({
  bookingId,
  catalog,
}: {
  bookingId: string;
  catalog: CatalogItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [escolha, setEscolha] = useState('');
  const [descricao, setDescricao] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState('');

  async function submit() {
    setBusy(true);
    setMsg('');
    const item = catalog.find((c) => c.id === escolha);
    const res = await requestExtraAction({
      booking_id: bookingId,
      extra_id: item ? item.id : null,
      description: item ? item.name : descricao,
    });
    if (res.ok) {
      setDone(
        item
          ? `${item.name} registrado. O escritório cuida da cobrança com o cliente.`
          : 'Pedido enviado ao escritório. Eles confirmam com o cliente antes de executar.'
      );
      setEscolha('');
      setDescricao('');
      router.refresh();
    } else {
      setMsg(res.error ?? 'Não foi possível registrar.');
    }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="mt-3 rounded-card bg-brand-50 p-3">
        <p className="font-medium text-brand-900">✓ {done}</p>
        <button
          className="btn-ghost mt-2"
          type="button"
          onClick={() => {
            setDone('');
            setOpen(false);
          }}
        >
          Fechar
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button className="btn-ghost mt-3 w-full" type="button" onClick={() => setOpen(true)}>
        ➕ Cliente pediu um serviço extra
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-card border-2 border-brand-100 bg-white p-4">
      <p className="mb-1 font-semibold text-brand-900">➕ Serviço extra pedido pelo cliente</p>
      <p className="mb-3 text-sm text-brand-800">
        Registre o que o cliente pediu. A cobrança é combinada pela empresa diretamente com o
        cliente — como está no contrato dele.
      </p>

      <div className="space-y-3">
        <div>
          <label className="label" htmlFor={`ex-${bookingId}`}>Serviço</label>
          <select
            className="input"
            id={`ex-${bookingId}`}
            value={escolha}
            onChange={(e) => setEscolha(e.target.value)}
          >
            <option value="">Outro (descrever abaixo)</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {!escolha && (
          <div>
            <label className="label" htmlFor={`exd-${bookingId}`}>O que o cliente pediu</label>
            <textarea
              className="input"
              id={`exd-${bookingId}`}
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: limpar a área da churrasqueira do quintal"
            />
            <p className="mt-1 text-sm text-brand-800">
              ⚠️ Não combine preço nem confirme o serviço com o cliente. O escritório retorna.
            </p>
          </div>
        )}

        {msg && <p className="rounded-card bg-red-50 p-3 text-red-800">{msg}</p>}

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary grow" type="button" onClick={submit} disabled={busy}>
            {busy ? 'Registrando…' : 'Enviar ao escritório'}
          </button>
          <button className="btn-ghost" type="button" onClick={() => setOpen(false)}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
