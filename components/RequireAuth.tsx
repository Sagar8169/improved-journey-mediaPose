import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useAuthStore } from './authStore';

export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore(s => s.currentUser);
  const router = useRouter();
  useEffect(() => {
    if (!user) {
      router.replace('/');
    }
  }, [user, router]);
  if (!user) return null; // could add loading spinner
  return <>{children}</>;
};