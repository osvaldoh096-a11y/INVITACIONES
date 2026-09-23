import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { FormField } from './FormField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Plus, Copy, ExternalLink, Link as LinkIcon, QrCode, Users, Trash2 } from 'lucide-react';
import { eventProjectSchema, type EventProjectFormData, type EventProject } from '../lib/validations';
import { eventService } from '../lib/api';
import { PACKAGE_TIERS, PACKAGE_LABELS, hasInviteeList, hasQrCheckin } from '../lib/packages';

interface EventsPanelProps {
  onSelectEvent?: (eventCode: string | null, packageTier?: string) => void;
  onManageInvitees?: (eventCode: string, packageTier?: string) => void;
}

const PACKAGE_BADGE_CLASS: Record<string, string> = {
  basico: 'bg-gray-100 text-gray-700',
  medio: 'bg-blue-100 text-blue-800',
  grande: 'bg-purple-100 text-purple-800',
};

// Solo se permiten fechas futuras (posteriores a hoy) para el evento.
function tomorrowIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function EventsPanel({ onSelectEvent, onManageInvitees }: EventsPanelProps) {
  const [events, setEvents] = useState<(EventProject & { _count?: { rsvps: number } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const minEventDate = tomorrowIsoDate();

  const [deleteTarget, setDeleteTarget] = useState<EventProject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EventProjectFormData>({
    resolver: zodResolver(eventProjectSchema),
    defaultValues: { eventType: 'boda', packageTier: 'basico' },
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const data = await eventService.list();
      setEvents(data.events);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar eventos');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: EventProjectFormData) => {
    try {
      const result = await eventService.create(data);
      toast.success(`Evento creado: ${result.event.eventCode}`);
      reset({ eventType: 'boda', packageTier: 'basico' });
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear el evento');
    }
  };

  const copyEndpoint = (eventCode: string) => {
    const url = `${window.location.origin}/api/rsvp/${eventCode}`;
    navigator.clipboard.writeText(url);
    toast.success('Endpoint copiado — pégalo en tu formulario de Framer');
  };

  const copyStatusLink = (eventCode: string) => {
    const url = `${window.location.origin}/estado/${eventCode}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado — mándaselo a tu cliente para que vea sus confirmaciones');
  };

  const copyCheckinLink = (eventCode: string) => {
    const url = `${window.location.origin}/checkin/${eventCode}`;
    navigator.clipboard.writeText(url);
    toast.success('Link de check-in copiado — quien reciba en la puerta lo abre desde su celular');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await eventService.remove(deleteTarget.eventCode);
      toast.success(`Evento "${deleteTarget.eventName}" eliminado`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el evento');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="text-center py-10">Cargando eventos...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Eventos y clientes</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo evento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear nuevo evento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                label="Nombre del cliente"
                name="clientName"
                placeholder="Ej. Familia Hernández"
                register={register}
                errors={errors}
                required
              />
              <FormField
                label="Nombre del evento (se muestra a los invitados)"
                name="eventName"
                placeholder="Ej. Boda de Ana & Luis"
                register={register}
                errors={errors}
                required
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de evento</label>
                <Select
                  defaultValue="boda"
                  onValueChange={(v) => setValue('eventType', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boda">Boda</SelectItem>
                    <SelectItem value="xv">XV años</SelectItem>
                    <SelectItem value="corporativo">Corporativo</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Paquete</label>
                <Select
                  defaultValue="basico"
                  onValueChange={(v) => setValue('packageTier', v as (typeof PACKAGE_TIERS)[number])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGE_TIERS.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {PACKAGE_LABELS[tier]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Plata: RSVP + panel + CSV. Oro: + lista de invitados con pases limitados + QR +
                  check-in. Diamante: mismo backend que Oro (lo extra es diseño/servicio).
                </p>
              </div>

              <FormField
                label="Fecha del evento"
                name="eventDate"
                type="date"
                min={minEventDate}
                register={register}
                errors={errors}
              />

              <FormField
                label="Lugar"
                name="location"
                placeholder="Salón, ciudad"
                register={register}
                errors={errors}
              />

              <FormField
                label="Contraseña de acceso (opcional)"
                name="accessPassword"
                placeholder="Déjalo vacío si la invitación es abierta"
                register={register}
                errors={errors}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Creando...' : 'Crear evento'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todos los eventos</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Aún no has creado ningún evento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Paquete</TableHead>
                    <TableHead>RSVPs</TableHead>
                    <TableHead>ID_EVENTO (para Framer)</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{event.eventName}</TableCell>
                      <TableCell>{event.clientName}</TableCell>
                      <TableCell className="capitalize">{event.eventType}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            PACKAGE_BADGE_CLASS[event.packageTier] ?? PACKAGE_BADGE_CLASS.basico
                          }`}
                        >
                          {PACKAGE_LABELS[event.packageTier as keyof typeof PACKAGE_LABELS] ?? event.packageTier}
                        </span>
                      </TableCell>
                      <TableCell>
                        <button
                          className="text-primary hover:underline"
                          onClick={() => onSelectEvent?.(event.eventCode, event.packageTier)}
                        >
                          {event._count?.rsvps ?? 0} respuestas
                        </button>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {event.eventCode}
                        </code>
                      </TableCell>
                      <TableCell className="flex gap-2">
                        {onManageInvitees && hasInviteeList(event.packageTier) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onManageInvitees(event.eventCode, event.packageTier)}
                            title="Lista de invitados precargada (pases limitados)"
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyEndpoint(event.eventCode)}
                          title="Copiar endpoint público para el formulario de Framer"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyStatusLink(event.eventCode)}
                          title="Copiar link de estado para tu cliente"
                        >
                          <LinkIcon className="h-4 w-4" />
                        </Button>
                        {hasQrCheckin(event.packageTier) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyCheckinLink(event.eventCode)}
                            title="Copiar link de check-in (lector de QR) para la entrada del evento"
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                        )}
                        <a
                          href={`/api/events/${event.eventCode}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex"
                        >
                          <Button size="sm" variant="outline" title="Ver datos públicos del evento">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setDeleteTarget(event)}
                          title="Eliminar evento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar este evento?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vas a eliminar <strong>{deleteTarget?.eventName}</strong> ({deleteTarget?.clientName}).
              Esto borra también todas sus RSVPs, invitados y códigos QR —{' '}
              <strong className="text-red-600">no se puede deshacer</strong>.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
