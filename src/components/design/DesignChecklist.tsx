import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Calendar,
  User,
  Search,
  Printer,
  Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PROJECTS, INITIAL_BOMS } from '@/components/purchasing/BOMManager';
import { cn } from '@/lib/utils';

const PART_IMAGES: Record<string, string> = {
  'item-1': '/technical_drawing_part_1_1774986202285.png',
  'item-2': '/technical_drawing_part_2_1774986223070.png',
  'item-3': '/technical_drawing_part_3_1774986240867.png',
  'item-4': '/technical_drawing_part_1_1774986202285.png',
  'item-5': '/technical_drawing_part_2_1774986223070.png',
};

export function DesignChecklist() {
  const [selectedProjectId, setSelectedProjectId] = useState(PROJECTS[0].id);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const selectedProject = PROJECTS.find(p => p.id === selectedProjectId);
  const projectBOM = INITIAL_BOMS.find(b => b.projectId === selectedProjectId);
  const parts = projectBOM ? projectBOM.items : [];

  const toggleItem = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      window.print();
      setIsExporting(false);
    }, 500);
  };

  const filteredParts = parts.filter(
    p =>
      p.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-5 relative">
      <div id="print-area" className="space-y-5">
        {/* Header */}
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-3 w-full md:w-auto">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium no-print">Proyecto activo</label>
                  <select
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                    className="block w-full md:w-72 h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)] no-print"
                  >
                    {PROJECTS.map(p => (
                      <option key={p.id} value={p.id}>{p.id} — {p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-5">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                    <div>
                      <p className="text-xs text-[var(--color-app-text-muted)]">Cliente</p>
                      <p className="text-sm font-medium">{selectedProject?.client || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[var(--color-app-text-muted)]" />
                    <div>
                      <p className="text-xs text-[var(--color-app-text-muted)]">Fecha de entrega</p>
                      <p className="text-sm font-medium">{selectedProject?.deadline || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full md:w-auto no-print">
                <Button onClick={handleExport} disabled={isExporting}>
                  <Printer className={cn('h-4 w-4 mr-1.5', isExporting && 'animate-pulse')} />
                  {isExporting ? 'Procesando...' : 'Generar PDF'}
                </Button>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
                  <Input
                    placeholder="Buscar parte..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Checklist grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredParts.map(item => (
            <Card
              key={item.id}
              className={cn(
                'p-0 overflow-hidden transition-all',
                checkedItems[item.id] && 'opacity-70'
              )}
            >
              <CardContent className="p-0 flex flex-col">
                <div className="relative h-44 bg-[var(--color-app-surface-alt)] overflow-hidden group">
                  <img
                    src={PART_IMAGES[item.id] || '/technical_drawing_part_1_1774986202285.png'}
                    alt={item.partNumber}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() =>
                      setZoomImage(PART_IMAGES[item.id] || '/technical_drawing_part_1_1774986202285.png')
                    }
                    className="absolute bottom-2 right-2 h-7 w-7 bg-white/90 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity no-print"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-mono font-medium truncate">{item.partNumber}</p>
                      <p className="text-xs text-[var(--color-app-text-muted)] mt-0.5 leading-snug">
                        {item.description}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleItem(item.id)}
                      className={cn(
                        'p-1 rounded-md transition-colors no-print',
                        checkedItems[item.id]
                          ? 'text-[var(--color-app-success)]'
                          : 'text-[var(--color-app-text-subtle)] hover:text-[var(--color-app-text)]'
                      )}
                    >
                      {checkedItems[item.id] ? (
                        <CheckSquare className="h-5 w-5" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--color-app-border)]">
                    <Badge variant="secondary">{item.category}</Badge>
                    <Badge variant="outline">
                      {item.quantity} {item.uom}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Zoom modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-10 cursor-zoom-out no-print"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-5xl max-h-full rounded-lg overflow-hidden">
            <img src={zoomImage} alt="Zoom" className="max-w-full max-h-full object-contain bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}
