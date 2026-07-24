'use client';
import { useRef, useState } from 'react';

interface Suggestion {
  placeId: string;
  text: string;
}

export interface PlaceResult {
  address: string;
  lat: number | null;
  lng: number | null;
  city: string;
}

interface Props {
  /** Valor inicial no modo nao controlado (ex: endereco ja salvo) */
  initialValue?: string;
  /** Modo controlado: valor do campo (opcional) */
  value?: string;
  /** Modo controlado: chamado a cada digitacao */
  onValueChange?: (text: string) => void;
  /** Chamado quando o usuario escolhe um endereco da lista */
  onPlace?: (place: PlaceResult) => void;
  /** Renderiza inputs hidden lat/lng para forms com server action (padrao: true) */
  withHiddenFields?: boolean;
  id?: string;
  name?: string;
}

function extractCity(formatted: string): string {
  // Formato tipico nos EUA: "123 Main St, Malden, MA 02148, USA"
  const parts = formatted.split(',').map((p) => p.trim());
  if (parts.length >= 3) {
    const statePart = parts[parts.length - 2]; // "MA 02148"
    const state = statePart.split(' ')[0] ?? '';
    return state ? `${parts[parts.length - 3]}, ${state}` : parts[parts.length - 3];
  }
  return parts[1] ?? '';
}

export default function AddressAutocomplete({
  initialValue,
  value,
  onValueChange,
  onPlace,
  withHiddenFields = true,
  id = 'address',
  name = 'address',
}: Props) {
  const [internal, setInternal] = useState(initialValue ?? '');
  const controlled = value !== undefined;
  const text = controlled ? value : internal;

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  function setText(t: string) {
    if (controlled) onValueChange?.(t);
    else setInternal(t);
  }

  function handleChange(t: string) {
    setText(t);
    if (latRef.current) latRef.current.value = '';
    if (lngRef.current) lngRef.current.value = '';
    if (debounce.current) clearTimeout(debounce.current);
    if (!apiKey || t.trim().length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
          },
          body: JSON.stringify({ input: t, includedRegionCodes: ['us'] }),
        });
        const data = await res.json();
        const items: Suggestion[] = (data.suggestions ?? [])
          .map((s: any) => s.placePrediction)
          .filter(Boolean)
          .map((p: any) => ({ placeId: p.placeId, text: p.text?.text ?? '' }));
        setSuggestions(items);
        setOpen(items.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 300);
  }

  async function handleSelect(s: Suggestion) {
    setText(s.text);
    setOpen(false);
    if (!apiKey) return;
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${s.placeId}`, {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'formattedAddress,location',
        },
      });
      const data = await res.json();
      const formatted: string = data.formattedAddress ?? s.text;
      const lat = data.location?.latitude ?? null;
      const lng = data.location?.longitude ?? null;
      setText(formatted);
      if (latRef.current) latRef.current.value = String(lat ?? '');
      if (lngRef.current) lngRef.current.value = String(lng ?? '');
      onPlace?.({ address: formatted, lat, lng, city: extractCity(formatted) });
    } catch {
      onPlace?.({ address: s.text, lat: null, lng: null, city: extractCity(s.text) });
    }
  }

  return (
    <div className="relative">
      <input
        className="input"
        id={id}
        name={name}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Digite o endereço para buscar"
        autoComplete="off"
      />
      {withHiddenFields && (
        <>
          <input type="hidden" name="lat" ref={latRef} />
          <input type="hidden" name="lng" ref={lngRef} />
        </>
      )}
      {open && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-card border border-brand-100 bg-white shadow-lg">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                className="block min-h-touch w-full px-4 py-3 text-left hover:bg-brand-50"
                onClick={() => handleSelect(s)}
              >
                {s.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
