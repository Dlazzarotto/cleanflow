'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateMyBookingStatusAction } from '@/lib/actions';

export default function CheckinButton({
  bookingId,
  to,
  label,
}: {
  bookingId: string;
  to: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function getPosition(): Promise<{ lat: number | null; lng: number | null }> {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) return resolve({ lat: null, lng: null });
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });
  }

  async function run() {
    setBusy(true);
    const { lat, lng } = await getPosition();
    try {
      await updateMyBookingStatusAction(bookingId, to, lat, lng);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn-primary w-full" type="button" onClick={run} disabled={busy}>
      {busy ? 'Registrando…' : label}
    </button>
  );
}
