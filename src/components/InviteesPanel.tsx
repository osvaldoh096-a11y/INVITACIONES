import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Copy, Trash2, MessageCircle } from 'lucide-react';

interface Invitee {
  id: string;
  displayName: string;
  maxPasses: number;
  phone: string | null;
  email: string | null;
  inviteCode: string;
  status: string;
  isGeneric: boolean;
  rsvp: { companionsCount: number; attending: boolean } | null;
}

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  pending: { text: 'Sin enviar', className: 'bg-gray-100 text-gray-700' },
  sent: { text: 'Enviada', className: 'bg-blue-100 text-blue-800' },
  confirmed: { text: 'Confirmó', className: 'bg-green-100 text-green-800' },
  declined: { text: 'No asistirá', className: 'bg-red-100 text-red-800' },
};

export default function InviteesPanel({
  eventCode,
  framerUrl,
}: {
  eventCode: string;
  framerUrl?: string | null;
}) {
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkText, setBulkText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, [eventCode]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventCode}/invitees`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInvitees(data.invitees);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar la lista');
    } finally {
      setLoading(false);
    }
  };

  // Formato esperado, una línea por invitado/familia:
  //   Nombre completo, pases, teléfono (opcional)
  const parseBulk = () => {
    return bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [displayName, passesRaw, phone] = line.split(',').map((p) => p.trim());
        return {
          displayName,
          maxPasses: Number(passesRaw) || 1,
          phone: phone || undefined,
        };
      })
      .filter((r) => r.displayName);
  };

  const handleBulkAdd = async () => {
    const rows = parseBulk();
    if (rows.length === 0) {
      toast.error('Escribe al menos un renglón: Nombre, pases, teléfono');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventCode}/invitees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitees: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.invitees.length} invitado(s) agregado(s)`);
      setBulkText('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo agregar la lista');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddGeneric = async () => {
    const maxPasses = Number(prompt('¿Para cuántas personas es esta invitación genérica?', '2'));
    if (!maxPasses || maxPasses < 1) return;

    try {
      const res = await fetch(`/api/events/${eventCode}/invitees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitees: [{ displayName: 'Invitado general', maxPasses, isGeneric: true }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Invitación genérica creada');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Quitar a este invitado de la lista?')) return;
    try {
      const res = await fetch(`/api/events/${eventCode}/invitees/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo eliminar');
      setInvitees((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar');
    }
  };

  // Si el evento tiene una URL de Framer configurada, el link del invitado
  // apunta al diseño real (?invite=CODE). Si no, cae a nuestra página de
  // respaldo — útil solo mientras no exista el sitio publicado todavía.
  const inviteUrl = (inviteCode: string) => {
    if (framerUrl) {
      const url = new URL(framerUrl);
      url.searchParams.set('invite', inviteCode);
      return url.toString();
    }
    return `${window.location.origin}/invite/${inviteCode}`;
  };

  const copyLink = (inviteCode: string) => {
    navigator.clipboard.writeText(inviteUrl(inviteCode));
    toast.success('Link copiado');
  };

  const sendWhatsApp = async (invitee: Invitee) => {
    const text = encodeURIComponent(
      `¡Hola ${invitee.displayName}! Aquí está tu invitación, tienen ${invitee.maxPasses} pase(s) asignado(s): ${inviteUrl(invitee.inviteCode)}`,
    );
    const phoneDigits = invitee.phone?.replace(/\D/g, '') || '';
    const url = phoneDigits ? `https://wa.me/${phoneDigits}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');

    if (invitee.status === 'pending') {
      await fetch(`/api/events/${eventCode}/invitees/${invitee.id}`, { method: 'PATCH' });
      setInvitees((prev) =>
        prev.map((i) => (i.id === invitee.id ? { ...i, status: 'sent' } : i)),
      );
    }
  };

  if (loading) return <div className="text-center py-10">Cargando lista...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Agregar invitados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Un renglón por invitado o familia: <code className="bg-muted px-1 rounded">Nombre, pases, teléfono</code>
            {' '}(el teléfono es opcional). Ejemplo:
          </p>
          <pre className="text-xs bg-muted p-2 rounded">
Familia Torres, 4, 5551234567{'\n'}Juan Pérez, 1
          </pre>
          <Textarea
            rows={5}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Familia Torres, 4, 5551234567"
          />
          <div className="flex gap-2">
            <Button onClick={handleBulkAdd} disabled={submitting}>
              {submitting ? 'Agregando...' : 'Agregar a la lista'}
            </Button>
            <Button variant="outline" onClick={handleAddGeneric}>
              + Invitación genérica
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de invitados ({invitees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {invitees.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Aún no has agregado invitados a este evento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invitado</TableHead>
                    <TableHead>Pases</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Confirmó con</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitees.map((inv) => {
                    const status = STATUS_LABEL[inv.status] ?? STATUS_LABEL.pending;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">
                          {inv.displayName}
                          {inv.isGeneric && (
                            <span className="ml-2 text-xs text-muted-foreground">(genérica)</span>
                          )}
                        </TableCell>
                        <TableCell>{inv.maxPasses}</TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                            {status.text}
                          </span>
                        </TableCell>
                        <TableCell>
                          {inv.rsvp && inv.rsvp.attending
                            ? `${1 + inv.rsvp.companionsCount} persona(s)`
                            : '-'}
                        </TableCell>
                        <TableCell className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => copyLink(inv.inviteCode)} title="Copiar link">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => sendWhatsApp(inv)} title="Enviar por WhatsApp">
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          {inv.status === 'pending' && (
                            <Button size="sm" variant="outline" onClick={() => handleDelete(inv.id)} title="Quitar">
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
    </div>
  );
}
