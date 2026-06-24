import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory,
  Shield,
  Ruler,
  ShoppingCart,
  Users,
  Briefcase,
  ChevronRight,
  ArrowLeft,
  Lock,
  Mail,
  HardHat,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { DEPARTMENTS } from '@/data/crmData';
import { motion, AnimatePresence } from 'motion/react';

export function Login() {
  const [step, setStep] = useState(1);
  const [selectedDept, setSelectedDept] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuth();
  const { company } = useCompany();
  const navigate = useNavigate();

  const handleDepartmentSelect = (dept: string) => {
    setSelectedDept(dept);
    setStep(2);
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = await login(selectedDept, email, password);

    if (result.ok) {
      if (selectedDept === 'Técnico') {
        navigate('/technician-portal');
      } else {
        navigate('/');
      }
    } else {
      setError(result.error || 'No se pudo iniciar sesión.');
    }
  };

  const getDeptIcon = (dept: string) => {
    switch (dept) {
      case 'Administrador': return Shield;
      case 'Administración / PM': return Briefcase;
      case 'Compras': return ShoppingCart;
      case 'Diseño': return Ruler;
      case 'Producción': return Factory;
      case 'Calidad': return Shield;
      case 'Técnico': return HardHat;
      default: return Users;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-app-bg)]">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.commercial_name} className="h-12 w-12 rounded-xl object-cover mb-4 shadow-sm bg-white" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-[var(--color-app-primary)] flex items-center justify-center mb-4 shadow-sm">
              <Factory className="h-6 w-6 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-semibold text-[var(--color-app-text)]">
            {company.commercial_name || company.legal_name}
          </h1>
          <p className="text-sm text-[var(--color-app-text-muted)] mt-1">
            {company.tagline || 'Plataforma de manufactura'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Selecciona tu departamento</CardTitle>
                  <CardDescription>Elige tu rol para continuar al inicio de sesión.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-2">
                  {DEPARTMENTS.map(dept => {
                    const Icon = getDeptIcon(dept);
                    return (
                      <button
                        key={dept}
                        onClick={() => handleDepartmentSelect(dept)}
                        className="flex items-center justify-between p-3 rounded-md border border-[var(--color-app-border)] bg-white hover:border-[var(--color-app-primary)] hover:bg-[var(--color-app-primary-soft)]/40 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-md bg-[var(--color-app-surface-alt)] flex items-center justify-center group-hover:bg-[var(--color-app-primary-soft)] transition-colors">
                            <Icon className="h-4 w-4 text-[var(--color-app-text-muted)] group-hover:text-[var(--color-app-primary)]" />
                          </div>
                          <span className="text-sm font-medium text-[var(--color-app-text)]">{dept}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-[var(--color-app-text-subtle)] group-hover:text-[var(--color-app-primary)] group-hover:translate-x-0.5 transition-all" />
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1 text-sm text-[var(--color-app-text-muted)] hover:text-[var(--color-app-text)] transition-colors w-fit"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Volver
                  </button>
                  <CardTitle className="text-lg mt-2">{selectedDept}</CardTitle>
                  <CardDescription>Ingresa tus credenciales para acceder.</CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    {error && (
                      <div className="p-3 bg-[var(--color-app-danger-soft)] border border-[var(--color-app-danger)]/30 rounded-md text-sm text-[var(--color-app-danger)]">
                        {error}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-[var(--color-app-text)] flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-[var(--color-app-text-muted)]" /> Correo electrónico
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm text-[var(--color-app-text)] placeholder:text-[var(--color-app-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)] transition-colors"
                        placeholder="usuario@empresa.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-[var(--color-app-text)] flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-[var(--color-app-text-muted)]" /> Contraseña
                      </label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full h-9 px-3 rounded-md border border-[var(--color-app-border-strong)] bg-white text-sm text-[var(--color-app-text)] placeholder:text-[var(--color-app-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-app-primary)]/40 focus:border-[var(--color-app-primary)] transition-colors"
                        placeholder="••••••••"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex-col gap-3 items-stretch">
                    <Button type="submit" disabled={isLoading} className="w-full">
                      {isLoading ? 'Verificando...' : 'Iniciar sesión'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-xs text-center text-[var(--color-app-primary)] hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                    <p className="text-xs text-center text-[var(--color-app-text-muted)]">
                      ¿Problemas para acceder? Contacta a tu administrador.
                    </p>
                  </CardFooter>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-xs text-[var(--color-app-text-subtle)] mt-6">
          {company.legal_name} · powered by KANRI
        </p>
      </div>
    </div>
  );
}
