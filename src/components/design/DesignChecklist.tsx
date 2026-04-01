import React, { useState } from 'react';
import { 
  CheckSquare, 
  Square, 
  Calendar, 
  User, 
  Search, 
  Printer, 
  Maximize2,
  Info,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PROJECTS, INITIAL_BOMS } from '@/components/purchasing/BOMManager';
import { cn } from '@/lib/utils';

// Mapping simulated images to pieces
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
    // Trigger print dialog
    setTimeout(() => {
      window.print();
      setIsExporting(false);
    }, 800);
  };

  const filteredParts = parts.filter(p => 
    p.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 relative">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: portrait; margin: 15mm; }
          html, body { background: white !important; color: black !important; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          #print-area { 
            visibility: visible !important; 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            background: white !important;
            padding: 20px !important;
          }
          #print-area * { visibility: visible !important; }
          .print-header { 
            border-bottom: 3px solid #000 !important; 
            margin-bottom: 30px !important; 
            background: none !important;
            padding: 0 0 20px 0 !important;
          }
          .print-grid { display: block !important; }
          .print-card { 
            display: flex !important;
            flex-direction: row !important;
            border: 1px solid #ddd !important; 
            break-inside: avoid !important; 
            margin-bottom: 15px !important; 
            height: 140px !important;
            background: white !important;
          }
          .print-card img { width: 180px !important; height: 100% !important; object-fit: cover !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
      `}} />

      <div id="print-area" className="space-y-6">
        {/* Header with Project Info */}
        <div className="bg-cyber-panel/40 border border-cyber-border rounded-xl p-6 relative overflow-hidden backdrop-blur-md print-header">
          <div className="absolute top-0 right-0 p-4 opacity-10 no-print">
            <Info className="h-24 w-24 text-cyber-neon" />
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div className="space-y-4 w-full md:w-auto">
              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-cyber-neon uppercase tracking-[0.3em] no-print">PROYECTO ACTIVO</label>
                
                <div className="print-only mb-6">
                  <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
                    <div>
                      <h1 className="text-2xl font-bold uppercase tracking-widest text-black">REPORTAJE TÉCNICO: CHECKLIST DE FABRICACIÓN</h1>
                      <p className="text-sm font-mono text-gray-600 mt-1">SISTEMA KOJI ERP - GENERADO: {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Proyecto:</p>
                      <p className="text-lg font-bold text-black uppercase">{selectedProject?.name}</p>
                      <p className="text-[10px] font-mono text-gray-400">ID: {selectedProject?.id}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Cliente:</p>
                      <p className="text-sm font-bold text-black uppercase">{selectedProject?.client}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Fecha Límite:</p>
                      <p className="text-sm font-bold text-black uppercase">{selectedProject?.deadline}</p>
                    </div>
                  </div>
                </div>
                <select 
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="block w-full md:w-72 bg-black/60 border border-cyber-neon/30 text-white font-mono text-sm uppercase rounded-md p-2 focus:ring-1 focus:ring-cyber-neon outline-none no-print"
                >
                  {PROJECTS.map(p => (
                    <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyber-neon/10 rounded border border-cyber-neon/20 no-print">
                    <User className="h-4 w-4 text-cyber-neon" />
                  </div>
                  <div>
                    <p className="text-[10px] text-cyber-muted uppercase font-mono tracking-tighter no-print">Cliente / Mandatario</p>
                    <p className="text-sm font-bold text-cyber-text font-mono uppercase"><span className="print-only text-xs font-normal">CLIENTE: </span>{selectedProject?.client || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyber-accent/10 rounded border border-cyber-accent/20 no-print">
                    <Calendar className="h-4 w-4 text-cyber-accent" />
                  </div>
                  <div>
                    <p className="text-[10px] text-cyber-muted uppercase font-mono tracking-tighter no-print">Fecha de Entrega Limite</p>
                    <p className="text-sm font-bold text-cyber-text font-mono uppercase"><span className="print-only text-xs font-normal">ENTREGA: </span>{selectedProject?.deadline || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full md:w-auto no-print">
              <Button 
                onClick={handleExport}
                disabled={isExporting}
                className="bg-cyber-neon text-cyber-dark hover:bg-cyber-neon/90 font-cyber text-xs shadow-[0_0_15px_var(--color-neon-cyan)] disabled:opacity-50"
              >
                <Printer className={cn("mr-2 h-4 w-4", isExporting && "animate-pulse")} /> 
                {isExporting ? 'PROCESANDO REPORTE...' : 'GENERAR REPORTE PDF'}
              </Button>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-cyber-muted" />
                <input 
                  type="text" 
                  placeholder="BUSCAR PARTE O MATERIAL..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-black/60 border border-cyber-border rounded-md text-xs font-mono text-white focus:border-cyber-neon outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Checklist Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print-grid">
          {filteredParts.map((item) => (
            <Card 
              key={item.id} 
              className={cn(
                "border-cyber-border bg-cyber-panel/30 hover:border-cyber-neon/50 transition-all group overflow-hidden relative print-card",
                checkedItems[item.id] && "opacity-60 grayscale-[0.5]"
              )}
            >
              <CardContent className="p-0 flex flex-col md:flex-row print:flex-row">
                {/* Visual Reference */}
                <div className="relative h-48 md:h-auto md:w-48 bg-black overflow-hidden group/img print:w-40 print:h-full">
                  <img 
                    src={PART_IMAGES[item.id] || '/technical_drawing_part_1_1774986202285.png'} 
                    alt={item.partNumber}
                    className="w-full h-full object-cover opacity-80 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 no-print" />
                  <button 
                    onClick={() => setZoomImage(PART_IMAGES[item.id] || '/technical_drawing_part_1_1774986202285.png')}
                    className="absolute bottom-2 right-2 p-1 bg-black/80 rounded border border-white/10 text-white opacity-0 group-hover:opacity-100 transition-opacity no-print"
                  >
                    <Maximize2 className="h-3 w-3" />
                  </button>
                </div>

                <div className="p-4 flex-1 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-cyber-neon font-mono print:text-black">{item.partNumber}</p>
                      <p className="text-[10px] text-cyber-muted uppercase font-mono italic leading-tight print:text-gray-500">{item.description}</p>
                    </div>
                    <button 
                      onClick={() => toggleItem(item.id)}
                      className={cn(
                        "p-1 rounded transition-colors no-print",
                        checkedItems[item.id] ? "text-cyber-neon" : "text-cyber-muted hover:text-cyber-neon"
                      )}
                    >
                      {checkedItems[item.id] ? <CheckSquare className="h-6 w-6" /> : <Square className="h-6 w-6" />}
                    </button>
                    {/* Print Checkbox */}
                    <div className="print-only border-2 border-black w-8 h-8 flex items-center justify-center">
                      {checkedItems[item.id] && <span className="text-xl font-bold">✓</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 print:border-gray-200">
                    <div className="flex gap-2">
                       <Badge variant="secondary" className="text-[9px] uppercase tracking-tighter print:bg-gray-100 print:text-black">{item.category}</Badge>
                       <Badge variant="outline" className="text-[9px] uppercase tracking-tighter print:border-gray-300 print:text-black">{item.quantity} {item.uom}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
              
              {/* Completion Overlay */}
              {checkedItems[item.id] && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none no-print">
                  <div className="p-2 border-2 border-cyber-neon text-cyber-neon font-cyber text-lg rotate-12 bg-black/80 shadow-[0_0_20px_var(--color-neon-cyan)]">
                    COMPLETO
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Zoom Modal */}
      {zoomImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-10 cursor-zoom-out no-print"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-5xl max-h-full border-2 border-cyber-neon shadow-[0_0_50px_var(--color-neon-cyan)]">
            <img src={zoomImage} alt="Zoom" className="max-w-full max-h-full object-contain" />
            <div className="absolute -top-4 -right-4 p-2 bg-cyber-neon text-cyber-dark font-cyber text-xs cursor-pointer rounded">
              CERRAR [ESC]
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

