import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useAuth } from '@/components/useAuth';
import { createPortal } from 'react-dom';

type Mode = 'login' | 'signup';

export default function Landing() {
  const router = useRouter();
  const { login, signup, user, isLoading, error, clearError } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ displayName: '', email: '', password: '' });
  const [localError, setLocalError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  
  useEffect(() => {
    if (!mounted) return;
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open, mounted]);

  // Clear errors when switching modes
  useEffect(() => {
    setLocalError(null);
    clearError();
  }, [mode, clearError]);

  const openAuth = (initial: Mode) => {
    setMode(initial);
    setOpen(true);
    setLocalError(null);
    setShowSuccess(false);
    clearError();
  };

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    
    const result = await login(loginForm);
    if (result.success) {
      setOpen(false);
      router.push('/home');
    } else {
      setLocalError(result.error || 'Login failed');
    }
  };

  const onSignup = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    
    const result = await signup(signupForm);
    if (result.success) {
      setShowSuccess(true);
      setSignupForm({ displayName: '', email: '', password: '' });
    } else {
      setLocalError(result.error || 'Signup failed');
    }
  };

  const displayError = localError || error;

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
          type="button"
          onClick={() => openAuth('login')}
          className="btn-accent px-6 py-3 rounded-2xl text-white text-base sm:text-lg font-medium shadow-[0_12px_30px_rgba(77,138,255,0.35)] hover:shadow-[0_16px_40px_rgba(77,138,255,0.45)]"
          aria-haspopup="dialog"
          aria-controls="auth-modal"
        >
          Get Started
        </button>
      </div>

      {/* Modal (portal to body to avoid stacking issues) */}
      {mounted && open && typeof document !== 'undefined' && createPortal(
        <div id="auth-modal" role="dialog" aria-modal="true" className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-panel border border-accent/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-brandText">
                {mode === 'login' ? 'Log In' : 'Create Account'}
              </h2>
              <button aria-label="Close" onClick={() => setOpen(false)} className="text-accent hover:opacity-80">✕</button>
            </div>

            {showSuccess && mode === 'signup' ? (
              <div className="space-y-4">
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 text-green-300 text-sm">
                  <h3 className="font-medium mb-1">Account Created Successfully!</h3>
                  <p className="text-xs">Please check your email to verify your account before logging in.</p>
                </div>
                <button
                  onClick={() => { setShowSuccess(false); setMode('login'); }}
                  className="w-full btn-accent py-3 rounded-xl"
                >
                  Continue to Login
                </button>
              </div>
            ) : mode === 'login' ? (
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
                    disabled={isLoading}
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
                    disabled={isLoading}
                  />
                </div>
                {displayError && <p className="text-xs text-red-400">{displayError}</p>}
                <button 
                  type="submit" 
                  className="w-full btn-accent py-3 rounded-xl disabled:opacity-50" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Logging In...' : 'Log In'}
                </button>
              </form>
            ) : (
              <form onSubmit={onSignup} className="space-y-4">
                <div>
                  <label className="block text-xs text-brandText/70">Name</label>
                  <input
                    required
                    value={signupForm.displayName}
                    onChange={e => setSignupForm(f => ({ ...f, displayName: e.target.value }))}
                    className="mt-1 w-full bg-[#0f1420] text-brandText border border-accent/20 focus:border-accent/60 rounded-lg px-3 py-2 outline-none"
                    placeholder="Your name"
                    disabled={isLoading}
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
                    disabled={isLoading}
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
                    placeholder="At least 8 characters"
                    disabled={isLoading}
                  />
                </div>
                {displayError && <p className="text-xs text-red-400">{displayError}</p>}
                <button 
                  type="submit" 
                  className="w-full btn-accent py-3 rounded-xl disabled:opacity-50" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating Account...' : 'Sign Up'}
                </button>
              </form>
            )}

            {!showSuccess && (
              <div className="mt-5 text-center">
                <button
                  onClick={() => { 
                    clearError(); 
                    setLocalError(null); 
                    setMode(m => (m === 'login' ? 'signup' : 'login')); 
                  }}
                  className="text-sm text-white/80 hover:text-white"
                >
                  {mode === 'login' ? 'Need an account? Create one' : 'Have an account? Log in'}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
