import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/components/useAuth';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { verifyEmail } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const { token } = router.query;
    
    if (token && typeof token === 'string') {
      handleVerification(token);
    } else if (router.isReady) {
      // Router is ready but no token found
      setStatus('error');
      setMessage('Invalid verification link. Please check your email for the correct link.');
    }
  }, [router.query, router.isReady]);

  const handleVerification = async (token: string) => {
    try {
      const result = await verifyEmail(token);
      
      if (result.success) {
        setStatus('success');
        setMessage('Email verified successfully! You can now access all features.');
        
        // Redirect to home page after a short delay
        setTimeout(() => {
          router.push('/home');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(result.error || 'Email verification failed.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('An unexpected error occurred during verification.');
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
            <h1 className="text-2xl font-semibold mb-2 text-accent">Verifying Email</h1>
            <p className="text-neutral-400">Please wait while we verify your email address...</p>
          </div>
        );
      
      case 'success':
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold mb-2 text-green-400">Email Verified!</h1>
            <p className="text-neutral-400 mb-4">{message}</p>
            <p className="text-sm text-neutral-500">Redirecting you to the home page...</p>
          </div>
        );
      
      case 'error':
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold mb-2 text-red-400">Verification Failed</h1>
            <p className="text-neutral-400 mb-6">{message}</p>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/')}
                className="block w-full btn-accent py-3 rounded-xl"
              >
                Back to Home
              </button>
              <button
                onClick={() => router.push('/account')}
                className="block w-full bg-panel border border-accent/30 hover:bg-accent/10 text-accent py-3 rounded-xl"
              >
                Go to Account
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-center min-h-screen">
        <div className="max-w-md w-full p-8 bg-panel rounded-lg border border-accent/30">
          {renderContent()}
        </div>
      </div>
    </Layout>
  );
}