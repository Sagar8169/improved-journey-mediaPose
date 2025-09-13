import Link from 'next/link';
import Image from 'next/image';
import { useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuthStore } from '@/components/authStore';
import { usePoseStore } from '@/components/usePoseStore';
import { SessionHistory } from '@/components/sessions/SessionHistory';

export default function HomePage() {
  const user = useAuthStore(s => s.currentUser);
  const history = usePoseStore(s => s.sessionHistory);

  const insights = useMemo(() => {
    const sessions = history.length;
    const totalReps = history.reduce((a, r) => a + (r.totalReps || 0), 0);
    const bestShoulder = history.reduce<number | null>((best, r) => {
      const v = r.shoulderSym.count ? Math.round(r.shoulderSym.min) : null;
      return v == null ? best : (best == null ? v : Math.min(best, v));
    }, null);
    const bestKnee = history.reduce<number | null>((best, r) => {
      const v = r.kneeSym.count ? Math.round(r.kneeSym.min) : null;
      return v == null ? best : (best == null ? v : Math.min(best, v));
    }, null);
    const postureIssues = history.reduce((a, r) => a + (r.postureIssues || 0), 0);
    const last = history[0]?.endTs || history[0]?.startTs;
    const timeAgo = (ts?: number) => {
      if (!ts) return '—';
      const d = Date.now() - ts;
      const m = Math.floor(d / 60000);
      if (m < 1) return 'just now';
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      const days = Math.floor(h / 24);
      return `${days}d ago`;
    };
    const summary = sessions
      ? `You’ve completed ${sessions} session${sessions>1?'s':''} with ${totalReps} total reps. Best symmetry (↓ is better): shoulders ${bestShoulder ?? '—'}°, knees ${bestKnee ?? '—'}°. Posture issues noted: ${postureIssues}. Last session ${timeAgo(last)}.`
      : `No sessions yet. Start your first drill to unlock detailed insights tailored to your movement.`;
    return { sessions, summary };
  }, [history]);

  return (
    <RequireAuth>
      <Layout>
        <div className="container-mobile max-w-2xl mx-auto py-8 sm:py-12">
          {/* Centered primary actions */}
          <section className="min-h-[65svh] grid place-items-center">
            <div className="w-full text-center flex flex-col items-center">
              {/* Logo */}
              <div className="mb-6">
                <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-accent/40 shadow-[0_10px_30px_rgba(77,138,255,0.3)]">
                  <Image src="/logo.jpg" alt="Jiu-Jitsu Academy logo" width={256} height={256} className="w-full h-full object-cover" priority />
                </div>
              </div>
              {/* Heading */}
              <h1 className="text-3xl sm:text-4xl font-semibold mb-6" style={{ color: '#9bc3f7' }}>Start Your Session</h1>

              {/* Buttons stacked */}
              <div className="w-full max-w-sm space-y-3">
                <Link href="/drill" className="btn-accent block w-full text-center py-3 rounded-2xl text-white text-base">
                  Start Drill
                </Link>
                <a href="#insights" className="block w-full text-center py-3 rounded-2xl bg-[#2b2f3a] text-[15px]" style={{ color: '#a2c1e8' }}>
                  View Past Sessions
                </a>
                  <Link href="/account" className="block w-full text-center py-3 rounded-2xl bg-[#2b2f3a] text-[15px]" style={{ color: '#a2c1e8' }}>
                    Account
                </Link>
              </div>
            </div>
          </section>

          {/* Detailed Insights */}
          <section id="insights" className="mt-10 sm:mt-14">
            <div className="rounded-2xl p-5 sm:p-6 bg-[#2b2f3a]">
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#9bc3f7' }}>Detailed Insights</h2>
              <p className="text-sm leading-relaxed" style={{ color: '#a2c1e8' }}>{insights.summary}</p>
            </div>
            {/* Past Sessions table */}
            <div className="mt-6">
              <SessionHistory />
            </div>
          </section>
        </div>
      </Layout>
    </RequireAuth>
  );
}