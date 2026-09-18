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

interface StatusData {
  event: { eventName: string; eventType: string; eventDate: string | null; location: string | null };
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
    </div>
  );
}
