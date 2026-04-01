import React, { useState, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { Background3D } from '@/components/dashboard/Background3D';

const activeProjects = [
  { name: 'Wing Assembly 737-MAX', status: 'WIP', progress: 68, uid: 'AF-2024-081', statusColor: 'bg-erp-cyan text-black shadow-[var(--shadow-glow-cyan)]' },
  { name: 'Sub-Surface Hull Sensor Array', status: 'DESIGN', progress: 15, uid: 'ND-2024-112', statusColor: 'border border-erp-cyan text-erp-cyan shadow-[0_0_10px_rgba(0,240,255,0.2)_inset]' },
  { name: 'Turbine Shaft Calibration', status: 'QUALITY', progress: 15, uid: 'TR-2024-004', statusColor: 'bg-erp-cyan/20 border border-erp-cyan text-erp-cyan shadow-[var(--shadow-glow-cyan)]', progressColor: 'text-erp-purple' },
  { name: 'Heavy Lift Cargo Drone V2', status: 'QUALITY', progress: 92, uid: 'QM-2024-001', statusColor: 'bg-erp-cyan text-black shadow-[var(--shadow-glow-cyan)]' },
  { name: 'Plasma Conduit System', status: 'WIP', progress: 45, uid: 'PC-2024-092', statusColor: 'bg-erp-cyan text-black shadow-[var(--shadow-glow-cyan)]', progressColor: 'text-erp-purple' },
  { name: 'Grav-Drive Stabilizer', status: 'DESIGN', progress: 30, uid: 'GD-2024-130', statusColor: 'border border-erp-cyan text-erp-cyan shadow-[0_0_10px_rgba(0,240,255,0.2)_inset]', progressColor: 'text-erp-purple' },
];

export function Dashboard() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Background3D />
      <div className="relative z-10 space-y-6 flex flex-col h-full p-8 pb-4">
        {/* Action Bar */}
        <div className="flex justify-between items-center gap-6">
          <button className="bg-erp-cyan text-black font-bold text-lg px-8 py-3 clip-path-btn hover:bg-white transition-colors shadow-[var(--shadow-glow-cyan-lg)] uppercase tracking-wider relative overflow-hidden group">
            <span className="relative z-10">New Project</span>
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
          </button>
          <div className="flex-1 max-w-2xl relative text-erp-text-bright">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-erp-cyan w-5 h-5" />
            <input 
              className="w-full bg-erp-panel border border-erp-border rounded-lg py-3 pl-12 pr-4 text-erp-text-bright focus:outline-none focus:border-erp-cyan focus:ring-1 focus:ring-erp-cyan transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]" 
              placeholder="SEARCH ASSETS..." 
              type="text"
            />
          </div>
          <button className="bg-erp-panel border border-erp-border text-erp-text-bright px-6 py-3 rounded-lg flex items-center gap-3 hover:border-erp-cyan transition-colors">
            <svg className="w-5 h-5 text-erp-text" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            <span className="font-semibold tracking-wider italic">STATUS</span>
            <ChevronDown className="w-4 h-4 ml-2" />
          </button>
        </div>

        {/* Data Table Container */}
        <div className="bg-erp-panel/50 backdrop-blur-md border border-erp-cyan/50 rounded-xl shadow-[var(--shadow-glow-cyan)] relative flex-1 flex flex-col overflow-hidden">
          {/* Corner decorations */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-erp-cyan"></div>
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-erp-cyan"></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-erp-cyan"></div>
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-erp-cyan"></div>
          
          {/* Table */}
          <div className="overflow-auto flex-1 p-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-erp-cyan/30 text-erp-text-bright text-lg">
                  <th className="py-4 px-6 font-semibold tracking-wider w-1/3 italic uppercase">Asset Name</th>
                  <th className="py-4 px-6 font-semibold tracking-wider w-1/6 italic uppercase">Status</th>
                  <th className="py-4 px-6 font-semibold tracking-wider w-1/3 italic uppercase">Completion</th>
                  <th className="py-4 px-6 font-semibold tracking-wider w-1/6 italic uppercase">UID</th>
                </tr>
              </thead>
              <tbody className="text-lg">
                {activeProjects.map((project, index) => (
                  <tr key={index} className="border-b border-erp-purple/20 hover:bg-erp-purple/5 transition-colors group">
                    <td className="py-4 px-6 font-medium text-erp-text-bright group-hover:text-white transition-colors uppercase tracking-tight">{project.name}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-4 py-1 rounded-full font-bold text-sm tracking-wider ${project.statusColor}`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-4">
                        <div className="progress-bar-container w-48">
                          <div className="progress-bar-decor"></div>
                          <div className="progress-bar-fill" style={{ width: `${project.progress}%` }}></div>
                        </div>
                        <span className={`font-bold font-mono ${project.progressColor || 'text-erp-cyan'}`}>{project.progress}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-erp-text font-mono group-hover:text-erp-text-bright">{project.uid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="flex justify-end pt-4 shrink-0">
          <div className="bg-erp-panel border border-erp-cyan/40 rounded px-6 py-2 flex items-center space-x-6 text-xs font-mono text-erp-text shadow-[var(--shadow-glow-cyan)]">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-erp-cyan shadow-[var(--shadow-glow-cyan)]"></div>
              <span>CORE: 38.2°C</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-erp-purple shadow-[var(--shadow-glow-purple)]"></div>
              <span>ID: 268/S</span>
            </div>
            <div className="text-erp-text-bright">
              <span>UTC {time.toISOString().substring(11, 19)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
