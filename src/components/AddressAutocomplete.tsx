'use client';
import { useRef, useState } from 'react';

interface Suggestion {
  placeId: string;
  text: string;
}

export default function AddressAutocomplete() {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  function handleChange(text: string) {
    setValue(text);
    if (latRef.current) latRef.current.value = '';
    if (lngRef.current) lngRef.current.value = '';
    if (debounce.current) clearTimeout(debounce.current);
    if (!apiKey || text.trim().length < 4) {
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
          body: JSON.stringify({ input: text, includedRegionCodes: ['us'] }),
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
    setValue(s.text);
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
      if (data.formattedAddress) setValue(data.formattedAddress);
      if (latRef.current) latRef.current.value = String(data.location?.latitude ?? '');
      if (lngRef.current) lngRef.current.value = String(data.location?.longitude ?? '');
    } catch {
      // mantém o texto selecionado mesmo sem coordenadas
    }
  }

  return (
    <div className="relative">
      <input
        className="input"
        id="address"
        name="address"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Digite o endereço para buscar"
        autoComplete="off"
      />
      <input type="hidden" name="lat" ref={latRef} />
      <input type="hidden" name="lng" ref={lngRef} />
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
