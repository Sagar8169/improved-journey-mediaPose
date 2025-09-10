import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/components/authStore';

export default function LandingAuth() {
  const { signup, login, currentUser } = useAuthStore();
  const router = useRouter();
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '' });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupError, setSignupError] = useState<string|null>(null);
  const [loginError, setLoginError] = useState<string|null>(null);
  const [mode, setMode] = useState<'login'|'signup'>('login');

  // Redirects handled centrally in _app after rehydration; no local redirect here to avoid race.

  const handleSignup = (e: FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    const res = signup(signupForm);
    if (!res.ok) { setSignupError((res as any).error); } else router.push('/home');
  };
  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const res = login(loginForm.email, loginForm.password);
    if (!res.ok) { setLoginError((res as any).error); } else router.push('/home');
  };

  return (
  <div className="min-h-[100svh] bg-bg text-brandText flex flex-col relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(88,166,255,0.20),transparent_60%),radial-gradient(circle_at_70%_60%,rgba(88,166,255,0.12),transparent_65%)] animate-pulse" />
        <div className="absolute inset-0 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(88,166,255,0.08),transparent),linear-gradient(245deg,rgba(88,166,255,0.06),transparent)]" />
      </div>
  <header className="flex items-center justify-between px-6 py-4 pt-4 z-10">
        <h1 className="font-bold tracking-wide text-sm sm:text-base text-accent">JIU-JITSU TRAINING</h1>
        <button onClick={()=>setMode(m=>m==='login'?'signup':'login')} className="text-xs px-3 py-1 rounded bg-panel hover:bg-accent/10 border border-accent/30 text-accent">
          {mode==='login' ? 'Need an account?' : 'Have an account?'}
        </button>
      </header>
      <main className="flex-1 z-10 w-full overflow-y-auto">
  <section className="container-mobile pt-16 pb-16 flex flex-col lg:flex-row gap-10 lg:gap-16">
          <div className="flex-1 w-full max-w-xl mx-auto">
            <h2 className="text-5xl md:text-6xl font-bold mb-6 leading-tight bg-gradient-to-br from-accent via-accent/70 to-white bg-clip-text text-transparent">Train • Track • Improve</h2>
            <p className="text-brandText/80 text-sm md:text-base leading-relaxed mb-8">Realtime pose estimation for drills, joint angle analytics, rep counting and symmetry feedback. Sign up to start a private session in your browser—no backend required.</p>
            <div className="grid grid-cols-2 gap-3 text-[11px] text-neutral-400 w-full">
              <div className="p-3 rounded-lg bg-panel border border-accent/20 backdrop-blur-sm">Local Processing</div>
              <div className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 backdrop-blur-sm">Rep Counting</div>
              <div className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 backdrop-blur-sm">Symmetry Metrics</div>
              <div className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 backdrop-blur-sm">Posture Feedback</div>
            </div>
          </div>
          <div className="flex-1 w-full max-w-md mx-auto relative">
            <div className="absolute -inset-0.5 bg-gradient-to-br from-accent/40 to-accent/10 rounded-2xl blur-xl opacity-40 animate-pulse" />
            <div className="relative bg-panel/90 backdrop-blur rounded-2xl border border-accent/30 p-6 sm:p-8 shadow-xl">
              {mode === 'signup' && (
                <form onSubmit={handleSignup} className="space-y-5 animate-fade-in">
                  <h3 className="font-semibold text-sm tracking-wide text-brandText">Create Account</h3>
                  <label className="block text-[11px] text-neutral-400">Name
                    <input aria-label="Name" required placeholder="Name" value={signupForm.name} onChange={e=>setSignupForm(f=>({...f,name:e.target.value}))} className="mt-1 w-full bg-panel border border-panel focus:border-accent/50 rounded px-3 py-2 text-sm outline-none" />
                  </label>
                  <label className="block text-[11px] text-neutral-400">Email
                    <input aria-label="Email" required type="email" placeholder="you@example.com" value={signupForm.email} onChange={e=>setSignupForm(f=>({...f,email:e.target.value}))} className="mt-1 w-full bg-neutral-800 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                  </label>
                  <label className="block text-[11px] text-neutral-400">Password
                    <input aria-label="Password" required type="password" placeholder="At least 6 characters" value={signupForm.password} onChange={e=>setSignupForm(f=>({...f,password:e.target.value}))} className="mt-1 w-full bg-neutral-800 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                  </label>
                  {signupError && <p className="text-xs text-red-400">{signupError}</p>}
                  <button type="submit" className="w-full mt-2 btn-accent py-3 text-base font-medium">Sign Up</button>
                  <p className="text-[10px] text-neutral-500 text-center">Demo: demo@jiujitsu.com / demo123</p>
                </form>
              )}
              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-5 animate-fade-in">
                  <h3 className="font-semibold text-sm tracking-wide text-brandText">Welcome Back</h3>
                  <label className="block text-[11px] text-neutral-400">Email
                    <input aria-label="Email" required type="email" placeholder="you@example.com" value={loginForm.email} onChange={e=>setLoginForm(f=>({...f,email:e.target.value}))} className="mt-1 w-full bg-panel border border-panel focus:border-accent/50 rounded px-3 py-2 text-sm outline-none" />
                  </label>
                  <label className="block text-[11px] text-neutral-400">Password
                    <input aria-label="Password" required type="password" placeholder="Password" value={loginForm.password} onChange={e=>setLoginForm(f=>({...f,password:e.target.value}))} className="mt-1 w-full bg-neutral-800 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                  </label>
                  {loginError && <p className="text-xs text-red-400">{loginError}</p>}
                  <button type="submit" className="w-full mt-2 btn-accent py-3 text-base font-medium">Log In</button>
                  <p className="text-[10px] text-neutral-500 text-center">Demo: demo@jiujitsu.com / demo123</p>
                </form>
              )}
              <div className="mt-6 text-center">
                <button onClick={()=>setMode(m=>m==='login'?'signup':'login')} className="text-[11px] text-accent hover:opacity-80 transition">
                  {mode==='login' ? 'Need an account? Create one' : 'Have an account? Log in'}
                </button>
              </div>
            </div>
          </div>
        </section>
        {/* Extra scrollable sections */}
  <section className="container-mobile pb-16 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
            {['Precision Angles','Symmetry Tracking','Realtime Feedback'].map((t,i)=>(
              <div key={t} className="group relative p-6 rounded-2xl bg-panel/70 border border-accent/20 overflow-hidden">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-br from-accent/10 to-accent/5" />
                <h4 className="font-semibold mb-2 text-sm tracking-wide text-brandText">{t}</h4>
                <p className="text-[11px] text-brandText/60 leading-relaxed">Advanced estimation pipelines surface metrics that help refine movement quality and consistency in each drill.</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl p-6 sm:p-10 bg-panel/80 border border-accent/20 backdrop-blur grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
            <div>
              <h3 className="text-2xl font-bold mb-4 text-brandText">Local First</h3>
              <p className="text-sm text-brandText/70 leading-relaxed">All computations happen in-browser; no video frames ever leave your device. Your drills are private by design, enabling fast iteration and low latency feedback loops.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-[11px] text-brandText/80">
              {['Angles','Reps','Posture','Symmetry','Visibility','Bounding Box'].map(item => (
                <div key={item} className="p-3 rounded-lg bg-panel border border-accent/20 text-center">{item}</div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="z-10 text-center text-[10px] text-neutral-600 py-6 border-t border-neutral-900">Local-only prototype • No data leaves your browser</footer>
    </div>
  );
}
