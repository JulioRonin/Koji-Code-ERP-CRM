import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppShell() {
  return (
    <div className="bg-erp-bg text-erp-text h-screen w-screen overflow-hidden flex selection:bg-erp-cyan selection:text-black font-sans">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[image:var(--background-image-grid-pattern)] bg-grid opacity-20"></div>
        <div className="absolute inset-0 bg-[image:var(--background-image-circuit-pattern)] opacity-30"></div>
        <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-erp-purple opacity-5 blur-[150px]"></div>
        <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-erp-cyan opacity-5 blur-[150px]"></div>
      </div>

      <Sidebar />
      
      <main className="flex-1 flex flex-col z-10 relative h-full min-w-0">
        <Header />
        <div className="flex-1 p-8 overflow-y-auto flex flex-col gap-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
