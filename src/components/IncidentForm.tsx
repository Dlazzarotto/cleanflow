'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createIncidentAction, requestLockoutAction } from '@/lib/actions/incidents';
import { distanceMeters, getPosition, GEOFENCE_METERS } from '@/lib/geo';

const KINDS = [
  { key: 'dano_pre_existente', label: '🔍 Já estava danificado quando chegamos' },
  { key: 'incidente_limpeza', label: '⚠️ Aconteceu durante a limpeza' },
  { key: 'seguranca', label: '🚨 Segurança / situação constrangedora' },
  { key: 'equipamento', label: '🧰 Equipamento ou produto' },
  { key: 'outro', label: '📝 Outro' },
];

const MOMENTS = [
  { key: 'chegada', label: 'Na chegada' },
  { key: 'durante', label: 'Durante o serviço' },
  { key: 'saida', label: 'Na saída' },
];

const CONTACT_ATTEMPTS = [
  'Toquei a campainha',
  'Bati na porta',
  'Liguei para o cliente',
  'Mandei mensagem',
  'Falei com o escritório',
];

const LOCKOUT_REASONS = [
  'Cliente não estava em casa',
  'Porta trancada e sem código/chave',
  'Código da porta não funcionou',
  'Alarme disparado / não consegui desativar',
  'Animal solto impedindo a entrada',
  'Prédio não liberou a entrada',
  'Outro motivo',
];

type Mode = 'closed' | 'incident' | 'lockout';

