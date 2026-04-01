import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, Shield, Ruler, ShoppingCart, Users, Briefcase, ChevronRight, ArrowLeft, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { DEPARTMENTS } from '@/data/crmData';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export function Login() {
  const [step, setStep] = useState(1);
  const [selectedDept, setSelectedDept] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleDepartmentSelect = (dept: string) => {
    setSelectedDept(dept);
    setStep(2);
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const success = await login(selectedDept, email, password);
    
    if (success) {
      if (selectedDept === 'Técnico') {
        navigate('/technician-portal');
      } else {
        navigate('/');
      }
    } else {
      setError('Credenciales inválidas para este departamento.');
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
      case 'Técnico': return Users;
      default: return Factory;
    }
  };

  return (
    <div className="min-h-screen bg-cyber-dark flex items-center justify-center p-4 relative overflow-hidden font-mono">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]"></div>
      <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-cyber-neon/10 blur-[120px] rounded-full"></div>
      <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-cyber-accent/10 blur-[120px] rounded-full"></div>
      
      <div className="w-full max-w-xl relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-8"
        >
          <div className="w-20 h-20 bg-black/40 border border-cyber-neon rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(0,240,255,0.2)] group transition-all hover:scale-110">
            <Factory className="w-10 h-10 text-cyber-neon group-hover:animate-pulse" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-widest uppercase drop-shadow-[0_0_15px_rgba(0,240,255,0.5)]">KOJI CODE ERP</h1>
          <div className="flex items-center gap-3 mt-2">
            <div className="h-[1px] w-8 bg-cyber-neon/50"></div>
            <p className="text-cyber-muted font-bold tracking-[0.3em] uppercase text-[10px]">Access Control Terminal</p>
            <div className="h-[1px] w-8 bg-cyber-neon/50"></div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-cyber-border bg-black/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyber-neon to-transparent"></div>
                <CardHeader>
                  <CardTitle className="text-xl text-center text-white uppercase tracking-widest font-black">Selecciona Departamento</CardTitle>
                  <CardDescription className="text-center text-cyber-muted text-[10px] uppercase font-bold tracking-tighter">Identifícate para habilitar los protocolos de seguridad</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 p-6">
                  {DEPARTMENTS.map((dept) => {
                    const Icon = getDeptIcon(dept);
                    return (
                      <button
                        key={dept}
                        onClick={() => handleDepartmentSelect(dept)}
                        className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:border-cyber-neon hover:bg-cyber-neon/5 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5 text-cyber-muted group-hover:text-cyber-neon transition-colors" />
                          <span className="text-xs font-bold text-gray-300 group-hover:text-white uppercase tracking-wider">{dept}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-cyber-muted group-hover:text-cyber-neon transition-transform group-hover:translate-x-1" />
                      </button>
                    )
                  })}
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border-cyber-border bg-black/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyber-accent to-transparent"></div>
                <CardHeader className="relative">
                   <button 
                    onClick={() => setStep(1)}
                    className="absolute left-6 top-8 text-cyber-muted hover:text-cyber-neon transition-colors flex items-center gap-1 text-[10px] uppercase font-bold"
                  >
                    <ArrowLeft className="w-3 h-3" /> Volver
                  </button>
                  <CardTitle className="text-xl text-center text-white uppercase tracking-widest font-black mt-4">{selectedDept}</CardTitle>
                  <CardDescription className="text-center text-cyber-muted text-[10px] uppercase font-bold tracking-tighter">Ingresa tus credenciales de acceso</CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4 p-6">
                    {error && (
                      <div className="p-3 bg-cyber-red/10 border border-cyber-red/30 rounded text-[10px] text-cyber-red font-bold uppercase text-center animate-shake">
                        {error}
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-cyber-neon uppercase tracking-widest flex items-center gap-2">
                        <Mail className="w-3 h-3" /> Dirección de Correo
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-black/40 border border-cyber-border rounded px-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-neon focus:ring-1 focus:ring-cyber-neon/50 transition-all"
                        placeholder="usuario@roninstudio.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-cyber-neon uppercase tracking-widest flex items-center gap-2">
                        <Lock className="w-3 h-3" /> Contraseña de Sistema
                      </label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-black/40 border border-cyber-border rounded px-4 py-3 text-sm text-white focus:outline-none focus:border-cyber-neon focus:ring-1 focus:ring-cyber-neon/50 transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="p-6 pt-0">
                    <Button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full h-12 bg-cyber-neon text-cyber-dark hover:bg-cyber-neon/80 font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all active:scale-[0.98]"
                    >
                      {isLoading ? 'PROTOCOL INITIATED...' : 'AUTENTICAR ACCESO'}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
        
        <p className="text-center text-[9px] text-cyber-muted/40 mt-8 uppercase font-bold tracking-[0.4em]">
          Secure Terminal // IMC ERP OS v2.0.4
        </p>
      </div>
    </div>
  );
}
