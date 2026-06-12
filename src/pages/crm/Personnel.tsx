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
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
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
import { ROLES } from '@/data/crmData';
import { cn } from '@/lib/utils';
import { useProfiles, useUpdateProfile, useCreateStaffWithAuth, generateTempPassword } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile } from '@/types/database';

const ADMIN_ROLES = ['Administrador', 'Administración / PM'];

function initialsFor(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const tabs = [
  { id: 'directory', label: 'Directorio',         icon: Users },
  { id: 'roles',     label: 'Roles y facultades',  icon: Briefcase },
  { id: 'payroll',   label: 'Nómina',              icon: Wallet },
] as const;
type Tab = (typeof tabs)[number]['id'];

export function Personnel() {
  const { user } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
  const [activeTab, setActiveTab] = useState<Tab>('directory');
  const [selectedStaff, setSelectedStaff] = useState<Profile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { data: staff, refetch: refetchStaff } = useProfiles();
  const { update: updateProfile, loading: savingProfile } = useUpdateProfile();
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<{
    full_name: string;
    email: string;
    role: string;
    department: string;
    phone: string;
    bio: string;
    salary: number;
    status: string;
  } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [newStaff, setNewStaff] = useState({
    name: '',
    role: ROLES[1].name,
    department: 'Producción',
    email: '',
    phone: '',
    baseSalary: 0,
    bonus: 0,
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    full_name: string;
    email: string;
    password: string;
    role: string;
    department: string;
  } | null>(null);
  const { create: createStaff, loading: creatingStaff } = useCreateStaffWithAuth();

  const filteredStaff = staff.filter(
    s =>
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openEdit = (member: Profile) => {
    setEditError(null);
    setEditDraft({
      full_name: member.full_name,
      email: member.email,
      role: member.role,
      department: member.department,
      phone: member.phone ?? '',
      bio: member.bio ?? '',
      salary: member.salary ?? 0,
      status: member.status,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDraft || !selectedStaff) return;
    setEditError(null);
    try {
      await updateProfile(selectedStaff.id, {
        full_name: editDraft.full_name,
        email: editDraft.email,
        role: editDraft.role,
        department: editDraft.department,
        phone: editDraft.phone || null,
        bio: editDraft.bio || null,
        salary: editDraft.salary,
        status: editDraft.status,
      });
      await refetchStaff();
      setSelectedStaff(prev =>
        prev
          ? {
              ...prev,
              full_name: editDraft.full_name,
              email: editDraft.email,
              role: editDraft.role,
              department: editDraft.department,
              phone: editDraft.phone || null,
              bio: editDraft.bio || null,
              salary: editDraft.salary,
              status: editDraft.status,
            }
          : prev
      );
      setEditDraft(null);
    } catch (err) {
      setEditError((err as Error).message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    if (!newStaff.password || newStaff.password.length < 8) {
      setRegisterError('La contraseña debe tener al menos 8 caracteres. Usa "Generar" para obtener una segura.');
      return;
    }
    try {
      await createStaff({
        full_name: newStaff.name,
        email: newStaff.email,
        password: newStaff.password,
        role: newStaff.role,
        department: newStaff.department,
        phone: newStaff.phone || null,
        salary: Number(newStaff.baseSalary) || 0,
      });
      await refetchStaff();
      // Muestra las credenciales finales para que el admin las copie/envíe
      setCreatedCredentials({
        full_name: newStaff.name,
        email: newStaff.email,
        password: newStaff.password,
        role: newStaff.role,
        department: newStaff.department,
      });
      setIsRegisterModalOpen(false);
      setNewStaff({
        name: '',
        role: ROLES[1].name,
        department: 'Producción',
        email: '',
        phone: '',
        baseSalary: 0,
        bonus: 0,
        password: '',
      });
    } catch (err) {
      setRegisterError((err as Error).message);
    }
  };

  const fillRandomPassword = () => {
    setNewStaff(s => ({ ...s, password: generateTempPassword() }));
    setShowPassword(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      /* ignore */
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
        {isAdmin && (
          <Button onClick={() => setIsRegisterModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Registrar personal
          </Button>
        )}
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
                      {initialsFor(member.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{member.full_name}</h3>
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
                      <Phone className="h-3 w-3 shrink-0" /> {member.phone ?? '—'}
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
                  {initialsFor(selectedStaff.full_name)}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{selectedStaff.full_name}</h2>
                  <p className="text-sm text-[var(--color-app-text-muted)] mt-0.5">{selectedStaff.role}</p>
                  <p className="text-xs text-[var(--color-app-text-muted)] mt-1">{selectedStaff.department}</p>
                </div>
                <div className="w-full space-y-1.5 pt-3 border-t border-[var(--color-app-border)]">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-app-text-muted)]">Eficiencia general</span>
                    <span className="font-medium">{selectedStaff.metadata.efficiency ?? 90}%</span>
                  </div>
                  <Progress value={selectedStaff.metadata.efficiency ?? 90} className="h-1.5" />
                </div>
                {isAdmin ? (
                  <Button variant="outline" className="w-full" onClick={() => openEdit(selectedStaff)}>
                    Editar información
                  </Button>
                ) : (
                  <p className="text-xs text-[var(--color-app-text-muted)] text-center">
                    Sólo administradores pueden editar la información del personal.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Habilidades y competencias</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {(selectedStaff.metadata.skills ?? []).map(skill => (
                      <div key={skill.name} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{skill.name}</span>
                          <span className="font-medium">{skill.level}%</span>
                        </div>
                        <Progress value={skill.level} className="h-1.5" />
                      </div>
                    ))}
                    {!selectedStaff.metadata.skills?.length && (
                      <p className="text-xs text-[var(--color-app-text-muted)]">Sin habilidades registradas.</p>
                    )}
                  </div>
                  <div className="bg-[var(--color-app-surface-alt)] p-4 rounded-md space-y-2">
                    <h4 className="text-xs font-medium text-[var(--color-app-text-muted)] flex items-center gap-1.5">
                      <BadgeCheck className="h-3.5 w-3.5" /> Certificaciones
                    </h4>
                    <ul className="space-y-2">
                      {(selectedStaff.metadata.certifications ?? []).map(cert => (
                        <li key={cert} className="flex items-center gap-2 text-sm">
                          <Zap className="h-3 w-3 text-[var(--color-app-primary)]" /> {cert}
                        </li>
                      ))}
                      {!selectedStaff.metadata.certifications?.length && (
                        <li className="text-xs text-[var(--color-app-text-muted)]">Sin certificaciones registradas.</li>
                      )}
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
                    <p className="text-sm leading-relaxed">{selectedStaff.bio ?? 'Sin biografía.'}</p>
                  </div>
                  <div>
                    <h4 className="text-xs text-[var(--color-app-text-muted)] mb-1">Experiencia previa</h4>
                    <p className="text-sm bg-[var(--color-app-surface-alt)] p-3 rounded-md">
                      {selectedStaff.metadata.experience ?? 'Sin experiencia registrada.'}
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
                  {staff.map(member => {
                    const bonus = member.metadata.bonus ?? 0;
                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-[var(--color-app-primary)] text-white flex items-center justify-center text-xs font-medium">
                              {initialsFor(member.full_name)}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{member.full_name}</p>
                              <p className="text-xs text-[var(--color-app-text-muted)] font-mono">{member.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          ${member.salary.toLocaleString()} MXN
                        </TableCell>
                        <TableCell className="tabular-nums text-[var(--color-app-success)]">
                          +${bonus.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums">
                          ${(member.salary + bonus).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="success">Depósito listo</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">Recibo</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit modal (sólo administradores) */}
      {editDraft && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl p-0">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--color-app-border)]">
              <div>
                <CardTitle>Editar información del personal</CardTitle>
                <CardDescription>
                  {selectedStaff.full_name} · acción exclusiva de administradores.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditDraft(null);
                  setEditError(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <form onSubmit={handleSaveEdit}>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Nombre completo</label>
                    <Input
                      required
                      value={editDraft.full_name}
                      onChange={e => setEditDraft({ ...editDraft, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Correo electrónico</label>
                    <Input
                      required
                      type="email"
                      value={editDraft.email}
                      onChange={e => setEditDraft({ ...editDraft, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Teléfono</label>
                    <Input
                      value={editDraft.phone}
                      onChange={e => setEditDraft({ ...editDraft, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Departamento</label>
                    <select
                      value={editDraft.department}
                      onChange={e => setEditDraft({ ...editDraft, department: e.target.value })}
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
                      value={editDraft.role}
                      onChange={e => setEditDraft({ ...editDraft, role: e.target.value })}
                      className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
                    >
                      {ROLES.map(r => (
                        <option key={r.id} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Estatus</label>
                    <select
                      value={editDraft.status}
                      onChange={e => setEditDraft({ ...editDraft, status: e.target.value })}
                      className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
                    >
                      <option value="Activo">Activo</option>
                      <option value="Inactivo">Inactivo</option>
                      <option value="Vacaciones">Vacaciones</option>
                      <option value="Incapacidad">Incapacidad</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Sueldo base (MXN)</label>
                    <Input
                      type="number"
                      value={editDraft.salary}
                      onChange={e => setEditDraft({ ...editDraft, salary: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Biografía profesional</label>
                    <textarea
                      rows={3}
                      value={editDraft.bio}
                      onChange={e => setEditDraft({ ...editDraft, bio: e.target.value })}
                      className="w-full px-3 py-2 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)]"
                    />
                  </div>
                </div>
              </CardContent>

              {editError && (
                <div className="mx-6 mb-4 p-3 rounded-md bg-[var(--color-app-danger-soft)] text-sm text-[var(--color-app-danger)]">
                  {editError}
                </div>
              )}

              <div className="p-6 pt-0 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditDraft(null);
                    setEditError(null);
                  }}
                  className="flex-1"
                  disabled={savingProfile}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={savingProfile}>
                  {savingProfile ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </form>
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

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5" /> Contraseña inicial
                    </label>
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <Input
                          required
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Genera una o tipéala"
                          value={newStaff.password}
                          onChange={e => setNewStaff({ ...newStaff, password: e.target.value })}
                          className="pr-9 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          className="absolute right-2 top-2 text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)]"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={fillRandomPassword}
                        title="Generar contraseña segura"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Generar
                      </Button>
                    </div>
                    <p className="text-[10px] text-[var(--color-app-text-muted)] leading-snug">
                      Se le compartirá al usuario al cerrar el registro. Mín. 8 caracteres.
                    </p>
                  </div>
                </div>
              </CardContent>
              {registerError && (
                <div className="mx-6 mb-3 p-3 rounded-md bg-[var(--color-app-danger-soft)] text-sm text-[var(--color-app-danger)] flex gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="leading-snug">{registerError}</span>
                </div>
              )}
              <div className="p-6 pt-0 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="flex-1"
                  disabled={creatingStaff}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={creatingStaff}>
                  {creatingStaff ? 'Creando cuenta…' : 'Finalizar registro'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Diálogo de credenciales creadas */}
      {createdCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-0">
            <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--color-app-border)]">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[var(--color-app-success)]" />
                  Cuenta creada
                </CardTitle>
                <CardDescription>
                  Comparte estas credenciales con {createdCredentials.full_name}. No volverán a
                  mostrarse.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCreatedCredentials(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <CredentialRow label="Nombre" value={createdCredentials.full_name} onCopy={copyToClipboard} />
              <CredentialRow label="Rol · Depto" value={`${createdCredentials.role} · ${createdCredentials.department}`} onCopy={copyToClipboard} />
              <CredentialRow label="Correo" value={createdCredentials.email} onCopy={copyToClipboard} mono />
              <CredentialRow label="Contraseña" value={createdCredentials.password} onCopy={copyToClipboard} mono highlight />
              <Button
                className="w-full"
                onClick={() => {
                  copyToClipboard(
                    `Hola ${createdCredentials.full_name},\n\n` +
                      `Tu cuenta en Koji Code ERP está lista:\n` +
                      `Correo: ${createdCredentials.email}\n` +
                      `Contraseña: ${createdCredentials.password}\n` +
                      `Rol: ${createdCredentials.role} (${createdCredentials.department})\n\n` +
                      `Te pediremos cambiar la contraseña en tu primer ingreso.`
                  );
                }}
              >
                <Copy className="h-4 w-4 mr-1.5" /> Copiar mensaje completo
              </Button>
              <p className="text-[11px] text-[var(--color-app-text-muted)] leading-snug">
                Si Supabase tiene activado <strong>Confirm email</strong>, el usuario deberá
                confirmar el correo antes del primer ingreso. Para uso interno típicamente se
                desactiva esa opción en Auth Settings.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface CredentialRowProps {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  onCopy: (text: string) => void;
}

function CredentialRow({ label, value, mono, highlight, onCopy }: CredentialRowProps) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className={
        highlight
          ? 'p-3 rounded-md border border-[var(--color-app-primary)]/30 bg-[var(--color-app-primary-soft)]/40'
          : 'p-3 rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-surface-alt)]/50'
      }
    >
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-app-text-muted)] mb-0.5">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={
            mono ? 'flex-1 font-mono text-sm break-all' : 'flex-1 text-sm break-words'
          }
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => {
            onCopy(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="p-1.5 rounded hover:bg-white"
          title="Copiar"
        >
          {copied ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-app-success)]" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-[var(--color-app-text-muted)]" />
          )}
        </button>
      </div>
    </div>
  );
}
