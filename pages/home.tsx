import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuthStore } from '@/components/authStore';

export default function HomePage() {
  const user = useAuthStore(s=>s.currentUser);
  return (
    <RequireAuth>
      <Layout>
  <div className="container-mobile py-8 sm:py-12 max-w-5xl mx-auto">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight text-brandText">Welcome {user?.name?.split(' ')[0] || ''}</h1>
          <p className="text-brandText/70 leading-relaxed w-full max-w-2xl mb-8 text-base">
            Real‑time posture, joint angles, symmetry and rep counting directly in your browser. Jump into a drill session or review cumulative metrics.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/drill" className="group block w-full p-5 rounded-xl bg-panel border border-accent/20 hover:border-accent/60 transition min-h-[64px]">
              <h3 className="font-semibold mb-2 group-hover:text-accent text-brandText text-base">Start a Drill →</h3>
              <p className="text-sm text-brandText/60">Open the camera, pick a movement and receive live feedback.</p>
            </Link>
            <Link href="/profile" className="group block w-full p-5 rounded-xl bg-panel border border-accent/20 hover:border-accent/60 transition min-h-[64px]">
              <h3 className="font-semibold mb-2 group-hover:text-accent text-brandText text-base">View Profile →</h3>
              <p className="text-sm text-brandText/60">Track sessions, reps, symmetry and posture consistency.</p>
            </Link>
          </div>
        </div>
      </Layout>
    </RequireAuth>
  );
}