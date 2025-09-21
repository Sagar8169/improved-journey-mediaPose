import Link from 'next/link';
import { ReactNode, useState } from 'react';
import { useAuth } from './useAuth';

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  
  const handleLogout = async () => {
    await logout();
    setOpen(false);
  };
  
  return (
    <div className="min-h-[100svh] flex flex-col bg-bg text-brandText">
      <header className="sticky top-0 z-40 border-b border-panel bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80 safe-top">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center border border-accent/30 text-accent font-bold text-xs">JJ</div>
              <Link href={user ? '/home' : '/'} className="font-semibold tracking-wide text-sm sm:text-base text-accent hover:opacity-90">JIU-JITSU TRAINING</Link>
            </div>
            <nav className="hidden md:flex items-center gap-8 text-sm">
              {user && <Link href="/home" className="hover:text-accent/80">Home</Link>}
              {user && <Link href="/drill" className="hover:text-accent/80">Drill</Link>}
              {user && <Link href="/account" className="hover:text-accent/80">Account</Link>}
              {user && (
                <button 
                  onClick={handleLogout} 
                  className="text-xs px-3 py-1 rounded bg-panel border border-accent/30 hover:bg-accent/10 text-accent"
                >
                  Logout
                </button>
              )}
            </nav>
            <button 
              aria-label="Menu" 
              onClick={() => setOpen(o => !o)} 
              className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded bg-panel border border-panel hover:border-accent/40 text-accent"
            >
              ☰
            </button>
          </div>
        </div>
        {open && (
          <div className="md:hidden border-t border-panel bg-bg px-4 pb-4 pt-2 space-y-2 text-sm">
            {user && <Link onClick={() => setOpen(false)} href="/home" className="block py-1 hover:text-accent/80">Home</Link>}
            {user && <Link onClick={() => setOpen(false)} href="/drill" className="block py-1 hover:text-accent/80">Drill</Link>}
            {user && <Link onClick={() => setOpen(false)} href="/account" className="block py-1 hover:text-accent/80">Account</Link>}
            {user && (
              <button 
                onClick={handleLogout} 
                className="block py-1 text-accent hover:opacity-80"
              >
                Logout
              </button>
            )}
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
