import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { QrCode, Copy, MessageCircle, Trash2, UserPlus } from 'lucide-react';
import { hasQrCheckin, hasInviteeList } from '../lib/packages';

interface StatusRsvp {
  id: string;
  fullName: string;
  attending: boolean;
  companionsCount: number;
  companionNames: string | null;
  dietaryRestrictions: string | null;
  message: string | null;
  createdAt: string;
}

interface ClientInvitee {
  id: string;
  displayName: string;
  maxPasses: number;
  phone: string | null;
  inviteCode: string;
  status: string;
  isGeneric: boolean;
  guestNames: string[];
}

const INVITEE_STATUS_LABEL: Record<string, { text: string; className: string }> = {
  pending: { text: 'Sin enviar', className: 'bg-gray-100 text-gray-700' },
  sent: { text: 'Enviada', className: 'bg-blue-100 text-blue-800' },
  confirmed: { text: 'Confirmó', className: 'bg-green-100 text-green-800' },
  declined: { text: 'No asistirá', className: 'bg-red-100 text-red-800' },
};

interface StatusData {
  event: {
    eventCode: string;
    eventName: string;
    eventType: string;
    eventDate: string | null;
    location: string | null;
    packageTier: string;
    framerUrl: string | null;
  };
  analytics: {
    total: number;
    totalAttending: number;
    totalDeclined: number;
    totalCompanions: number;
    totalGuestsConfirmed: number;
  };
  rsvps: StatusRsvp[];
}

