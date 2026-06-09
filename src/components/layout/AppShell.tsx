import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppShell() {
  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[var(--color-app-bg)] text-[var(--color-app-text)] font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full min-w-0">
        <Header />
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-6">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
