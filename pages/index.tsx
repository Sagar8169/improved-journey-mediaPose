import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useAuthStore } from '@/components/authStore';

type Mode = 'login' | 'signup';

export default function Landing() {
  const router = useRouter();
  const { login, signup, currentUser } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);

  const openAuth = (initial: Mode) => {
    if (currentUser) { router.push('/home'); return; }
    setMode(initial);
    setOpen(true);
  };

  const onLogin = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = login(loginForm.email, loginForm.password);
    if (!res.ok) setError((res as any).error);
    else router.push('/home');
  };
  const onSignup = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = signup(signupForm);
    if (!res.ok) setError((res as any).error);
    else router.push('/home');
  };

  return (
    <div className="min-h-[100svh] bg-bg text-brandText grid place-items-center px-6 relative overflow-hidden">
      {/* Centered column */}
      <div className="w-full max-w-2xl mx-auto text-center flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-accent/50 shadow-[0_10px_35px_rgba(77,138,255,0.35)]">
            <Image src="/logo.jpg" alt="Jiu-Jitsu Academy logo" width={256} height={256} className="w-full h-full object-cover" priority />
          </div>
        </div>
        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-4" style={{ color: '#9bc3f7' }}>
          Welcome to Jiu-Jitsu Pose Tracking
        </h1>
        {/* Subheading */}
        <p className="text-base sm:text-lg md:text-xl mb-10 max-w-xl" style={{ color: '#a2c1e8' }}>
          Your personal AI-powered BJJ training partner.
        </p>
        {/* CTA */}
        <button
          onClick={() => openAuth('login')}
          className="btn-accent px-6 py-3 rounded-2xl text-white text-base sm:text-lg font-medium shadow-[0_12px_30px_rgba(77,138,255,0.35)] hover:shadow-[0_16px_40px_rgba(77,138,255,0.45)]"
          aria-haspopup="dialog"
        >
          Get Started
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-panel border border-accent/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-brandText">
                {mode === 'login' ? 'Log In' : 'Create Account'}
              </h2>
              <button aria-label="Close" onClick={() => setOpen(false)} className="text-accent hover:opacity-80">✕</button>
            </div>
            {mode === 'login' ? (
              <form onSubmit={onLogin} className="space-y-4">
                <div>
                  <label className="block text-xs text-brandText/70">Email</label>
                  <input
                    type="email"
                    required
                    value={loginForm.email}
                    onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                    className="mt-1 w-full bg-[#0f1420] text-brandText border border-accent/20 focus:border-accent/60 rounded-lg px-3 py-2 outline-none"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-brandText/70">Password</label>
                  <input
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                    className="mt-1 w-full bg-[#0f1420] text-brandText border border-accent/20 focus:border-accent/60 rounded-lg px-3 py-2 outline-none"
                    placeholder="Password"
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button type="submit" className="w-full btn-accent py-3 rounded-xl">Log In</button>
                <p className="text-[11px] text-center text-brandText/60">Demo: demo@jiujitsu.com / demo123</p>
              </form>
            ) : (
              <form onSubmit={onSignup} className="space-y-4">
                <div>
                  <label className="block text-xs text-brandText/70">Name</label>
                  <input
                    required
                    value={signupForm.name}
                    onChange={e => setSignupForm(f => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full bg-[#0f1420] text-brandText border border-accent/20 focus:border-accent/60 rounded-lg px-3 py-2 outline-none"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-brandText/70">Email</label>
                  <input
                    type="email"
                    required
                    value={signupForm.email}
                    onChange={e => setSignupForm(f => ({ ...f, email: e.target.value }))}
                    className="mt-1 w-full bg-[#0f1420] text-brandText border border-accent/20 focus:border-accent/60 rounded-lg px-3 py-2 outline-none"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-brandText/70">Password</label>
                  <input
                    type="password"
                    required
                    value={signupForm.password}
                    onChange={e => setSignupForm(f => ({ ...f, password: e.target.value }))}
                    className="mt-1 w-full bg-[#0f1420] text-brandText border border-accent/20 focus:border-accent/60 rounded-lg px-3 py-2 outline-none"
                    placeholder="At least 6 characters"
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button type="submit" className="w-full btn-accent py-3 rounded-xl">Sign Up</button>
              </form>
            )}
            <div className="mt-5 text-center">
              <button
                onClick={() => { setError(null); setMode(m => (m === 'login' ? 'signup' : 'login')); }}
                className="text-sm text-white/80 hover:text-white"
              >
                {mode === 'login' ? 'Need an account? Create one' : 'Have an account? Log in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
