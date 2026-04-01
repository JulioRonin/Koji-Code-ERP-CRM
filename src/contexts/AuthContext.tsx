import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { STAFF_MEMBERS, StaffMember } from '@/data/crmData';

interface AuthContextType {
  user: StaffMember | null;
  isAuthenticated: boolean;
  login: (department: string, email: string, passcode: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session in localStorage
    const savedUser = localStorage.getItem('koji_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (department: string, email: string, passcode: string): Promise<boolean> => {
    setIsLoading(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Find user in mock data
    const foundUser = STAFF_MEMBERS.find(
      u => u.email.toLowerCase() === email.toLowerCase() && 
           u.password === passcode && 
           u.department === department
    );

    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('koji_user', JSON.stringify(foundUser));
      setIsLoading(false);
      return true;
    }

    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('koji_user');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
