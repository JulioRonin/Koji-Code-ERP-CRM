import React, { useState } from 'react';
import { Search, User, Wrench, Play, Pause, CheckSquare, Clock, AlertCircle, ChevronRight, Activity, Eye, FileText, X, Layers, FileCode2 } from 'lucide-react';

// --- Mock Data ---
export const mockTechnicians = [
  { id: 'T-001', name: 'Alex Vance', role: 'Operador CNC Senior', machine: 'CNC-001 (Fresadora 5 Ejes)', status: 'Activo', avatar: 'AV', efficiency: 94 },
  { id: 'T-002', name: 'Sarah Connor', role: 'Especialista Impresión 3D', machine: '3D-PRT-04', status: 'Activo', avatar: 'SC', efficiency: 88 },
  { id: 'T-003', name: 'David Martinez', role: 'Técnico de Ensamblaje', machine: 'Estación ENS-02', status: 'Pausado', avatar: 'DM', efficiency: 76 },
  { id: 'T-004', name: 'Elena Rosas', role: 'Operador Torno CNC', machine: 'CNC-003 (Torno)', status: 'Activo', avatar: 'ER', efficiency: 91 },
];

const initialTasks = [
  { id: 'ORD-992', techId: 'T-001', project: 'Wing Assembly 737-MAX', part: 'Soporte de Titanio A4', status: 'En Proceso', progress: 68, priority: 'Alta', specs: 'Aleación Ti-6Al-4V, Tolerancia ±0.005mm', projectStatus: 'Producción Activa', blueprint: 'BP-737-A4-v2' },
  { id: 'ORD-993', techId: 'T-001', project: 'Wing Assembly 737-MAX', part: 'Eje de Transmisión', status: 'Pendiente', progress: 0, priority: 'Media', specs: 'Acero Inoxidable 316L, Longitud 120cm', projectStatus: 'Producción Activa', blueprint: 'BP-737-TR-v1' },
  { id: 'ORD-842', techId: 'T-002', project: 'Sub-Surface Hull Sensor', part: 'Carcasa de Polímero', status: 'En Proceso', progress: 45, priority: 'Alta', specs: 'Polímero PEEK, Resistente a 500atm', projectStatus: 'Fase de Pruebas', blueprint: 'BP-SSH-C1' },
  { id: 'ORD-843', techId: 'T-002', project: 'Sub-Surface Hull Sensor', part: 'Soporte Interno', status: 'Completado', progress: 100, priority: 'Baja', specs: 'Aluminio 7075-T6, Anodizado', projectStatus: 'Fase de Pruebas', blueprint: 'BP-SSH-S2' },
  { id: 'ORD-710', techId: 'T-003', project: 'Turbine Shaft Calibration', part: 'Anillo de Sellado', status: 'Pausado', progress: 30, priority: 'Media', specs: 'Caucho de Fluorocarbono (FKM)', projectStatus: 'Retrasado', blueprint: 'BP-TSC-R1' },
  { id: 'ORD-605', techId: 'T-004', project: 'Heavy Lift Cargo Drone V2', part: 'Rotor Principal', status: 'En Proceso', progress: 82, priority: 'Crítica', specs: 'Fibra de Carbono Compuesta', projectStatus: 'Ensamblaje Final', blueprint: 'BP-HLD-R0' },
];

