import { Layout } from '@/components/Layout';
import { usePoseStore } from '@/components/usePoseStore';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuthStore } from '@/components/authStore';
import { SessionHistory } from '@/components/sessions/SessionHistory';

export default function Account() {
  const store = usePoseStore();
  const { currentUser, updateProfile } = useAuthStore();
  const { sessionRecords } = usePoseStore();
  const router = useRouter();
  const [justSavedId, setJustSavedId] = useState<string|null>(null);
  useEffect(()=>{
    if (router.isReady) {
      const id = router.query.justSaved as string | undefined;
      if (id) { setJustSavedId(id); }
    }
  },[router.isReady, router.query.justSaved]);
  const [edit, setEdit] = useState(false as boolean);
  const [form, setForm] = useState({ name: currentUser?.name || '', email: currentUser?.email || '', password: currentUser?.password || '' });
  const [err, setErr] = useState<string|null>(null);
  const onSave = () => {
    setErr(null);
    const res = updateProfile({ name: form.name, email: form.email, password: form.password });
    if (!res.ok) setErr((res as any).error); else setEdit(false);
  };
  const sessionAge = store.lastUpdated ? Math.round((Date.now() - store.lastUpdated)/1000) : null;
  return (
    <RequireAuth>
    <Layout>
  <div className="container-mobile py-8 sm:py-12 max-w-5xl mx-auto">
        {justSavedId && (
          <div className="mb-6 rounded-lg border border-emerald-700 bg-emerald-900/40 px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>Session saved successfully.</span>
            <button onClick={()=>{ setJustSavedId(null); const q={...router.query}; delete q.justSaved; router.replace({ pathname: router.pathname, query: q}, undefined, { shallow:true}); }} className="text-xs px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700">Dismiss</button>
          </div>
        )}
  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 tracking-tight text-brandText">Account Overview</h1>
  <div className="mb-8 w-full max-w-xl space-y-4 mx-auto">
          <div className="bg-panel border border-accent/20 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold tracking-wide text-neutral-300">Account Details</h2>
              {!edit && <button onClick={()=>setEdit(true)} className="text-xs px-3 py-1 rounded bg-panel border border-accent/30 hover:bg-accent/10 text-accent">Edit</button>}
            </div>
            <div className="space-y-3 text-xs">
              <label className="block">Name
                <input disabled={!edit} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="mt-1 w-full bg-panel border border-panel focus:border-accent/50 rounded px-3 py-3 text-base disabled:opacity-60" />
              </label>
              <label className="block">Email
                <input disabled={!edit} value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="mt-1 w-full bg-panel border border-panel focus:border-accent/50 rounded px-3 py-3 text-base disabled:opacity-60" />
              </label>
              <label className="block">Password
                <input disabled={!edit} type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} className="mt-1 w-full bg-panel border border-panel focus:border-accent/50 rounded px-3 py-3 text-base disabled:opacity-60" />
              </label>
              {err && <p className="text-red-400 text-[10px]">{err}</p>}
              {edit && <div className="flex flex-col sm:flex-row gap-2 pt-2 w-full">
                <button onClick={onSave} className="w-full sm:w-auto text-base px-4 py-3 rounded btn-accent">Save</button>
                <button onClick={()=>{setEdit(false); setForm({ name: currentUser!.name, email: currentUser!.email, password: currentUser!.password });}} className="w-full sm:w-auto text-base px-4 py-3 rounded bg-panel border border-accent/20 hover:bg-accent/10">Cancel</button>
              </div>}
              <p className="text-[10px] text-neutral-500">Demo credentials always available: demo@jiujitsu.com / demo123</p>
            </div>
          </div>
        </div>
        <p className="text-gray-400 text-sm md:text-base mb-10 max-w-2xl">Aggregated performance metrics from your drill sessions. Reset clears in-memory stats (no persistence yet).</p>

  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-10">
          <div className="rounded-xl bg-panel border border-accent/20 p-5">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Total Sessions</p>
            <p className="text-2xl font-semibold">{store.sessions}</p>
          </div>
          <div className="rounded-xl bg-panel border border-accent/20 p-5">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Total Reps</p>
            <p className="text-2xl font-semibold text-emerald-400">{store.totalReps}</p>
          </div>
          <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-5">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Posture Issues</p>
            <p className="text-2xl font-semibold text-yellow-400">{store.postureIssues}</p>
          </div>
        </div>

  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6">
            <section className="rounded-xl bg-panel border border-accent/20 p-6">
              <h2 className="text-sm font-semibold tracking-wide text-neutral-300 mb-4">Symmetry & Posture</h2>
              <ul className="text-xs md:text-sm space-y-2 leading-relaxed">
                <li><span className="text-neutral-500">Best shoulder symmetry Δ°:</span> {store.bestSymShoulder?.toFixed(0) ?? '—'} <span className="text-neutral-600">(lower is better)</span></li>
                <li><span className="text-neutral-500">Best knee symmetry Δ°:</span> {store.bestSymKnee?.toFixed(0) ?? '—'}</li>
                <li><span className="text-neutral-500">Last updated:</span> {store.lastUpdated? new Date(store.lastUpdated).toLocaleTimeString() : '—'}</li>
                {sessionAge != null && <li><span className="text-neutral-500">Seconds since update:</span> {sessionAge}s</li>}
              </ul>
              <button onClick={()=>store.resetAll()} className="mt-6 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-medium">Reset Stats</button>
            </section>
            <section className="rounded-xl bg-panel border border-accent/20 p-6">
              <SessionHistory />
            </section>
            <section className="rounded-xl bg-panel border border-accent/20 p-6">
              <h2 className="text-sm font-semibold tracking-wide text-neutral-300 mb-4">Insights</h2>
              <p className="text-xs md:text-sm text-neutral-400 leading-relaxed">Shoulder & knee symmetry reflect left/right balance; lower deltas suggest even loading. Posture issues increment when torso alignment deviates (large torso angle). Aim to reduce posture flags while keeping symmetry deltas small.</p>
              <p className="text-[11px] text-neutral-600 mt-4">Planned: local persistence, charts, movement‑specific bests.</p>
            </section>
          </div>
          <aside className="space-y-6">
            <div className="rounded-xl bg-panel border border-accent/20 p-6">
              <h3 className="text-sm font-semibold tracking-wide text-neutral-300 mb-3">Quick Tips</h3>
              <ul className="text-[11px] space-y-2 text-neutral-500">
                <li>Keep joints centered in frame for better visibility score.</li>
                <li>Symmetry Δ° spikes? Slow down & stabilize stance.</li>
                <li>High posture issues? Adjust torso lean angle.</li>
              </ul>
            </div>
            <div className="rounded-xl bg-panel border border-accent/20 p-6">
              <h3 className="text-sm font-semibold tracking-wide text-neutral-300 mb-3">Next Features</h3>
              <ul className="text-[11px] space-y-2 text-neutral-500 list-disc list-inside">
                <li>Persistent history</li>
                <li>Trend charts</li>
                <li>Custom movement templates</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
  </Layout>
  </RequireAuth>
  );
}
 