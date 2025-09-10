import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/components/authStore';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { currentUser, hydrateSession, sessionToken, lastAuthAt } = useAuthStore();
  const [rehydrated, setRehydrated] = useState(false);

  const LS_AUTH = 'jj_app.auth';
  const LS_LAST = 'jj_app.lastRoute';
  const ROUTE_WHITELIST = new Set(['/home','/drill','/profile']);

  // Rehydrate session from localStorage using token (no password storage)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!currentUser) {
      const raw = localStorage.getItem(LS_AUTH);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.email && parsed?.token) {
            const ok = hydrateSession(parsed.email, parsed.token);
            if (!ok) localStorage.removeItem(LS_AUTH);
          }
        } catch {
          localStorage.removeItem(LS_AUTH);
        }
      }
    }
    setRehydrated(true);
  }, [currentUser, hydrateSession]);

  // Track last route
  useEffect(() => {
    const handleRoute = (url: string) => {
      localStorage.setItem(LS_LAST, url);
    };
    router.events.on('routeChangeComplete', handleRoute);
    return () => { router.events.off('routeChangeComplete', handleRoute); };
  }, [router.events]);

  // Persist token
  useEffect(() => {
    if (currentUser && sessionToken) {
      localStorage.setItem(LS_AUTH, JSON.stringify({ email: currentUser.email, token: sessionToken }));
    } else {
      localStorage.removeItem(LS_AUTH);
      localStorage.removeItem(LS_LAST); // clear last route on logout
    }
  }, [currentUser, sessionToken]);

  // Centralized redirect: after explicit auth event (lastAuthAt changes) go to /home; else restore whitelisted last route
  useEffect(() => {
    if (!rehydrated) return;
    const path = router.asPath;
    // Only redirect to home (or last route) immediately after an explicit auth event
    if (path === '/' && currentUser && lastAuthAt && Date.now() - lastAuthAt < 3000) {
      const last = localStorage.getItem(LS_LAST);
      if (last && ROUTE_WHITELIST.has(last) && last !== '/home') {
        router.replace(last);
      } else {
        router.replace('/home');
      }
    }
  }, [currentUser, rehydrated, lastAuthAt, router]);

  if (!rehydrated) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#888',fontFamily:'sans-serif',background:'#000'}}>Loading…</div>;

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0D1117" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
