import { Layout } from '@/components/Layout';
import { usePoseStore } from '@/components/usePoseStore';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/useAuth';
import { SessionHistory } from '@/components/sessions/SessionHistory';

export default function Account() {
  const store = usePoseStore();
  const history = usePoseStore(s=>s.sessionHistory);
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [justSavedId, setJustSavedId] = useState<string|null>(null);
  useEffect(()=>{
    if (router.isReady) {
      const id = router.query.justSaved as string | undefined;
      if (id) { setJustSavedId(id); }
    }
  },[router.isReady, router.query.justSaved]);
  const [edit, setEdit] = useState(false as boolean);
  const [form, setForm] = useState({ 
    name: currentUser?.displayName || '', 
    email: currentUser?.email || '', 
    password: '' 
  });
  
  // Update form when user data changes
  useEffect(() => {
    if (currentUser) {
      setForm({
        name: currentUser.displayName || '',
        email: currentUser.email || '',
        password: ''
      });
    }
  }, [currentUser]);
  
  const [err, setErr] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  
  const onSave = async () => {
    setErr(null);
    setLoading(true);
    
    try {
      // TODO: Implement profile update API call
      // For now, we'll show a message that this feature needs to be implemented
      setErr('Profile update not yet implemented - coming soon!');
    } catch (error) {
      setErr('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };
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
        <p className="text-gray-400 text-sm md:text-base mb-10 max-w-2xl">Your training performance at a glance. Explore recent sessions and actionable insights below.</p>

  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-10">
          <div className="rounded-xl bg-panel border border-accent/20 p-5">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Total Sessions</p>
            <p className="text-2xl font-semibold">{history.length || store.sessions}</p>
          </div>
          <div className="rounded-xl bg-panel border border-accent/20 p-5">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Total Reps</p>
            <p className="text-2xl font-semibold text-emerald-400">{(history.length? history.reduce((sum, r)=> sum + (r.totalReps||0), 0) : store.totalReps)}</p>
          </div>
          <div className="rounded-xl bg-panel border border-accent/20 p-5">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Posture Issues</p>
            <p className="text-2xl font-semibold text-yellow-400">{(history.length? history.reduce((sum, r)=> sum + (r.postureIssues||0), 0) : store.postureIssues)}</p>
          </div>
        </div>
        {/* Session History */}
        <section className="rounded-xl bg-panel border border-accent/20 p-6 mb-8">
          <SessionHistory />
        </section>

        {/* Insights and Tips below history */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-10">
          <section className="rounded-xl bg-panel border border-accent/20 p-6 lg:col-span-2">
            <h2 className="text-sm font-semibold tracking-wide text-neutral-300 mb-4">Insights</h2>
            <p className="text-xs md:text-sm text-neutral-400 leading-relaxed">Focus on consistent session quality: aim for steady reps, higher detection rates, and balanced effort. Track your overall score, intensity, and reaction speed in the history table to spot trends over time.</p>
          </section>
          <aside className="rounded-xl bg-panel border border-accent/20 p-6">
            <h3 className="text-sm font-semibold tracking-wide text-neutral-300 mb-3">Quick Tips</h3>
            <ul className="text-[11px] space-y-2 text-neutral-500">
              <li>Use “Hide Low Quality” to focus on meaningful sessions.</li>
              <li>Review intensity and consistency ratings for pacing.</li>
              <li>Keep camera framing stable to improve detection rate.</li>
            </ul>
          </aside>
        </div>

        {/* Account Details at the end */}
        <div className="mt-8 w-full max-w-xl space-y-4 mx-auto">
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
                <button onClick={onSave} disabled={loading} className="w-full sm:w-auto text-base px-4 py-3 rounded btn-accent disabled:opacity-50">
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button onClick={()=>{
                  setEdit(false); 
                  setForm({ 
                    name: currentUser?.displayName || '', 
                    email: currentUser?.email || '', 
                    password: '' 
                  });
                  setErr(null);
                }} className="w-full sm:w-auto text-base px-4 py-3 rounded bg-panel border border-accent/20 hover:bg-accent/10">Cancel</button>
              </div>}
              <p className="text-[10px] text-neutral-500">Demo credentials always available: demo@jiujitsu.com / demo123</p>
            </div>
          </div>
        </div>
      </div>
  </Layout>
  </RequireAuth>
  );
}
 