export default function IncidentForm({
  bookingId,
  clientId,
  companyId,
  clientName,
  clientLat,
  clientLng,
  canLockout,
}: {
  bookingId: string;
  clientId: string | null;
  companyId: string;
  clientName?: string;
  clientLat?: number | null;
  clientLng?: number | null;
  canLockout?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('closed');
  const [kind, setKind] = useState('dano_pre_existente');
  const [moment, setMoment] = useState('chegada');
  const [severity, setSeverity] = useState('media');
  const [reason, setReason] = useState(LOCKOUT_REASONS[0]);
  const [attempts, setAttempts] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState<string | null>(null);

  async function checkLocation() {
    const pos = await getPosition();
    if (!pos) {
      return {
        ok: false as const,
        error:
          'Não consegui obter sua localização. Ative o GPS e permita o acesso à localização para registrar.',
      };
    }
    if (clientLat == null || clientLng == null) {
      // Cliente sem coordenadas: registra assim mesmo, sem validar distancia
      return { ok: true as const, lat: pos.lat, lng: pos.lng, dist: null };
    }
    const dist = distanceMeters(pos.lat, pos.lng, clientLat, clientLng);
    if (dist > GEOFENCE_METERS) {
      return {
        ok: false as const,
        error: `Você está a ${dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : dist + ' m'} da casa. O registro só pode ser feito no local do serviço.`,
      };
    }
    return { ok: true as const, lat: pos.lat, lng: pos.lng, dist };
  }

  async function uploadPhotos(): Promise<string[] | null> {
    const supabase = createClient();
    const paths: string[] = [];
    for (const file of files.slice(0, 6)) {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${companyId}/${Date.now()}-${Math.random().toString(36).slice(-6)}.${ext}`;
      const { error } = await supabase.storage.from('ocorrencias').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) {
        setMsg(`Não foi possível enviar a foto: ${error.message}`);
        return null;
      }
      paths.push(path);
    }
    return paths;
  }

  async function submitIncident() {
    setBusy(true);
    setMsg('');
    const loc = await checkLocation();
    if (!loc.ok) {
      setMsg(loc.error);
      setBusy(false);
      return;
    }
    const paths = await uploadPhotos();
    if (!paths) {
      setBusy(false);
      return;
    }
    const res = await createIncidentAction({
      booking_id: bookingId,
      client_id: clientId,
      kind,
      moment,
      severity,
      description,
      photos: paths,
      lat: loc.lat,
      lng: loc.lng,
      distance_m: loc.dist,
    });
    if (res.ok) {
      setDone('Ocorrência registrada com data, hora e localização.');
      setDescription('');
      setFiles([]);
      router.refresh();
    } else {
      setMsg(res.error ?? 'Não foi possível registrar.');
    }
    setBusy(false);
  }

  async function submitLockout() {
    setBusy(true);
    setMsg('');
    const loc = await checkLocation();
    if (!loc.ok) {
      setMsg(loc.error);
      setBusy(false);
      return;
    }
    const paths = await uploadPhotos();
    if (!paths) {
      setBusy(false);
      return;
    }
    const res = await requestLockoutAction({
      booking_id: bookingId,
      client_id: clientId,
      reason,
      attempts,
      description,
      photos: paths,
      lat: loc.lat,
      lng: loc.lng,
      distance_m: loc.dist,
    });
    if (res.ok) {
      setDone(
        'Registrado. O escritório foi avisado e vai falar com o cliente antes de qualquer cobrança. Aguarde a orientação.'
      );
      setDescription('');
      setFiles([]);
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
            setDone(null);
            setMode('closed');
          }}
        >
          Fechar
        </button>
      </div>
    );
  }

  if (mode === 'closed') {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-ghost grow" type="button" onClick={() => setMode('incident')}>
          ⚠️ Reportar problema
        </button>
        {canLockout && (
          <button
            className="btn-ghost grow !border-sun !text-brand-900"
            type="button"
            onClick={() => setMode('lockout')}
          >
            🚪 Não consegui entrar
          </button>
        )}
      </div>
    );
  }

  const isLockout = mode === 'lockout';

  return (
    <div className={`mt-3 rounded-card border-2 bg-white p-4 ${isLockout ? 'border-sun' : 'border-brand-100'}`}>
      <p className="mb-1 font-semibold text-brand-900">
        {isLockout ? '🚪 Não consegui entrar' : '⚠️ Reportar problema'}
        {clientName ? ` — ${clientName}` : ''}
      </p>
      <p className="mb-3 text-sm text-brand-800">
        📍 O registro é feito com sua localização. Só funciona estando na casa do serviço.
        {isLockout && ' O escritório precisa aprovar antes de qualquer cobrança ao cliente.'}
      </p>

      <div className="space-y-4">
        {isLockout ? (
          <>
            <div>
              <label className="label" htmlFor={`reason-${bookingId}`}>Motivo</label>
              <select className="input" id={`reason-${bookingId}`} value={reason} onChange={(e) => setReason(e.target.value)}>
                {LOCKOUT_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="rounded-card bg-sun/10 p-3">
              <p className="mb-2 font-semibold text-brand-900">
                O que você já tentou? (marque ao menos uma)
              </p>
              {CONTACT_ATTEMPTS.map((a) => (
                <label key={a} className="flex min-h-touch cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-brand-700"
                    checked={attempts.includes(a)}
                    onChange={() =>
                      setAttempts((prev) =>
                        prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
                      )
                    }
                  />
                  {a}
                </label>
              ))}
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="label" htmlFor={`kind-${bookingId}`}>O que aconteceu</label>
              <select className="input" id={`kind-${bookingId}`} value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map((k) => (
                  <option key={k.key} value={k.key}>{k.label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label" htmlFor={`moment-${bookingId}`}>Quando</label>
                <select className="input" id={`moment-${bookingId}`} value={moment} onChange={(e) => setMoment(e.target.value)}>
                  {MOMENTS.map((m) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`sev-${bookingId}`}>Gravidade</label>
                <select className="input" id={`sev-${bookingId}`} value={severity} onChange={(e) => setSeverity(e.target.value)}>
                  <option value="baixa">Baixa — só registrar</option>
                  <option value="media">Média — avisar o escritório</option>
                  <option value="alta">Alta — precisa de atenção agora</option>
                </select>
              </div>
            </div>
          </>
        )}

        <div>
          <label className="label" htmlFor={`desc-${bookingId}`}>
            {isLockout ? 'Detalhes (opcional)' : 'Descreva com suas palavras'}
          </label>
          <textarea
            className="input"
            id={`desc-${bookingId}`}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              isLockout
                ? 'Ex: toquei a campainha por 10 minutos e liguei duas vezes'
                : 'Ex: o vidro do box já estava trincado quando entramos'
            }
          />
        </div>

        <div>
          <label className="label" htmlFor={`fotos-${bookingId}`}>
            Fotos {isLockout ? '(da porta / do local)' : '(antes e depois)'} — até 6
          </label>
          <input
            className="input !py-2"
            id={`fotos-${bookingId}`}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && (
            <p className="mt-1 text-sm text-brand-800">{files.length} foto(s) selecionada(s)</p>
          )}
        </div>

        {msg && <p className="rounded-card bg-red-50 p-3 text-red-800">{msg}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary grow"
            type="button"
            onClick={isLockout ? submitLockout : submitIncident}
            disabled={busy}
          >
            {busy ? 'Registrando…' : isLockout ? 'Avisar o escritório' : 'Registrar ocorrência'}
          </button>
          <button className="btn-ghost" type="button" onClick={() => { setMode('closed'); setMsg(''); }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
