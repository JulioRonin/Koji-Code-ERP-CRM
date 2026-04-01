import React, { useState } from 'react';
import { 
  Users, 
  Briefcase, 
  Wallet, 
  Search, 
  Plus, 
  ChevronRight, 
  Mail, 
  Phone, 
  Calendar,
  BadgeCheck,
  Zap,
  Award,
  History,
  TrendingUp,
  Download,
  CreditCard,
  UserCheck,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { STAFF_MEMBERS, ROLES, StaffMember } from '@/data/crmData';
import { cn } from '@/lib/utils';

export function Personnel() {
  const [activeTab, setActiveTab] = useState<'directory' | 'roles' | 'payroll'>('directory');
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [staff, setStaff] = useState<StaffMember[]>(STAFF_MEMBERS);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '',
    role: ROLES[1].name,
    department: 'Producción',
    email: '',
    phone: '',
    baseSalary: 0,
    bonus: 0
  });

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `STF-${String(staff.length + 1).padStart(3, '0')}`;
    const avatar = newStaff.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    
    const newcomer: StaffMember = {
      id,
      name: newStaff.name,
      role: newStaff.role,
      department: newStaff.department,
      avatar,
      email: newStaff.email,
      phone: newStaff.phone,
      status: 'Activo',
      joinDate: new Date().toISOString().split('T')[0],
      portfolio: {
        bio: `Nuevo colaborador integrante del equipo de ${newStaff.department}.`,
        skills: [
          { name: 'Trabajo en Equipo', level: 90 },
          { name: 'Adaptabilidad', level: 85 }
        ],
        certifications: [],
        experience: 'Registro inicial de sistema.'
      },
      salary: {
        base: newStaff.baseSalary,
        bonus: newStaff.bonus,
        currency: 'MXN',
        lastPaymentDate: 'N/A'
      }
    };

    setStaff(prev => [...prev, newcomer]);
    setIsRegisterModalOpen(false);
    setNewStaff({
      name: '',
      role: ROLES[1].name,
      department: 'Producción',
      email: '',
      phone: '',
      baseSalary: 0,
      bonus: 0
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cyber-neon font-cyber uppercase tracking-widest">Gestión de Personal</h1>
          <p className="text-sm text-cyber-muted font-mono uppercase text-[10px] tracking-[0.2em]">CRM Interno: Talento, Roles y Nómina (Nivel Maestro)</p>
        </div>
        <Button 
          onClick={() => setIsRegisterModalOpen(true)}
          className="bg-cyber-neon text-cyber-dark hover:bg-cyber-neon/90 font-cyber text-xs uppercase shadow-[0_0_15px_rgba(0,240,255,0.3)]"
        >
          <Plus className="mr-2 h-4 w-4" /> Registrar Personal
        </Button>
      </div>

      {/* Module Tabs */}
      <div className="flex items-center gap-1 p-1 bg-black/40 border border-cyber-border rounded-lg w-fit no-print">
        <button
          onClick={() => setActiveTab('directory')}
          className={cn(
            "flex items-center gap-2 px-6 py-2 text-[10px] font-mono font-bold uppercase transition-all rounded-md tracking-widest",
            activeTab === 'directory' 
              ? "bg-cyber-neon text-cyber-dark shadow-[0_0_10px_var(--color-neon-cyan)]" 
              : "text-cyber-muted hover:text-cyber-neon hover:bg-cyber-neon/10"
          )}
        >
          <Users className="h-4 w-4" /> Directorio de Staff
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={cn(
            "flex items-center gap-2 px-6 py-2 text-[10px] font-mono font-bold uppercase transition-all rounded-md tracking-widest",
            activeTab === 'roles' 
              ? "bg-cyber-neon text-cyber-dark shadow-[0_0_10px_var(--color-neon-cyan)]" 
              : "text-cyber-muted hover:text-cyber-neon hover:bg-cyber-neon/10"
          )}
        >
          <Briefcase className="h-4 w-4" /> Roles y Facultades
        </button>
        <button
          onClick={() => setActiveTab('payroll')}
          className={cn(
            "flex items-center gap-2 px-6 py-2 text-[10px] font-mono font-bold uppercase transition-all rounded-md tracking-widest",
            activeTab === 'payroll' 
              ? "bg-cyber-neon text-cyber-dark shadow-[0_0_10px_var(--color-neon-cyan)]" 
              : "text-cyber-muted hover:text-cyber-neon hover:bg-cyber-neon/10"
          )}
        >
          <Wallet className="h-4 w-4" /> Nómina Central
        </button>
      </div>

      {/* --- Directory Tab --- */}
      {activeTab === 'directory' && !selectedStaff && (
        <div className="space-y-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-cyber-muted" />
            <Input 
              placeholder="Buscar por nombre, puesto o departamento..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-black/40 border-cyber-border text-xs text-white font-mono"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStaff.map(member => (
              <Card 
                key={member.id} 
                className="border-cyber-border bg-cyber-panel/40 backdrop-blur-sm hover:border-cyber-neon/50 transition-all cursor-pointer group relative overflow-hidden"
                onClick={() => setSelectedStaff(member)}
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                  <UserCheck className="h-20 w-20 text-cyber-neon" />
                </div>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full border-2 border-cyber-neon flex items-center justify-center font-bold text-xl text-cyber-neon bg-black shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                      {member.avatar}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-cyber-text font-cyber tracking-widest uppercase">{member.name}</h3>
                      <p className="text-[10px] text-cyber-neon font-mono font-bold uppercase tracking-widest">{member.role}</p>
                      <Badge variant="outline" className="mt-1 bg-cyber-neon/10 text-cyber-neon border-cyber-neon/30 text-[9px]">
                        {member.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-[11px] font-mono text-cyber-muted">
                    <p className="flex items-center gap-2"><Mail className="h-3 w-3" /> {member.email}</p>
                    <p className="flex items-center gap-2"><Phone className="h-3 w-3" /> {member.phone}</p>
                    <p className="flex items-center gap-2"><History className="h-3 w-3" /> Unió en: {member.joinDate}</p>
                  </div>
                  <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="text-[10px] font-mono text-cyber-neon uppercase font-bold">Ver Portafolio Técnico</span>
                    <ChevronRight className="h-4 w-4 text-cyber-muted group-hover:text-cyber-neon" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* --- Individual Staff Portfolio View --- */}
      {activeTab === 'directory' && selectedStaff && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <Button variant="ghost" onClick={() => setSelectedStaff(null)} className="text-cyber-muted hover:text-cyber-neon">
            ← Volver al Directorio
          </Button>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Identity Card */}
            <Card className="col-span-1 border-cyber-border bg-cyber-panel/60 h-fit">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                <div className="h-32 w-32 rounded-full border-4 border-cyber-neon flex items-center justify-center font-bold text-4xl text-cyber-neon bg-black shadow-[0_0_30px_rgba(0,240,255,0.4)]">
                  {selectedStaff.avatar}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-cyber-text font-cyber tracking-widest uppercase">{selectedStaff.name}</h2>
                  <p className="text-sm font-mono text-cyber-neon font-bold mt-1">{selectedStaff.role}</p>
                  <p className="text-xs text-cyber-muted mt-2 font-mono italic uppercase tracking-tighter">{selectedStaff.department}</p>
                </div>
                <div className="w-full space-y-3 pt-6 border-t border-white/10">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-cyber-muted uppercase">Eficiencia General:</span>
                    <span className="text-cyber-neon font-bold">94%</span>
                  </div>
                  <Progress value={94} className="h-2" />
                </div>
                <Button className="w-full bg-cyber-accent text-cyber-dark hover:bg-cyber-accent/80 font-cyber text-xs uppercase">
                  Editar Información
                </Button>
              </CardContent>
            </Card>

            {/* Right: Technical Portfolio */}
            <div className="col-span-1 lg:col-span-2 space-y-8">
              <Card className="border-cyber-border bg-cyber-panel/40 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-3">
                  <Award className="h-10 w-10 text-cyber-neon opacity-20" />
                </div>
                <CardHeader>
                  <CardTitle className="text-cyber-neon font-cyber text-sm uppercase tracking-[0.3em]">Habilidades y Competencias</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-6">
                    {selectedStaff.portfolio.skills.map(skill => (
                      <div key={skill.name} className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-cyber-text uppercase font-bold">{skill.name}</span>
                          <span className="text-cyber-neon">{skill.level}%</span>
                        </div>
                        <Progress value={skill.level} className="h-1.5" />
                      </div>
                    ))}
                   </div>
                   <div className="bg-black/30 p-6 rounded-lg border border-white/5 space-y-4">
                     <h4 className="text-[10px] font-mono font-bold text-cyber-accent uppercase tracking-widest flex items-center gap-2">
                       <BadgeCheck className="h-4 w-4" /> Certificaciones Maestras
                     </h4>
                     <ul className="space-y-3">
                        {selectedStaff.portfolio.certifications.map(cert => (
                          <li key={cert} className="flex items-center gap-3 text-xs font-mono text-cyber-muted">
                            <Zap className="h-3 w-3 text-cyber-neon" /> {cert}
                          </li>
                        ))}
                     </ul>
                   </div>
                </CardContent>
              </Card>

              <Card className="border-cyber-border bg-cyber-panel/40">
                <CardHeader>
                  <CardTitle className="text-cyber-neon font-cyber text-sm uppercase tracking-[0.3em]">Biografía Profesional / Portfolio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 font-mono">
                  <div>
                    <h4 className="text-[10px] text-cyber-muted uppercase mb-2 tracking-widest">Resumen:</h4>
                    <p className="text-sm text-cyber-text text-justify leading-relaxed">{selectedStaff.portfolio.bio}</p>
                  </div>
                  <div>
                    <h4 className="text-[10px] text-cyber-muted uppercase mb-2 tracking-widest">Experiencia Previa:</h4>
                    <p className="text-sm text-gray-400 bg-black/20 p-4 rounded-md border border-white/5 italic">"{selectedStaff.portfolio.experience}"</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* --- Roles Management Tab --- */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <Card className="border-cyber-border bg-cyber-panel/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-cyber-neon font-cyber uppercase tracking-widest">Matriz de Roles y Facultades</CardTitle>
                <CardDescription className="text-cyber-muted font-mono text-[10px] uppercase">Control de acceso y responsabilidades por perfil.</CardDescription>
              </div>
              <Button size="sm" className="bg-cyber-neon/10 text-cyber-neon border border-cyber-neon/30 hover:bg-cyber-neon/20 font-mono text-[10px] uppercase">
                Definir Nuevo Rol
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader className="bg-black/40">
                  <TableRow className="border-cyber-border hover:bg-transparent">
                    <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">ID</TableHead>
                    <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Nombre del Rol</TableHead>
                    <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Descripción de Alcance</TableHead>
                    <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Permisos</TableHead>
                    <TableHead className="text-right text-cyber-muted font-mono text-[10px] uppercase py-4 pr-6">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ROLES.map(role => (
                    <TableRow key={role.id} className="border-cyber-border hover:bg-cyber-neon/5 transition-colors">
                      <TableCell className="font-mono text-[10px] text-cyber-neon">{role.id}</TableCell>
                      <TableCell className="font-bold text-cyber-text uppercase text-xs">{role.name}</TableCell>
                      <TableCell className="text-cyber-muted text-[11px] font-mono italic">{role.description}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-[8px] bg-emerald-400/5 border-emerald-400/20 text-emerald-400">LECTURA</Badge>
                          <Badge variant="outline" className="text-[8px] bg-cyber-accent/5 border-cyber-accent/20 text-cyber-accent">ESCRITURA</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm" className="h-8 text-cyber-muted hover:text-cyber-neon">Editar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- Payroll Management Tab --- */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          {/* Payroll Highlight Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
            {[
              { label: 'Costo Total Nómina', val: '$105,000', icon: TrendingUp, color: 'text-cyber-neon' },
              { label: 'Próximo Pago', val: '15-ABR-2026', icon: CreditCard, color: 'text-cyber-accent' },
              { label: 'Bonos Proyectados', val: '$12,500', icon: Zap, color: 'text-amber-400' },
              { label: 'Colaboradores Pagados', val: '24 / 25', icon: BadgeCheck, color: 'text-emerald-400' }
            ].map(stat => (
              <Card key={stat.label} className="bg-black/40 border-cyber-border">
                <CardContent className="p-4 flex items-center justify-between">
                   <div className="space-y-1">
                      <p className="text-[9px] text-cyber-muted font-mono uppercase tracking-widest">{stat.label}</p>
                      <p className={cn("text-xl font-bold font-cyber", stat.color)}>{stat.val}</p>
                   </div>
                   <stat.icon className={cn("h-8 w-8 opacity-20", stat.color)} />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-cyber-border bg-cyber-panel/40">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-6">
              <div>
                <CardTitle className="text-cyber-neon font-cyber uppercase tracking-widest">Nómina del Periodo Actual</CardTitle>
                <CardDescription className="text-cyber-muted font-mono text-[10px] uppercase tracking-widest">Cálculo de salarios base y bonos de eficiencia.</CardDescription>
              </div>
              <div className="flex gap-2 no-print">
                <Button size="sm" variant="outline" className="border-cyber-border text-[10px] font-mono text-cyber-muted hover:text-cyber-neon">
                  <Download className="mr-2 h-3 w-3" /> Reporte Bancario
                </Button>
                <Button size="sm" className="bg-cyber-neon text-cyber-dark hover:bg-cyber-neon/90 font-cyber text-[10px] uppercase">
                  Dispersar Nómina
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-black/20">
                  <TableRow className="border-cyber-border hover:bg-transparent">
                    <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4 pl-6">Colaborador</TableHead>
                    <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Sueldo Base</TableHead>
                    <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Bono Eficiencia</TableHead>
                    <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Total Bruto</TableHead>
                    <TableHead className="text-cyber-muted font-mono text-[10px] uppercase py-4">Estatus Pago</TableHead>
                    <TableHead className="text-right text-cyber-muted font-mono text-[10px] uppercase py-4 pr-6">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map(member => (
                    <TableRow key={member.id} className="border-cyber-border hover:bg-cyber-neon/5 transition-colors">
                      <TableCell className="py-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full border border-cyber-neon/30 flex items-center justify-center font-bold text-[10px] text-cyber-neon bg-black">
                            {member.avatar}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-cyber-text uppercase">{member.name}</p>
                            <p className="text-[9px] font-mono text-cyber-muted uppercase">{member.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-cyber-text">
                        {member.salary.base.toLocaleString()} {member.salary.currency}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-cyber-accent">
                        + {member.salary.bonus.toLocaleString()} {member.salary.currency}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-cyber-neon">
                        {(member.salary.base + member.salary.bonus).toLocaleString()} {member.salary.currency}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-emerald-400/10 text-emerald-400 border-emerald-400/30 text-[9px] uppercase font-mono">
                          DEPÓSITO LISTO
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm" className="h-8 text-cyber-muted hover:text-cyber-neon font-mono text-[10px] uppercase">
                          Recibo
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- Register Staff Modal --- */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 no-print">
          <Card className="w-full max-w-2xl border-cyber-neon/50 bg-cyber-panel shadow-[0_0_50px_rgba(0,240,255,0.2)] animate-in zoom-in-95 duration-200">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-6">
              <div className="space-y-1">
                <CardTitle className="text-cyber-neon font-cyber uppercase tracking-widest">Registrar Nuevo Colaborador</CardTitle>
                <CardDescription className="text-cyber-muted font-mono text-[10px] uppercase">Ingresa los parámetros de identificación y contrato.</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-cyber-muted hover:text-cyber-neon hover:bg-transparent"
              >
                <X className="h-6 w-6" />
              </Button>
            </CardHeader>
            <form onSubmit={handleRegister}>
              <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-cyber-muted uppercase tracking-widest">Nombre Completo</label>
                    <Input 
                      required
                      placeholder="EJ: JUAN PEREZ"
                      value={newStaff.name}
                      onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                      className="bg-black/40 border-cyber-border text-xs text-white font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-cyber-muted uppercase tracking-widest">Correo Electrónico</label>
                    <Input 
                      required
                      type="email"
                      placeholder="EMAIL@SISTEMA.COM"
                      value={newStaff.email}
                      onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                      className="bg-black/40 border-cyber-border text-xs text-white font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-cyber-muted uppercase tracking-widest">Departamento</label>
                    <select 
                      value={newStaff.department}
                      onChange={(e) => setNewStaff({...newStaff, department: e.target.value})}
                      className="w-full h-10 px-3 bg-black/40 border border-cyber-border rounded-md text-xs text-white font-mono outline-none focus:border-cyber-neon transition-colors"
                    >
                      <option value="Diseño e Ingeniería">Diseño e Ingeniería</option>
                      <option value="Producción">Producción</option>
                      <option value="Calidad / Metrología">Calidad / Metrología</option>
                      <option value="Administración">Administración</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-cyber-muted uppercase tracking-widest">Rol Asignado</label>
                    <select 
                      value={newStaff.role}
                      onChange={(e) => setNewStaff({...newStaff, role: e.target.value})}
                      className="w-full h-10 px-3 bg-black/40 border border-cyber-border rounded-md text-xs text-white font-mono outline-none focus:border-cyber-neon transition-colors"
                    >
                      {ROLES.map(r => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-cyber-muted uppercase tracking-widest">Sueldo Base (MXN)</label>
                      <Input 
                        type="number"
                        placeholder="0.00"
                        value={newStaff.baseSalary}
                        onChange={(e) => setNewStaff({...newStaff, baseSalary: Number(e.target.value)})}
                        className="bg-black/40 border-cyber-border text-xs text-white font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-cyber-muted uppercase tracking-widest">Bono Mensual (MXN)</label>
                      <Input 
                        type="number"
                        placeholder="0.00"
                        value={newStaff.bonus}
                        onChange={(e) => setNewStaff({...newStaff, bonus: Number(e.target.value)})}
                        className="bg-black/40 border-cyber-border text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-cyber-muted uppercase tracking-widest">Teléfono de Contacto</label>
                    <Input 
                      placeholder="+52 000 000 0000"
                      value={newStaff.phone}
                      onChange={(e) => setNewStaff({...newStaff, phone: e.target.value})}
                      className="bg-black/40 border-cyber-border text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </CardContent>
              <div className="p-8 pt-0 flex gap-4">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="flex-1 border-cyber-border text-cyber-muted hover:text-white font-cyber text-xs uppercase"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  className="flex-1 bg-cyber-neon text-cyber-dark hover:bg-cyber-neon/90 font-cyber text-xs uppercase shadow-[0_0_20px_rgba(0,240,255,0.4)]"
                >
                  Finalizar Registro
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

