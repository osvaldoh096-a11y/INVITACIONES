import { useState } from 'react';
import { toast } from 'sonner';
import EventsPanel from './EventsPanel';
import RSVPList from './RSVPList';
import InviteesPanel from './InviteesPanel';
import { Button } from './ui/button';
import { LogOut } from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'events' | 'rsvps' | 'invitees'>('events');
  const [selectedEventCode, setSelectedEventCode] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Sesión cerrada');
      window.location.href = '/login';
    } catch (error) {
      toast.error('No se pudo cerrar sesión');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Panel de eventos</h1>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('events')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'events'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Eventos
            </button>
            <button
              onClick={() => setActiveTab('rsvps')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'rsvps'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              RSVPs {selectedEventCode ? `(${selectedEventCode})` : '(todos)'}
            </button>
            {selectedEventCode && (
              <button
                onClick={() => setActiveTab('invitees')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'invitees'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Lista de invitados ({selectedEventCode})
              </button>
            )}
            {activeTab !== 'events' && selectedEventCode && (
              <button
                onClick={() => {
                  setSelectedEventCode(null);
                  setActiveTab('events');
                }}
                className="py-4 px-1 text-sm text-gray-400 hover:text-gray-700"
              >
                Ver todos los eventos
              </button>
            )}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'events' ? (
          <EventsPanel
            onSelectEvent={(code) => {
              setSelectedEventCode(code);
              setActiveTab('rsvps');
            }}
            onManageInvitees={(code) => {
              setSelectedEventCode(code);
              setActiveTab('invitees');
            }}
          />
        ) : activeTab === 'invitees' && selectedEventCode ? (
          <InviteesPanel eventCode={selectedEventCode} />
        ) : (
          <RSVPList eventCode={selectedEventCode} />
        )}
      </main>
    </div>
  );
}
