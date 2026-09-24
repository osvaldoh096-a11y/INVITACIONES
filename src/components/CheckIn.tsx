import { useEffect, useRef, useState } from 'react';

type ScanState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; fullName: string; checkedInAt: string; checkInCount: number }
  | { kind: 'repeat'; fullName: string; checkedInAt: string; checkInCount: number }
  | { kind: 'error'; message: string };

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

const READER_ID = 'qr-reader';
// Cuánto se queda congelado el resultado en pantalla antes de seguir
// escaneando solo. También se puede saltar antes con el botón.
const AUTO_RESUME_MS = 3000;

interface GuestSearchResult {
  id: string;
  fullName: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  checkInCount: number;
}

export default function CheckIn({ eventCode }: { eventCode: string }) {
  const [eventName, setEventName] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanState>({ kind: 'idle' });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GuestSearchResult[]>([]);

  const scannerRef = useRef<any>(null);
  const busyRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventCode]);

  async function handleScan(qrToken: string) {
    if (busyRef.current) return; // ya está pausado mostrando un resultado
    busyRef.current = true;

    // Pausa la cámara de verdad: deja de leer hasta que el humano vea
    // el resultado, en vez de seguir procesando el mismo QR de refilón.
    try {
      scannerRef.current?.pause(true);
    } catch {
      // si aún no había arrancado, no pasa nada
    }

    await submitCheckIn({ qrToken });
  }

  // Registro manual por nombre — mismo resultado que escanear, para cuando
  // el invitado llega sin su QR a la mano.
  async function handleManualCheckIn(guestId: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setSearchQuery('');
    setSearchResults([]);
    await submitCheckIn({ guestId });
  }

  async function submitCheckIn(payload: { qrToken?: string; guestId?: string }) {
    setScan({ kind: 'checking' });

    try {
      const res = await fetch(`/api/events/${eventCode}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setScan({ kind: 'error', message: data.error || 'Código no válido' });
      } else if (data.alreadyCheckedIn) {
        setScan({
          kind: 'repeat',
          fullName: data.guest.fullName,
          checkedInAt: data.guest.checkedInAt,
          checkInCount: data.guest.checkInCount,
        });
      } else {
        setScan({
          kind: 'ok',
          fullName: data.guest.fullName,
          checkedInAt: data.guest.checkedInAt,
          checkInCount: data.guest.checkInCount,
        });
      }
    } catch {
      setScan({ kind: 'error', message: 'No se pudo conectar. Intenta de nuevo.' });
    }

    resumeTimerRef.current = setTimeout(resumeScanning, AUTO_RESUME_MS);
  }

  function resumeScanning() {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    try {
      scannerRef.current?.resume();
    } catch {
      // no pasa nada si no estaba pausada (ej. venía de un registro manual)
    }
    busyRef.current = false;
    setScan({ kind: 'idle' });
  }

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/events/${eventCode}/guests?q=${encodeURIComponent(searchQuery.trim())}`,
        );
        const data = await res.json();
        setSearchResults(data.guests || []);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, eventCode]);

  const showResultOverlay = scan.kind === 'ok' || scan.kind === 'repeat' || scan.kind === 'error';

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Check-in</h1>
        {eventName && <p style={styles.subtitle}>{eventName}</p>}
      </div>

      <div style={styles.cameraWrap}>
        <div id={READER_ID} style={styles.reader} />
        {cameraError && <p style={styles.cameraError}>{cameraError}</p>}

        {showResultOverlay && (
          <div style={overlayStyle(scan.kind)} onClick={resumeScanning}>
            <div style={styles.overlayIcon}>
              {scan.kind === 'ok' && '✅'}
              {scan.kind === 'repeat' && '🔄'}
              {scan.kind === 'error' && '❌'}
            </div>
            {(scan.kind === 'ok' || scan.kind === 'repeat') && (
              <div style={styles.overlayName}>{scan.fullName}</div>
            )}
            <div style={styles.overlayMessage}>
              {scan.kind === 'ok' && `¡Bienvenido! Entrada registrada a las ${formatTime(scan.checkedInAt)}.`}
              {scan.kind === 'repeat' &&
                `Reingreso #${scan.checkInCount} — a las ${formatTime(scan.checkedInAt)}`}
              {scan.kind === 'error' && scan.message}
            </div>
            <div style={styles.overlayHint}>Toca la pantalla para seguir escaneando</div>
          </div>
        )}
      </div>

      {!showResultOverlay && (
        <div style={bannerStyle(scan.kind)}>
          {scan.kind === 'idle' && 'Apunta la cámara al código QR del invitado'}
          {scan.kind === 'checking' && 'Verificando...'}
        </div>
      )}

      <div style={styles.searchBox}>
        <p style={styles.searchLabel}>¿Llegó sin su QR? Busca su nombre</p>
        <input
          style={styles.searchInput}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Escribe el nombre..."
        />
        {searchResults.length > 0 && (
          <div style={styles.searchResults}>
            {searchResults.map((g) => (
              <button
                key={g.id}
                style={styles.searchResultItem}
                onClick={() => handleManualCheckIn(g.id)}
              >
                <span>{g.fullName}</span>
                {g.checkedIn && (
                  <span style={styles.searchResultBadge}>
                    ya entró ({g.checkInCount}x)
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function bannerStyle(kind: ScanState['kind']): React.CSSProperties {
  return {
    marginTop: 16,
    padding: '16px 20px',
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 600,
    textAlign: 'center',
    background: '#f3f4f6',
    color: '#374151',
  };
}

function overlayStyle(kind: ScanState['kind']): React.CSSProperties {
  const colors: Record<string, { bg: string; text: string }> = {
    ok: { bg: '#166534', text: 'white' },
    repeat: { bg: '#1d4ed8', text: 'white' },
    error: { bg: '#991b1b', text: 'white' },
  };
  const c = colors[kind] ?? colors.error;
  return {
    position: 'absolute',
    inset: 0,
    background: c.bg,
    color: c.text,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
    textAlign: 'center',
    cursor: 'pointer',
  };
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
  cameraWrap: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    background: '#000',
    aspectRatio: '3 / 4',
  },
  reader: { width: '100%', height: '100%' },
  cameraError: { color: '#991b1b', padding: 16, background: '#fee2e2', margin: 0 },
  overlayIcon: { fontSize: 56, lineHeight: 1 },
  overlayName: { fontSize: 26, fontWeight: 700 },
  overlayMessage: { fontSize: 16, opacity: 0.9 },
  overlayHint: { fontSize: 13, opacity: 0.7, marginTop: 12 },
  searchBox: { marginTop: 20 },
  searchLabel: { fontSize: 13, color: '#6b7280', margin: '0 0 6px' },
  searchInput: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    fontSize: 15,
    boxSizing: 'border-box',
  },
  searchResults: {
    marginTop: 8,
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
  },
  searchResultItem: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    background: 'white',
    border: 'none',
    borderBottom: '1px solid #f3f4f6',
    fontSize: 15,
    textAlign: 'left',
    cursor: 'pointer',
  },
  searchResultBadge: { fontSize: 12, color: '#6b7280' },
};
