import React, { useState } from 'react';
import {
  Webhook,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  Settings,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  useAutomationEvents,
  useReplayEvent,
  useCreateTestEvent,
  useMarkEventDelivered,
  N8N_WEBHOOK_URL,
} from '@/lib/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const KNOWN_EVENTS = [
  { type: 'project.status_changed',  label: 'Cambio de estado de proyecto' },
  { type: 'ncr.opened',              label: 'NCR abierta' },
  { type: 'inspection.final_approved', label: 'Inspección final aprobada' },
  { type: 'shipment.listo',          label: 'Embarque listo' },
  { type: 'shipment.en_tránsito',    label: 'Embarque en tránsito' },
  { type: 'shipment.entregado',      label: 'Embarque entregado' },
  { type: 'pmo.report_sent',         label: 'Reporte PMO enviado' },
];

export function Integrations() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'delivered'>('all');
  const filterParam = filter === 'pending' ? { delivered: false } : filter === 'delivered' ? { delivered: true } : {};
  const { data: events, refetch } = useAutomationEvents(filterParam);
  const { replay, loading: replaying } = useReplayEvent();
  const { create: createTest } = useCreateTestEvent();
  const { mark: markDelivered } = useMarkEventDelivered();

  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const webhookConfigured = !!N8N_WEBHOOK_URL;

  const handleReplay = async (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    try {
      await replay(event);
      await refetch();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleMarkDelivered = async (eventId: string) => {
    await markDelivered(eventId);
    await refetch();
  };

  const handleCreateTest = async (eventType: string) => {
    await createTest(eventType);
    await refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Integraciones</h1>
        <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
          Configura el webhook de n8n y monitorea la cola de eventos de automatización.
        </p>
      </div>

      {/* Webhook config card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Webhook n8n
          </CardTitle>
          <CardDescription>
            URL del webhook que recibe los eventos. Configúrala en Vercel como{' '}
            <code className="text-xs bg-[var(--color-app-surface-alt)] px-1.5 py-0.5 rounded">
              VITE_N8N_WEBHOOK_URL
            </code>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {webhookConfigured ? (
            <div className="flex items-center gap-2 p-3 bg-[var(--color-app-success-soft)] rounded-md">
              <CheckCircle2 className="h-4 w-4 text-[var(--color-app-success)] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--color-app-success)]">
                  Webhook configurado
                </p>
                <p className="text-xs text-[var(--color-app-text-muted)] truncate font-mono">
                  {N8N_WEBHOOK_URL}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-[var(--color-app-warning-soft)] rounded-md">
              <AlertCircle className="h-4 w-4 text-[var(--color-app-warning)] shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--color-app-warning)]">
                  No hay webhook configurado
                </p>
                <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5">
                  Los eventos quedarán en cola hasta que conectes n8n.
                </p>
              </div>
            </div>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer text-[var(--color-app-primary)] hover:underline">
              Cómo configurar n8n
            </summary>
            <div className="mt-3 space-y-2 text-[var(--color-app-text-muted)]">
              <p>
                <strong>Opción 1 — Database Webhooks (recomendado):</strong> En Supabase Dashboard ve a
                <em> Database → Webhooks → Create</em>, apunta a tu webhook de n8n y filtra por
                la tabla <code className="text-xs">automation_events</code>. Cada insert dispara el webhook.
              </p>
              <p>
                <strong>Opción 2 — Polling desde n8n:</strong> Usa un nodo de Supabase en n8n que consulte
                <code className="text-xs"> SELECT * FROM automation_events WHERE delivered = false</code>{' '}
                cada N minutos, procese y llame{' '}
                <code className="text-xs">mark_event_delivered(event_id, error)</code>.
              </p>
              <p>
                <strong>Opción 3 — Replay manual:</strong> Desde esta página puedes reenviar cualquier
                evento al webhook con un click.
              </p>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Test events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-[var(--color-app-text-muted)]" /> Generar evento de prueba
          </CardTitle>
          <CardDescription>
            Crea un evento sintético para verificar tu flujo de n8n end-to-end.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {KNOWN_EVENTS.map(e => (
              <Button
                key={e.type}
                variant="outline"
                size="sm"
                onClick={() => handleCreateTest(e.type)}
              >
                {e.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Event log */}
      <Card className="p-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cola de eventos</CardTitle>
              <CardDescription>
                {events.length} eventos · auto-poblada por triggers SQL
                {!isSupabaseConfigured && ' · (modo demo, localStorage)'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-[var(--color-app-surface-alt)] rounded-md p-0.5">
                {(['all', 'pending', 'delivered'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                      filter === f
                        ? 'bg-white text-[var(--color-app-text)] shadow-sm'
                        : 'text-[var(--color-app-text-muted)]'
                    )}
                  >
                    {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : 'Entregados'}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--color-app-text-muted)]">
              Aún no hay eventos. Crea un evento de prueba o dispara un cambio en algún módulo.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-app-border)]">
              {events.map(event => {
                const isOpen = expandedEvent === event.id;
                return (
                  <div key={event.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setExpandedEvent(isOpen ? null : event.id)}
                        className="text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]"
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <Badge variant={event.delivered ? 'success' : 'warning'}>
                        {event.delivered ? 'Entregado' : 'Pendiente'}
                      </Badge>
                      <span className="font-mono text-xs">{event.event_type}</span>
                      <span className="text-xs text-[var(--color-app-text-muted)] flex-1 truncate">
                        {event.entity_type} · {event.entity_id}
                      </span>
                      <span className="text-xs text-[var(--color-app-text-muted)]">
                        {format(new Date(event.created_at), 'dd MMM HH:mm', { locale: es })}
                      </span>
                      <div className="flex items-center gap-1">
                        {!event.delivered && webhookConfigured && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={replaying}
                            onClick={() => handleReplay(event.id)}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" /> Enviar
                          </Button>
                        )}
                        {!event.delivered && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkDelivered(event.id)}
                          >
                            Marcar
                          </Button>
                        )}
                      </div>
                    </div>
                    {isOpen && (
                      <div className="mt-3 ml-7 p-3 bg-[var(--color-app-surface-alt)] rounded-md">
                        {event.error && (
                          <div className="mb-2 text-xs text-[var(--color-app-danger)]">
                            <strong>Error:</strong> {event.error}
                          </div>
                        )}
                        <pre className="text-xs font-mono text-[var(--color-app-text)] overflow-x-auto">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
