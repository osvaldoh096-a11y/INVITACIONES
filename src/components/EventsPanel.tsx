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
import { Plus, Copy, ExternalLink } from 'lucide-react';
import { eventProjectSchema, type EventProjectFormData, type EventProject } from '../lib/validations';
import { eventService } from '../lib/api';

interface EventsPanelProps {
  onSelectEvent?: (eventCode: string | null) => void;
}

export default function EventsPanel({ onSelectEvent }: EventsPanelProps) {
  const [events, setEvents] = useState<(EventProject & { _count?: { rsvps: number } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EventProjectFormData>({
    resolver: zodResolver(eventProjectSchema),
    defaultValues: { eventType: 'boda' },
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
      reset({ eventType: 'boda' });
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

              <FormField
                label="Fecha del evento"
                name="eventDate"
                type="text"
                placeholder="AAAA-MM-DD"
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
                        <button
                          className="text-primary hover:underline"
                          onClick={() => onSelectEvent?.(event.eventCode)}
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyEndpoint(event.eventCode)}
                          title="Copiar endpoint público para el formulario de Framer"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
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
