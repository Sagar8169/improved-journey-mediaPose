import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth, initializeAuth } from '@/components/useAuth';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [rehydrated, setRehydrated] = useState(false);

  const LS_LAST = 'jj_app.lastRoute';
  const ROUTE_WHITELIST = new Set(['/home','/drill','/account']);

  // Initialize authentication on app load
  useEffect(() => {
    initializeAuth().finally(() => {
      setRehydrated(true);
    });
  }, []);

  // Track last route
  useEffect(() => {
    const handleRoute = (url: string) => {
      localStorage.setItem(LS_LAST, url);
    };
    router.events.on('routeChangeComplete', handleRoute);
    return () => { router.events.off('routeChangeComplete', handleRoute); };
  }, [router.events]);

  // Clear last route on logout
  useEffect(() => {
    if (!isAuthenticated) {
      localStorage.removeItem(LS_LAST);
    }
  }, [isAuthenticated]);

  // Centralized redirect: authenticated users on landing page go to home or last route
  useEffect(() => {
    if (!rehydrated) return;
    const path = router.asPath;
    
    if (path === '/' && isAuthenticated) {
      const last = localStorage.getItem(LS_LAST);
      if (last && ROUTE_WHITELIST.has(last) && last !== '/home') {
        router.replace(last);
      } else {
        router.replace('/home');
      }
    }
  }, [isAuthenticated, rehydrated, router]);

  if (!rehydrated) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#888',
        fontFamily: 'sans-serif',
        background: '#000'
      }}>
        Loading…
      </div>
    );
  }

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0D1117" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
