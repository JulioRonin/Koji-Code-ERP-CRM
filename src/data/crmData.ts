export interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar: string;
  email: string;
  password?: string; // New field for mock auth
  phone: string;
  status: 'Activo' | 'Inactivo' | 'Vacaciones';
  joinDate: string;
  portfolio: {
    bio: string;
    skills: { name: string; level: number }[];
    certifications: string[];
    experience: string;
  };
  salary: {
    base: number;
    bonus: number;
    currency: string;
    lastPaymentDate: string;
  };
}

export const STAFF_MEMBERS: StaffMember[] = [
  {
    id: 'STF-001',
    name: 'Roberto Gomez',
    role: 'Ingeniero de Diseño Senior',
    department: 'Diseño',
    avatar: 'RG',
    email: 'roberto.g@roninstudio.com',
    password: '123',
    phone: '+52 555 123 4567',
    status: 'Activo',
    joinDate: '2022-03-15',
    portfolio: {
      bio: 'Especialista en CAD/CAM con 10 años de experiencia en la industria aeroespacial.',
      skills: [
        { name: 'SolidWorks', level: 95 },
        { name: 'CAMWorks', level: 90 },
        { name: 'Análisis de Tensiones', level: 85 }
      ],
      certifications: ['CSWP Mechanical Design', 'Expert CAD Designer'],
      experience: 'Ex-ingeniero en Boeing. Lideró 15 proyectos de ensamblaje complejo.'
    },
    salary: {
      base: 45000,
      bonus: 5000,
      currency: 'MXN',
      lastPaymentDate: '2026-03-30'
    }
  },
  {
    id: 'STF-002',
    name: 'Ana Martinez',
    role: 'Operador CNC Master',
    department: 'Producción',
    avatar: 'AM',
    email: 'ana.m@roninstudio.com',
    password: '123',
    phone: '+52 555 987 6543',
    status: 'Activo',
    joinDate: '2023-01-10',
    portfolio: {
      bio: 'Experta en centros de maquinado de 5 ejes y tornos suizos.',
      skills: [
        { name: 'Maquinado 5 Ejes', level: 98 },
        { name: 'Mantenimiento Preventivo', level: 85 },
        { name: 'Metrología', level: 90 }
      ],
      certifications: ['Fanuc Master Class', 'Metrología Avanzada'],
      experience: '7 años operando maquinaria de alta precisión en General Electric.'
    },
    salary: {
      base: 32000,
      bonus: 3500,
      currency: 'MXN',
      lastPaymentDate: '2026-03-30'
    }
  },
  {
    id: 'STF-003',
    name: 'Julian Herrera',
    role: 'Técnico de Calidad',
    department: 'Calidad',
    avatar: 'JH',
    email: 'julian.h@roninstudio.com',
    password: '123',
    phone: '+52 555 456 7890',
    status: 'Activo',
    joinDate: '2023-06-20',
    portfolio: {
      bio: 'Especialista en control dimensional y normativas ISO.',
      skills: [
        { name: 'CMM Programming', level: 88 },
        { name: 'GD&T', level: 95 },
        { name: 'ISO 9001', level: 90 }
      ],
      certifications: ['ISO 9001 Lead Auditor', 'CMM Zeiss Professional'],
      experience: 'Control de calidad en plantas automotrices de Ford.'
    },
    salary: {
      base: 28000,
      bonus: 2000,
      currency: 'MXN',
      lastPaymentDate: '2026-03-30'
    }
  },
  {
    id: 'STF-004',
    name: 'Admin User',
    role: 'Administrador Senior',
    department: 'Administrador',
    avatar: 'AD',
    email: 'admin@imcdesign.com',
    password: 'admin',
    phone: '+52 555 000 1111',
    status: 'Activo',
    joinDate: '2020-01-01',
    portfolio: {
      bio: 'Root user with full system permissions.',
      skills: [{ name: 'Enterprise Management', level: 100 }],
      certifications: [],
      experience: 'Full control'
    },
    salary: { base: 80000, bonus: 10000, currency: 'MXN', lastPaymentDate: '2026-03-30' }
  },
  {
    id: 'STF-005',
    name: 'Técnico Senior',
    role: 'Técnico Especialista',
    department: 'Técnico',
    avatar: 'TE',
    email: 'tecnico@imcdesign.com',
    password: '123',
    phone: '+52 555 222 3333',
    status: 'Activo',
    joinDate: '2024-01-01',
    portfolio: {
      bio: 'Técnico asignado a piso.',
      skills: [{ name: 'Mantenimiento', level: 90 }],
      certifications: [],
      experience: '5 años'
    },
    salary: { base: 20000, bonus: 1000, currency: 'MXN', lastPaymentDate: '2026-03-30' }
  },
  {
    id: 'STF-006',
    name: 'Gerente Compras',
    role: 'Purchasing Manager',
    department: 'Compras',
    avatar: 'GC',
    email: 'compras@imcdesign.com',
    password: '123',
    phone: '+52 555 444 5555',
    status: 'Activo',
    joinDate: '2021-05-01',
    portfolio: {
      bio: 'Especialista en cadena de suministro.',
      skills: [{ name: 'Negotiation', level: 95 }],
      certifications: [],
      experience: '8 años'
    },
    salary: { base: 35000, bonus: 4000, currency: 'MXN', lastPaymentDate: '2026-03-30' }
  },
  {
    id: 'STF-007',
    name: 'Gerente Admin',
    role: 'Project Manager',
    department: 'Administración / PM',
    avatar: 'PM',
    email: 'pm@imcdesign.com',
    password: '123',
    phone: '+52 555 777 8888',
    status: 'Activo',
    joinDate: '2022-01-01',
    portfolio: {
      bio: 'Gestión de proyectos y administración global.',
      skills: [{ name: 'PMO', level: 98 }],
      certifications: [],
      experience: '10 años'
    },
    salary: { base: 50000, bonus: 6000, currency: 'MXN', lastPaymentDate: '2026-03-30' }
  }
];

export const DEPARTMENTS = [
  'Administrador',
  'Administración / PM',
  'Compras',
  'Diseño',
  'Producción',
  'Calidad',
  'Técnico'
];

export const ROLES = [
  { id: 'R-1', name: 'Administrador', description: 'Acceso total al sistema y finanzas.' },
  { id: 'R-2', name: 'Diseñador', description: 'Gestión de modelos CAD y checklists de manufactura.' },
  { id: 'R-3', name: 'Producción', description: 'Operación de maquinaria y reporte de avance.' },
  { id: 'R-4', name: 'Compras', description: 'Gestión de proveedores e inventarios.' },
  { id: 'R-5', name: 'Calidad', description: 'Inspección de piezas y reportes de no conformidad.' }
];
