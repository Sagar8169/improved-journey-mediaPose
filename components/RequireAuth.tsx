import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useAuth } from './useAuth';

export const RequireAuth: React.FC<{ 
  children: React.ReactNode;
  requireVerified?: boolean;
}> = ({ children, requireVerified = false }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading state
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
          <p className="mt-2 text-sm text-neutral-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Check email verification if required
  if (requireVerified && user && !user.emailVerified) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8 bg-panel rounded-lg border border-accent/30 max-w-md">
          <h2 className="text-xl font-semibold mb-4 text-accent">Email Verification Required</h2>
          <p className="text-sm text-neutral-400 mb-4">
            Please verify your email address to access this feature.
          </p>
          <p className="text-xs text-neutral-500">
            Check your email for a verification link or contact support if you need help.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};