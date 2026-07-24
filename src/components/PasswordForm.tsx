'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function PasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function save() {
    if (password.length < 8) {
      setState('error');
      setMessage('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setState('error');
      setMessage('As senhas não conferem.');
      return;
    }
    setState('saving');
    setMessage('');
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setState('error');
      setMessage('Não foi possível trocar a senha. Tente novamente.');
      return;
    }
    setState('ok');
    setMessage('Senha alterada com sucesso.');
    setPassword('');
    setConfirm('');
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="new-pass">Nova senha</label>
          <input className="input" id="new-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm-pass">Confirmar nova senha</label>
          <input className="input" id="confirm-pass" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
      </div>
      <button className="btn-primary" type="button" onClick={save} disabled={state === 'saving'}>
        {state === 'saving' ? 'Salvando…' : 'Trocar senha'}
      </button>
      {message && (
        <p className={state === 'error' ? 'text-red-700' : 'text-brand-700 font-medium'}>{message}</p>
      )}
    </div>
  );
}
