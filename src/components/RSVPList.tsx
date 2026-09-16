import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Download, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import type { RSVP } from '../lib/validations';
import { rsvpService } from '../lib/api';

interface RSVPWithEvent extends RSVP {
  event: { eventCode: string; eventName: string; clientName: string };
}

interface RSVPListProps {
  eventCode: string | null;
}

export default function RSVPList({ eventCode }: RSVPListProps) {
  const [rsvps, setRsvps] = useState<RSVPWithEvent[]>([]);
  const [analytics, setAnalytics] = useState({
    total: 0,
    totalAttending: 0,
    totalDeclined: 0,
    totalCompanions: 0,
    totalGuestsConfirmed: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRSVPs();
  }, [eventCode]);

  const fetchRSVPs = async () => {
    setLoading(true);
    try {
      const data = await rsvpService.getList(eventCode ?? undefined);
      setRsvps(data.rsvps);
      setAnalytics(data.analytics);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar RSVPs');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await rsvpService.exportCSV(eventCode ?? undefined);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rsvps${eventCode ? '-' + eventCode : '-todos'}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('CSV exportado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al exportar');
    }
  };

  if (loading) return <div className="text-center py-10">Cargando RSVPs...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Rechazados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{analytics.totalDeclined}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Acompañantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.totalCompanions}</div>
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

      <div className="flex justify-end">
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar a CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{eventCode ? 'Respuestas de este evento' : 'Todas las respuestas (todos los eventos)'}</CardTitle>
        </CardHeader>
        <CardContent>
          {rsvps.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Aún no hay respuestas para mostrar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {!eventCode && <TableHead>Evento</TableHead>}
                    <TableHead>Invitado</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Asiste</TableHead>
                    <TableHead>Acompañantes</TableHead>
                    <TableHead>Restricciones</TableHead>
                    <TableHead>Mensaje</TableHead>
                    <TableHead>Sheets</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rsvps.map((rsvp) => (
                    <TableRow key={rsvp.id}>
                      {!eventCode && (
                        <TableCell className="text-sm">{rsvp.event.eventName}</TableCell>
                      )}
                      <TableCell className="font-medium">{rsvp.fullName}</TableCell>
                      <TableCell>{rsvp.phone || '-'}</TableCell>
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
                      <TableCell>
                        {rsvp.syncedToSheets ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(rsvp.createdAt), 'PPp')}
                      </TableCell>
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