export default function EventStatus({ eventCode }: { eventCode: string }) {
  const [data, setData] = useState<StatusData | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchStatus = async (accessPassword?: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${eventCode}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accessPassword ? { accessPassword } : {}),
      });
      const result = await res.json();

      if (res.status === 403) {
        setNeedsPassword(true);
        if (accessPassword) setError('Contraseña incorrecta');
        return;
      }
      if (!res.ok) {
        setError(result.error || 'No se pudo cargar el evento');
        return;
      }

      setData(result);
      setNeedsPassword(false);
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [eventCode]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStatus(password);
  };

  // --- Lista de invitados: autogestión por el cliente, sin login ---
  const [invitees, setInvitees] = useState<ClientInvitee[]>([]);
  const [newName, setNewName] = useState('');
  const [newPasses, setNewPasses] = useState(1);
  const [newPhone, setNewPhone] = useState('');
  const [addingInvitee, setAddingInvitee] = useState(false);

  const loadInvitees = async (accessPassword?: string) => {
    try {
      const res = await fetch(`/api/events/${eventCode}/invitees/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accessPassword ? { accessPassword } : {}),
      });
      const result = await res.json();
      if (res.ok) setInvitees(result.invitees);
    } catch {
      // si falla, simplemente no se muestra la lista; el resto de la página sigue funcionando
    }
  };

  useEffect(() => {
    if (data && hasInviteeList(data.event.packageTier)) {
      loadInvitees(password || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const handleAddInvitee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newPasses < 1) {
      toast.error('Escribe el nombre y al menos 1 pase');
      return;
    }
    setAddingInvitee(true);
    try {
      const res = await fetch(`/api/events/${eventCode}/invitees/public`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessPassword: password || undefined,
          displayName: newName.trim(),
          maxPasses: newPasses,
          phone: newPhone.trim() || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success('Invitado agregado');
      setNewName('');
      setNewPasses(1);
      setNewPhone('');
      loadInvitees(password || undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo agregar');
    } finally {
      setAddingInvitee(false);
    }
  };

  const handleDeleteInvitee = async (inviteId: string) => {
    if (!confirm('¿Quitar a este invitado de la lista?')) return;
    try {
      const res = await fetch(`/api/events/${eventCode}/invitees/public`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessPassword: password || undefined, inviteId }),
      });
      if (!res.ok) throw new Error('No se pudo eliminar');
      setInvitees((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  };

  const inviteUrl = (inviteCode: string) => {
    const framerUrl = data?.event.framerUrl;
    if (framerUrl) {
      const url = new URL(framerUrl);
      url.searchParams.set('invite', inviteCode);
      return url.toString();
    }
    return `${window.location.origin}/invite/${inviteCode}`;
  };

  const copyInviteLink = (inviteCode: string) => {
    navigator.clipboard.writeText(inviteUrl(inviteCode));
    toast.success('Link copiado');
  };

  const sendInviteWhatsApp = async (invitee: ClientInvitee) => {
    const text = encodeURIComponent(
      `¡Hola ${invitee.displayName}! Aquí está tu invitación, tienen ${invitee.maxPasses} pase(s) asignado(s): ${inviteUrl(invitee.inviteCode)}`,
    );
    const phoneDigits = invitee.phone?.replace(/\D/g, '') || '';
    const url = phoneDigits ? `https://wa.me/${phoneDigits}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');

    if (invitee.status === 'pending') {
      await fetch(`/api/events/${eventCode}/invitees/public`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessPassword: password || undefined, inviteId: invitee.id }),
      });
      setInvitees((prev) =>
        prev.map((i) => (i.id === invitee.id ? { ...i, status: 'sent' } : i)),
      );
    }
  };

  if (loading) {
    return <div className="text-center py-16 text-muted-foreground">Cargando...</div>;
  }

  if (needsPassword) {
    return (
      <div className="max-w-sm mx-auto mt-20">
        <Card>
          <CardHeader>
            <CardTitle>Este evento es privado</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <Input
                type="password"
                placeholder="Contraseña de acceso"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full">
                Ver estado
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        {error || 'Evento no encontrado.'}
      </div>
    );
  }

  const { event, analytics, rsvps } = data;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{event.eventName}</h1>
        <p className="text-muted-foreground">
          {event.eventDate && format(new Date(event.eventDate), 'PPP')}
          {event.location && ` — ${event.location}`}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total respuestas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Confirmados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{analytics.totalAttending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">No asistirán</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{analytics.totalDeclined}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total personas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.totalGuestsConfirmed}</div>
          </CardContent>
        </Card>
      </div>

      {hasQrCheckin(event.packageTier) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Lector de código QR (check-in)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Este link abre la cámara para escanear los boletos QR de tus invitados en la
              entrada. Úsalo tú mismo o pásaselo a quien reciba ese día — no necesita
              contraseña.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={`${window.location.origin}/checkin/${event.eventCode}`} />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/checkin/${event.eventCode}`);
                  toast.success('Link copiado');
                }}
                title="Copiar link"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <a href={`/checkin/${event.eventCode}`} target="_blank" rel="noreferrer">
                <Button>Abrir</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {hasInviteeList(event.packageTier) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Tu lista de invitados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Agrega aquí a cada persona o familia que quieras invitar, con cuántos pases le
              corresponden. A cada uno le generamos un link personalizado que puedes copiar o
              mandar directo por WhatsApp.
            </p>

            <form onSubmit={handleAddInvitee} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1.5fr_auto] gap-2 items-end">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Nombre o familia</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Familia Torres"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Pases</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={newPasses}
                  onChange={(e) => setNewPasses(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Teléfono (opcional)</label>
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="55 1234 5678"
                />
              </div>
              <Button type="submit" disabled={addingInvitee}>
                {addingInvitee ? 'Agregando...' : 'Agregar'}
              </Button>
            </form>

            {invitees.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invitado</TableHead>
                      <TableHead>Pases</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitees.map((inv) => {
                      const status = INVITEE_STATUS_LABEL[inv.status] ?? INVITEE_STATUS_LABEL.pending;
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">
                            {inv.displayName}
                            {inv.guestNames.length > 0 && (
                              <div className="text-xs font-normal text-muted-foreground mt-0.5">
                                {inv.guestNames.join(', ')}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{inv.maxPasses}</TableCell>
                          <TableCell>
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                              {status.text}
                            </span>
                          </TableCell>
                          <TableCell className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" onClick={() => copyInviteLink(inv.inviteCode)} title="Copiar link">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => sendInviteWhatsApp(inv)} title="Enviar por WhatsApp">
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            {inv.status === 'pending' && (
                              <Button size="sm" variant="outline" onClick={() => handleDeleteInvitee(inv.id)} title="Quitar">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!hasInviteeList(event.packageTier) && (
      <Card>
        <CardHeader>
          <CardTitle>Invitados</CardTitle>
        </CardHeader>
        <CardContent>
          {rsvps.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Aún no hay confirmaciones.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invitado</TableHead>
                    <TableHead>Asiste</TableHead>
                    <TableHead>Acompañantes</TableHead>
                    <TableHead>Restricciones</TableHead>
                    <TableHead>Mensaje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rsvps.map((rsvp) => (
                    <TableRow key={rsvp.id}>
                      <TableCell className="font-medium">{rsvp.fullName}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            rsvp.attending ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {rsvp.attending ? 'Sí' : 'No'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {rsvp.companionsCount > 0
                          ? `${rsvp.companionsCount} (${rsvp.companionNames || 'sin nombre'})`
                          : '-'}
                      </TableCell>
                      <TableCell>{rsvp.dietaryRestrictions || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">{rsvp.message || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
