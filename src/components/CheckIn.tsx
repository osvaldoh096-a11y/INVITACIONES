import { useEffect, useRef, useState } from 'react';

type ScanState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; fullName: string }
  | { kind: 'repeat'; fullName: string; checkedInAt: string }
  | { kind: 'error'; message: string };

const READER_ID = 'qr-reader';
// Ignora un mismo código ya procesado por un ratito, para que no se
// vuelva a disparar mientras el QR sigue frente a la cámara.
const RESCAN_COOLDOWN_MS = 3000;

export default function CheckIn({ eventCode }: { eventCode: string }) {
  const [eventName, setEventName] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanState>({ kind: 'idle' });

  const scannerRef = useRef<any>(null);
  const busyRef = useRef(false);
  const lastTokenRef = useRef<{ token: string; at: number } | null>(null);

  useEffect(() => {
    fetch(`/api/events/${eventCode}`)
      .then((r) => r.json())
      .then((d) => setEventName(d.event?.eventName ?? null))
      .catch(() => {});
  }, [eventCode]);

  useEffect(() => {
    let cancelled = false;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(READER_ID);
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText: string) => handleScan(decodedText),
          () => {
            // sin QR en el cuadro actual — normal, no es un error real
          },
        )
        .catch((err: unknown) => {
          setCameraError(
            'No se pudo acceder a la cámara. Revisa los permisos del navegador y que uses https.',
          );
          console.error(err);
        });
    });

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventCode]);

  async function handleScan(qrToken: string) {
    const now = Date.now();
    const last = lastTokenRef.current;
    if (busyRef.current) return;
    if (last && last.token === qrToken && now - last.at < RESCAN_COOLDOWN_MS) return;

    busyRef.current = true;
    lastTokenRef.current = { token: qrToken, at: now };
    setScan({ kind: 'checking' });

    try {
      const res = await fetch(`/api/events/${eventCode}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken }),
      });
      const data = await res.json();

      if (!res.ok) {
        setScan({ kind: 'error', message: data.error || 'Código no válido' });
      } else if (data.alreadyCheckedIn) {
        setScan({ kind: 'repeat', fullName: data.guest.fullName, checkedInAt: data.guest.checkedInAt });
      } else {
        setScan({ kind: 'ok', fullName: data.guest.fullName });
      }
    } catch {
      setScan({ kind: 'error', message: 'No se pudo conectar. Intenta de nuevo.' });
    } finally {
      setTimeout(() => {
        busyRef.current = false;
      }, 1200);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Check-in</h1>
        {eventName && <p style={styles.subtitle}>{eventName}</p>}
      </div>

      <div style={styles.cameraWrap}>
        <div id={READER_ID} style={styles.reader} />
        {cameraError && <p style={styles.cameraError}>{cameraError}</p>}
      </div>

      <div style={bannerStyle(scan.kind)}>
        {scan.kind === 'idle' && 'Apunta la cámara al código QR del invitado'}
        {scan.kind === 'checking' && 'Verificando...'}
        {scan.kind === 'ok' && `✅ ${scan.fullName} — ¡bienvenido!`}
        {scan.kind === 'repeat' && `⚠️ ${scan.fullName} ya había entrado`}
        {scan.kind === 'error' && `❌ ${scan.message}`}
      </div>
    </div>
  );
}

function bannerStyle(kind: ScanState['kind']): React.CSSProperties {
  const base: React.CSSProperties = {
    marginTop: 16,
    padding: '16px 20px',
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 600,
    textAlign: 'center',
  };
  if (kind === 'ok') return { ...base, background: '#dcfce7', color: '#166534' };
  if (kind === 'repeat') return { ...base, background: '#fef9c3', color: '#854d0e' };
  if (kind === 'error') return { ...base, background: '#fee2e2', color: '#991b1b' };
  return { ...base, background: '#f3f4f6', color: '#374151' };
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 480,
    margin: '0 auto',
    padding: 20,
    fontFamily: 'system-ui, sans-serif',
  },
  header: { textAlign: 'center', marginBottom: 16 },
  title: { margin: 0, fontSize: 24 },
  subtitle: { margin: '4px 0 0', color: '#6b7280' },
  cameraWrap: { borderRadius: 16, overflow: 'hidden', background: '#000' },
  reader: { width: '100%' },
  cameraError: { color: '#991b1b', padding: 16, background: '#fee2e2', margin: 0 },
};
