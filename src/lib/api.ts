import type { LoginFormData, EventProjectFormData } from './validations';

// --- Auth (equipo interno) ---
export const authService = {
  async login(data: LoginFormData) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Login failed');
    return result;
  },

  async logout() {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Logout failed');
    return response.json();
  },
};

// --- Eventos/clientes ---
export const eventService = {
  async list() {
    const response = await fetch('/api/events');
    if (!response.ok) throw new Error('No se pudieron cargar los eventos');
    return response.json();
  },

  async create(data: EventProjectFormData) {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo crear el evento');
    return result;
  },

  async update(eventCode: string, data: Partial<EventProjectFormData>) {
    const response = await fetch(`/api/events/${eventCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo actualizar el evento');
    return result;
  },

  async remove(eventCode: string) {
    const response = await fetch(`/api/events/${eventCode}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('No se pudo eliminar el evento');
    return response.json();
  },
};

// --- RSVPs ---
export const rsvpService = {
  async getList(eventCode?: string) {
    const qs = eventCode ? `?eventCode=${encodeURIComponent(eventCode)}` : '';
    const response = await fetch(`/api/rsvp/list${qs}`);
    if (!response.ok) throw new Error('No se pudieron cargar los RSVPs');
    return response.json();
  },

  async exportCSV(eventCode?: string) {
    const qs = eventCode ? `?eventCode=${encodeURIComponent(eventCode)}` : '';
    const response = await fetch(`/api/rsvp/export${qs}`);
    if (!response.ok) throw new Error('No se pudo exportar');
    return response.blob();
  },
};
