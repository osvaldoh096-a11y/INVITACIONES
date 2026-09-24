import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { format } from 'date-fns';

interface InviteInfo {
  invitee: { displayName: string; maxPasses: number; status: string };
  event: { eventName: string; eventDate: string | null; location: string | null };
}

interface QrGuest {
  fullName: string;
  qrUrl: string;
}

export default function InviteForm({ inviteCode }: { inviteCode: string }) {
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [attending, setAttending] = useState(true);
  const [companionNames, setCompanionNames] = useState('');
  const [message, setMessage] = useState('');

  // Los nombres escritos SON el conteo — nada de un número aparte que
  // pueda no coincidir con lo que realmente se escribió.
  const companionNamesList = companionNames
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [guests, setGuests] = useState<QrGuest[] | null>(null);

  useEffect(() => {
    fetch(`/api/invite/${inviteCode}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invitación no encontrada');
        setInfo(data);
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [inviteCode]);

  const maxCompanions = info ? info.invitee.maxPasses - 1 : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (attending && companionNamesList.length > maxCompanions) {
      setSubmitError(
        `Tu invitación es para máximo ${info?.invitee.maxPasses} persona(s) (contándote a ti). Quita algún nombre.`,
      );
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch(`/api/invite/${inviteCode}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          phone: phone || undefined,
          email: email || undefined,
          attending,
          companionNames: attending && companionNames ? companionNames : undefined,
          message: message || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || 'No se pudo enviar tu confirmación');
        return;
      }

      setGuests(data.guests || []);
    } catch {
      setSubmitError('No se pudo conectar. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-center py-16 text-muted-foreground">Cargando invitación...</div>;
  }

  if (loadError || !info) {
    return <div className="text-center py-16 text-muted-foreground">{loadError}</div>;
  }

  if (info.invitee.status === 'confirmed' && !guests) {
    return (
      <div className="max-w-sm mx-auto mt-20 text-center">
        <p className="text-lg font-medium">Esta invitación ya fue confirmada.</p>
        <p className="text-muted-foreground mt-2">
          Si crees que es un error, contacta a quien te invitó.
        </p>
      </div>
    );
  }

  if (guests !== null) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 space-y-6 text-center">
        <h1 className="text-2xl font-semibold">¡Gracias por confirmar!</h1>
        {guests.length > 0 ? (
          <>
            <p className="text-muted-foreground">
              Guarda tu código (o toma captura) — te lo pedirán en el acceso.
            </p>
            <div className="space-y-4">
              {guests.map((g) => (
                <Card key={g.qrUrl}>
                  <CardContent className="pt-6 flex flex-col items-center gap-2">
                    <img src={g.qrUrl} alt={`QR de ${g.fullName}`} className="w-48 h-48" />
                    <p className="font-medium">{g.fullName}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">Lamentamos que no puedas acompañarnos.</p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12 p-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-semibold">{info.event.eventName}</h1>
        {info.event.eventDate && (
          <p className="text-muted-foreground">
            {format(new Date(info.event.eventDate), 'PPP')}
            {info.event.location && ` — ${info.event.location}`}
          </p>
        )}
        <p className="mt-4 text-lg">
          Hola, <strong>{info.invitee.displayName}</strong> — tu invitación es para hasta{' '}
          <strong>{info.invitee.maxPasses}</strong> {info.invitee.maxPasses === 1 ? 'persona' : 'personas'}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Confirma tu asistencia</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tu nombre completo</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Teléfono</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Correo (opcional)</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">¿Asistirás?</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={attending ? 'si' : 'no'}
                onChange={(e) => setAttending(e.target.value === 'si')}
              >
                <option value="si">Sí, ahí estaré</option>
                <option value="no">No podré asistir</option>
              </select>
            </div>

            {attending && maxCompanions > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Nombres de tus acompañantes (máximo {maxCompanions})
                </label>
                <Input
                  value={companionNames}
                  onChange={(e) => setCompanionNames(e.target.value)}
                  placeholder="Separados por coma, o déjalo vacío si vienes solo"
                />
                {companionNamesList.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {companionNamesList.length} acompañante(s): {companionNamesList.join(', ')}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Déjanos un mensaje (opcional)</label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} />
            </div>

            {submitError && <p className="text-sm text-red-500">{submitError}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Confirmar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