export function Technicians() {
  const [technicians] = useState(mockTechnicians);
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTechId, setSelectedTechId] = useState<string>(mockTechnicians[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<typeof initialTasks[0] | null>(null);

  const selectedTech = technicians.find(t => t.id === selectedTechId);
  const techTasks = tasks.filter(t => t.techId === selectedTechId);

  const handleStatusChange = (taskId: string, newStatus: string) => {
    setTasks(tasks.map(t => {
      if (t.id === taskId) {
        let newProgress = t.progress;
        if (newStatus === 'Completado') newProgress = 100;
        if (newStatus === 'En Proceso' && t.progress === 0) newProgress = 5; // Just started
        return { ...t, status: newStatus, progress: newProgress };
      }
      return t;
    }));
  };

  const filteredTechnicians = technicians.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.machine.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header & Actions */}
      <div className="flex justify-between items-center gap-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-widest text-erp-cyan uppercase text-glow">Gestión de Técnicos</h1>
          <p className="text-sm font-mono text-erp-text uppercase tracking-wider">Control de personal, maquinaria asignada y órdenes de trabajo.</p>
        </div>
        
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-erp-cyan w-5 h-5" />
          <input 
            className="w-full bg-erp-panel border border-erp-border rounded-lg py-3 pl-12 pr-4 text-erp-text-bright focus:outline-none focus:border-erp-cyan focus:ring-1 focus:ring-erp-cyan transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]" 
            placeholder="Buscar técnico o máquina..." 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Technicians List */}
        <div className="col-span-1 bg-erp-panel/50 backdrop-blur-md border border-erp-cyan/30 rounded-xl shadow-[var(--shadow-glow-cyan)] relative flex flex-col overflow-hidden">
          {/* Corner decorations */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-erp-cyan"></div>
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-erp-cyan"></div>
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-erp-cyan"></div>
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-erp-cyan"></div>
          
          <div className="p-4 border-b border-erp-cyan/30 bg-erp-panel/80">
            <h2 className="font-semibold text-erp-text-bright tracking-wider flex items-center gap-2">
              <User className="w-5 h-5 text-erp-cyan" />
              PERSONAL ACTIVO
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredTechnicians.map(tech => (
              <button
                key={tech.id}
                onClick={() => setSelectedTechId(tech.id)}
                className={`w-full text-left p-4 rounded-lg border transition-all flex items-center gap-4 group ${
                  selectedTechId === tech.id 
                    ? 'bg-erp-cyan/10 border-erp-cyan shadow-[inset_0_0_15px_rgba(0,240,255,0.2)]' 
                    : 'bg-erp-bg border-erp-border hover:border-erp-purple/50 hover:bg-erp-purple/5'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border ${
                  selectedTechId === tech.id ? 'border-erp-cyan text-erp-cyan shadow-[var(--shadow-glow-cyan)]' : 'border-erp-purple text-erp-purple'
                }`}>
                  {tech.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold truncate ${selectedTechId === tech.id ? 'text-erp-text-bright' : 'text-erp-text'}`}>
                    {tech.name}
                  </h3>
                  <p className="text-xs font-mono text-erp-text truncate flex items-center gap-1 mt-1">
                    <Wrench className="w-3 h-3" /> {tech.machine}
                  </p>
                </div>
                <ChevronRight className={`w-5 h-5 ${selectedTechId === tech.id ? 'text-erp-cyan' : 'text-erp-border group-hover:text-erp-purple'}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Technician Details & Tasks */}
        <div className="col-span-1 lg:col-span-2 flex flex-col gap-6 min-h-0">
          
          {/* Tech Info Card */}
          {selectedTech && (
            <div className="bg-erp-panel/50 backdrop-blur-md border border-erp-purple/50 rounded-xl shadow-[var(--shadow-glow-purple)] p-6 shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-erp-purple/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-full border-2 border-erp-purple flex items-center justify-center font-bold text-2xl text-erp-purple shadow-[var(--shadow-glow-purple)] bg-erp-bg">
                    {selectedTech.avatar}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-erp-text-bright tracking-wider">{selectedTech.name}</h2>
                    <div className="flex items-center gap-4 mt-2 font-mono text-sm">
                      <span className="text-erp-cyan flex items-center gap-1">
                        <User className="w-4 h-4" /> {selectedTech.role}
                      </span>
                      <span className="text-erp-purple flex items-center gap-1">
                        <Wrench className="w-4 h-4" /> {selectedTech.machine}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-xs font-mono text-erp-text mb-1 uppercase tracking-wider">Eficiencia</div>
                  <div className="text-3xl font-bold text-erp-cyan text-glow">{selectedTech.efficiency}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Tasks Table */}
          <div className="bg-erp-panel/50 backdrop-blur-md border border-erp-cyan/50 rounded-xl shadow-[var(--shadow-glow-cyan)] relative flex-1 flex flex-col overflow-hidden">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-erp-cyan"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-erp-cyan"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-erp-cyan"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-erp-cyan"></div>
            
            <div className="p-4 border-b border-erp-cyan/30 bg-erp-panel/80 flex justify-between items-center">
              <h2 className="font-semibold text-erp-text-bright tracking-wider flex items-center gap-2">
                <Activity className="w-5 h-5 text-erp-cyan" />
                ÓRDENES DE TRABAJO ASIGNADAS
              </h2>
              <span className="text-xs font-mono text-erp-cyan border border-erp-cyan/50 px-2 py-1 rounded bg-erp-cyan/10">
                {techTasks.length} ÓRDENES
              </span>
            </div>

            <div className="overflow-auto flex-1 p-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-erp-cyan/30 text-erp-text-bright text-sm font-mono">
                    <th className="py-3 px-4 font-semibold tracking-wider">ID Orden</th>
                    <th className="py-3 px-4 font-semibold tracking-wider">Proyecto / Pieza</th>
                    <th className="py-3 px-4 font-semibold tracking-wider">Progreso</th>
                    <th className="py-3 px-4 font-semibold tracking-wider">Estado</th>
                    <th className="py-3 px-4 font-semibold tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="text-base">
                  {techTasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-erp-text font-mono">
                        No hay órdenes asignadas a este técnico.
                      </td>
                    </tr>
                  ) : techTasks.map((task) => (
                    <tr key={task.id} className="border-b border-erp-purple/20 hover:bg-erp-purple/5 transition-colors group">
                      <td className="py-4 px-4 font-mono text-erp-cyan">{task.id}</td>
                      <td className="py-4 px-4">
                        <div className="font-medium text-erp-text-bright">{task.part}</div>
                        <div className="text-xs font-mono text-erp-text mt-1">{task.project}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="progress-bar-container w-32 h-4">
                            <div className="progress-bar-decor w-2"></div>
                            <div className="progress-bar-fill" style={{ width: `${task.progress}%` }}></div>
                          </div>
                          <span className="text-erp-cyan font-bold font-mono text-sm">{task.progress}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-block px-3 py-1 rounded-full font-bold text-xs tracking-wider ${
                          task.status === 'En Proceso' ? 'bg-erp-cyan text-black shadow-[var(--shadow-glow-cyan)]' :
                          task.status === 'Pendiente' ? 'border border-erp-cyan text-erp-cyan shadow-[0_0_10px_rgba(0,240,255,0.2)_inset]' :
                          task.status === 'Pausado' ? 'bg-erp-purple/20 border border-erp-purple text-erp-purple shadow-[var(--shadow-glow-purple)]' :
                          'bg-erp-text text-erp-bg'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {task.status === 'Pendiente' && (
                            <button 
                              onClick={() => handleStatusChange(task.id, 'En Proceso')}
                              className="p-2 rounded bg-erp-cyan/20 text-erp-cyan hover:bg-erp-cyan hover:text-black transition-colors border border-erp-cyan"
                              title="Iniciar Trabajo"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {task.status === 'En Proceso' && (
                            <>
                              <button 
                                onClick={() => handleStatusChange(task.id, 'Pausado')}
                                className="p-2 rounded bg-erp-purple/20 text-erp-purple hover:bg-erp-purple hover:text-white transition-colors border border-erp-purple"
                                title="Pausar Trabajo"
                              >
                                <Pause className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleStatusChange(task.id, 'Completado')}
                                className="p-2 rounded bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-black transition-colors border border-green-500"
                                title="Marcar Completado"
                              >
                                <CheckSquare className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {task.status === 'Pausado' && (
                            <button 
                              onClick={() => handleStatusChange(task.id, 'En Proceso')}
                              className="p-2 rounded bg-erp-cyan/20 text-erp-cyan hover:bg-erp-cyan hover:text-black transition-colors border border-erp-cyan"
                              title="Reanudar Trabajo"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {task.status === 'Completado' && (
                            <span className="text-erp-text font-mono text-xs flex items-center gap-1">
                              <CheckSquare className="w-4 h-4" /> Listo
                            </span>
                          )}
                          <div className="w-px h-6 bg-erp-border mx-1"></div>
                          <button 
                            onClick={() => setSelectedTaskDetails(task)}
                            className="p-2 rounded bg-erp-bg text-erp-text hover:bg-erp-cyan/10 hover:text-erp-cyan transition-colors border border-erp-border hover:border-erp-cyan"
                            title="Ver Detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* Task Details Modal */}
      {selectedTaskDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-erp-bg border border-erp-cyan shadow-[var(--shadow-glow-cyan)] rounded-xl w-full max-w-3xl flex flex-col overflow-hidden relative">
            {/* Modal Corner Decorations */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-erp-cyan"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-erp-cyan"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-erp-cyan"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-erp-cyan"></div>

            {/* Modal Header */}
            <div className="p-4 border-b border-erp-cyan/30 flex justify-between items-center bg-erp-panel/80">
              <h3 className="text-xl font-bold text-erp-cyan text-glow flex items-center gap-2 tracking-wider">
                <FileText className="w-5 h-5" /> 
                DETALLES DE ORDEN: {selectedTaskDetails.id}
              </h3>
              <button 
                onClick={() => setSelectedTaskDetails(null)} 
                className="text-erp-text hover:text-erp-cyan transition-colors p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[75vh] flex flex-col gap-6">
              
              {/* Top Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-erp-panel/50 border border-erp-border p-4 rounded-lg">
                  <h4 className="text-xs font-mono text-erp-text uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-erp-purple" /> Proyecto Asociado
                  </h4>
                  <p className="text-lg font-bold text-erp-text-bright">{selectedTaskDetails.project}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs font-mono text-erp-text">Estado General:</span>
                    <span className="text-xs font-mono text-erp-cyan bg-erp-cyan/10 px-2 py-0.5 rounded border border-erp-cyan/30">
                      {selectedTaskDetails.projectStatus}
                    </span>
                  </div>
                </div>

                <div className="bg-erp-panel/50 border border-erp-border p-4 rounded-lg">
                  <h4 className="text-xs font-mono text-erp-text uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-erp-cyan" /> Estado de la Orden
                  </h4>
                  <div className="flex items-center gap-4">
                    <span className={`inline-block px-3 py-1 rounded-full font-bold text-xs tracking-wider ${
                      selectedTaskDetails.status === 'En Proceso' ? 'bg-erp-cyan text-black shadow-[var(--shadow-glow-cyan)]' :
                      selectedTaskDetails.status === 'Pendiente' ? 'border border-erp-cyan text-erp-cyan shadow-[0_0_10px_rgba(0,240,255,0.2)_inset]' :
                      selectedTaskDetails.status === 'Pausado' ? 'bg-erp-purple/20 border border-erp-purple text-erp-purple shadow-[var(--shadow-glow-purple)]' :
                      'bg-erp-text text-erp-bg'
                    }`}>
                      {selectedTaskDetails.status}
                    </span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-mono text-erp-text mb-1">
                        <span>Progreso</span>
                        <span className="text-erp-cyan">{selectedTaskDetails.progress}%</span>
                      </div>
                      <div className="progress-bar-container w-full h-2">
                        <div className="progress-bar-fill" style={{ width: `${selectedTaskDetails.progress}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Part Specs */}
              <div className="bg-erp-panel/50 border border-erp-border p-4 rounded-lg">
                <h4 className="text-xs font-mono text-erp-text uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-erp-cyan" /> Especificaciones de la Pieza
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-mono text-erp-text">Nombre de la Pieza</p>
                    <p className="font-bold text-erp-text-bright text-lg">{selectedTaskDetails.part}</p>
                  </div>
                  <div>
                    <p className="text-xs font-mono text-erp-text">Material y Tolerancias</p>
                    <p className="font-mono text-sm text-erp-cyan mt-1">{selectedTaskDetails.specs}</p>
                  </div>
                </div>
              </div>

              {/* Blueprint Placeholder */}
              <div className="bg-erp-panel/50 border border-erp-border p-4 rounded-lg flex flex-col">
                <h4 className="text-xs font-mono text-erp-text uppercase tracking-wider mb-4 flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-erp-purple" /> Planos y Referencias
                </h4>
                <div className="flex-1 min-h-[200px] border border-dashed border-erp-cyan/30 rounded flex flex-col items-center justify-center bg-erp-bg relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                  <FileCode2 className="w-12 h-12 text-erp-cyan/50 mb-2 group-hover:text-erp-cyan transition-colors" />
                  <p className="font-mono text-erp-text-bright">{selectedTaskDetails.blueprint}.pdf</p>
                  <p className="text-xs font-mono text-erp-text mt-2">Haz clic para abrir el visor CAD interactivo</p>
                  <button className="mt-4 px-4 py-2 bg-erp-cyan/10 border border-erp-cyan text-erp-cyan rounded hover:bg-erp-cyan hover:text-black transition-colors font-mono text-sm">
                    Ver Plano Completo
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
