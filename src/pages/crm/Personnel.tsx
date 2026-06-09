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
  BadgeCheck,
  Zap,
  TrendingUp,
  Download,
  CreditCard,
  X,
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

const tabs = [
  { id: 'directory', label: 'Directorio',         icon: Users },
  { id: 'roles',     label: 'Roles y facultades',  icon: Briefcase },
  { id: 'payroll',   label: 'Nómina',              icon: Wallet },
] as const;
type Tab = (typeof tabs)[number]['id'];

export function Personnel() {
  const [activeTab, setActiveTab] = useState<Tab>('directory');
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
    bonus: 0,
  });

  const filteredStaff = staff.filter(
    s =>
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
        bio: `Nuevo colaborador del equipo de ${newStaff.department}.`,
        skills: [
          { name: 'Trabajo en equipo', level: 90 },
          { name: 'Adaptabilidad', level: 85 },
        ],
        certifications: [],
        experience: 'Registro inicial.',
      },
      salary: {
        base: newStaff.baseSalary,
        bonus: newStaff.bonus,
        currency: 'MXN',
        lastPaymentDate: 'N/A',
      },
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
      bonus: 0,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-app-text)]">Personal</h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">
            Talento, roles y nómina.
          </p>
        </div>
        <Button onClick={() => setIsRegisterModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Registrar personal
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[var(--color-app-surface-alt)] border border-[var(--color-app-border)] rounded-lg w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => {
              setActiveTab(t.id);
              setSelectedStaff(null);
            }}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors rounded-md',
              activeTab === t.id
                ? 'bg-white text-[var(--color-app-text)] shadow-sm'
                : 'text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]'
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Directory */}
      {activeTab === 'directory' && !selectedStaff && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-app-text-subtle)]" />
            <Input
              placeholder="Buscar por nombre, puesto o departamento..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStaff.map(member => (
              <Card
                key={member.id}
                className="p-0 cursor-pointer hover:border-[var(--color-app-primary)]/40 hover:shadow-md transition-all"
                onClick={() => setSelectedStaff(member)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-[var(--color-app-primary)] text-white flex items-center justify-center font-medium">
                      {member.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{member.name}</h3>
                      <p className="text-xs text-[var(--color-app-text-muted)] truncate mt-0.5">{member.role}</p>
                      <Badge variant="success" className="mt-1.5">{member.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pb-5">
                  <div className="space-y-1.5 text-xs text-[var(--color-app-text-muted)]">
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3 w-3 shrink-0" /> {member.email}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 shrink-0" /> {member.phone}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-[var(--color-app-border)] flex justify-between items-center text-xs">
                    <span className="text-[var(--color-app-primary)] font-medium">Ver portafolio</span>
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--color-app-text-subtle)]" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Individual staff portfolio */}
      {activeTab === 'directory' && selectedStaff && (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setSelectedStaff(null)}>
            ← Volver al directorio
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 h-fit">
              <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="h-24 w-24 rounded-full bg-[var(--color-app-primary)] text-white flex items-center justify-center text-2xl font-medium">
                  {selectedStaff.avatar}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{selectedStaff.name}</h2>
                  <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">{selectedStaff.role}</p>
                  <p className="text-xs text-[var(--color-app-text-muted)] mt-1">{selectedStaff.department}</p>
                </div>
                <div className="w-full space-y-1.5 pt-3 border-t border-[var(--color-app-border)]">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-app-text-muted)]">Eficiencia general</span>
                    <span className="font-medium">94%</span>
                  </div>
                  <Progress value={94} className="h-1.5" />
                </div>
                <Button variant="outline" className="w-full">Editar información</Button>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Habilidades y competencias</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {selectedStaff.portfolio.skills.map(skill => (
                      <div key={skill.name} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{skill.name}</span>
                          <span className="font-medium">{skill.level}%</span>
                        </div>
                        <Progress value={skill.level} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                  <div className="bg-[var(--color-app-surface-alt)] p-4 rounded-md space-y-2">
                    <h4 className="text-xs font-medium text-[var(--color-app-text-muted)] flex items-center gap-1.5">
                      <BadgeCheck className="h-3.5 w-3.5" /> Certificaciones
                    </h4>
                    <ul className="space-y-2">
                      {selectedStaff.portfolio.certifications.map(cert => (
                        <li key={cert} className="flex items-center gap-2 text-sm">
                          <Zap className="h-3 w-3 text-[var(--color-app-primary)]" /> {cert}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Biografía profesional</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-xs text-[var(--color-app-text-muted)] mb-1">Resumen</h4>
                    <p className="text-sm leading-relaxed">{selectedStaff.portfolio.bio}</p>
                  </div>
                  <div>
                    <h4 className="text-xs text-[var(--color-app-text-muted)] mb-1">Experiencia previa</h4>
                    <p className="text-sm bg-[var(--color-app-surface-alt)] p-3 rounded-md">
                      {selectedStaff.portfolio.experience}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Roles */}
      {activeTab === 'roles' && (
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Matriz de roles y facultades</CardTitle>
              <CardDescription>Control de acceso y responsabilidades por perfil.</CardDescription>
            </div>
            <Button variant="outline" size="sm">Definir nuevo rol</Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROLES.map(role => (
                  <TableRow key={role.id}>
                    <TableCell className="font-mono text-xs">{role.id}</TableCell>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="text-[var(--color-app-text-muted)]">{role.description}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Badge variant="success">Lectura</Badge>
                        <Badge variant="warning">Escritura</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Editar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Payroll */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Costo total nómina', value: '$105,000',  icon: TrendingUp },
              { label: 'Próximo pago',        value: '15 abr 2026', icon: CreditCard },
              { label: 'Bonos proyectados',   value: '$12,500',   icon: Zap },
              { label: 'Colaboradores pagados', value: '24 / 25', icon: BadgeCheck },
            ].map(s => (
              <Card key={s.label} className="p-0">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[var(--color-app-text-muted)]">{s.label}</p>
                    <p className="text-xl font-semibold mt-1">{s.value}</p>
                  </div>
                  <s.icon className="h-5 w-5 text-[var(--color-app-text-muted)]" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Nómina del periodo</CardTitle>
                <CardDescription>Salarios base y bonos de eficiencia.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Reporte bancario
                </Button>
                <Button size="sm">Dispersar nómina</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Sueldo base</TableHead>
                    <TableHead>Bono</TableHead>
                    <TableHead>Total bruto</TableHead>
                    <TableHead>Estatus</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map(member => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-[var(--color-app-primary)] text-white flex items-center justify-center text-xs font-medium">
                            {member.avatar}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{member.name}</p>
                            <p className="text-xs text-[var(--color-app-text-muted)] font-mono">{member.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        ${member.salary.base.toLocaleString()} {member.salary.currency}
                      </TableCell>
                      <TableCell className="tabular-nums text-[var(--color-app-success)]">
                        +${member.salary.bonus.toLocaleString()}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        ${(member.salary.base + member.salary.bonus).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="success">Depósito listo</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">Recibo</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Register modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl p-0">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--color-app-border)]">
              <div>
                <CardTitle>Registrar nuevo colaborador</CardTitle>
                <CardDescription>Datos de identificación y contrato.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsRegisterModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <form onSubmit={handleRegister}>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Nombre completo</label>
                    <Input
                      required
                      placeholder="Ej: Juan Pérez"
                      value={newStaff.name}
                      onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Correo electrónico</label>
                    <Input
                      required
                      type="email"
                      placeholder="usuario@empresa.com"
                      value={newStaff.email}
                      onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Departamento</label>
                    <select
                      value={newStaff.department}
                      onChange={e => setNewStaff({ ...newStaff, department: e.target.value })}
                      className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
                    >
                      <option value="Diseño e Ingeniería">Diseño e Ingeniería</option>
                      <option value="Producción">Producción</option>
                      <option value="Calidad / Metrología">Calidad / Metrología</option>
                      <option value="Administración">Administración</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Rol asignado</label>
                    <select
                      value={newStaff.role}
                      onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}
                      className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
                    >
                      {ROLES.map(r => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Sueldo base (MXN)</label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={newStaff.baseSalary}
                        onChange={e => setNewStaff({ ...newStaff, baseSalary: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Bono (MXN)</label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={newStaff.bonus}
                        onChange={e => setNewStaff({ ...newStaff, bonus: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Teléfono</label>
                    <Input
                      placeholder="+52 000 000 0000"
                      value={newStaff.phone}
                      onChange={e => setNewStaff({ ...newStaff, phone: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
              <div className="p-6 pt-0 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setIsRegisterModalOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  Finalizar registro
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
