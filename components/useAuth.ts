import { create } from 'zustand';
import { auth, ApiError, tokenUtils } from '../lib/apiClient';
import { LoginRequest, SignupRequest } from '../lib/server/validation';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  roles: string[];
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  
  // Actions
  login: (credentials: LoginRequest) => Promise<{ success: boolean; error?: string }>;
  signup: (data: SignupRequest) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: string }>;
  resendVerification: (email: string) => Promise<{ success: boolean; error?: string }>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
  
  // Internal state management
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,

  login: async (credentials: LoginRequest) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await auth.login(credentials);
      
      const user: AuthUser = {
        id: response.user.id,
        email: response.user.email,
        displayName: response.user.displayName,
        emailVerified: response.user.emailVerified,
        roles: response.user.roles,
      };
      
      set({ 
        user, 
        isAuthenticated: true,
        isLoading: false,
        error: null 
      });
      
      // Store user in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth-user', JSON.stringify(user));
      }
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof ApiError 
        ? error.message 
        : 'Login failed. Please try again.';
      
      set({ 
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage 
      });
      
      return { success: false, error: errorMessage };
    }
  },

  signup: async (data: SignupRequest) => {
    set({ isLoading: true, error: null });
    
    try {
      await auth.signup(data);
      
      set({ 
        isLoading: false,
        error: null 
      });
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof ApiError 
        ? error.message 
        : 'Signup failed. Please try again.';
      
      set({ 
        isLoading: false,
        error: errorMessage 
      });
      
      return { success: false, error: errorMessage };
    }
  },

  logout: async () => {
    set({ isLoading: true });
    
    try {
      await auth.logout();
    } catch (error) {
      // Even if server logout fails, clear local state
      console.warn('Logout request failed:', error);
    } finally {
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth-user');
      }
      
      set({ 
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null 
      });
    }
  },

  verifyEmail: async (token: string) => {
    set({ isLoading: true, error: null });
    
    try {
      await auth.verifyEmail(token);
      
      // Update user's email verification status if logged in
      const { user } = get();
      if (user) {
        const updatedUser = { ...user, emailVerified: true };
        set({ 
          user: updatedUser,
          isLoading: false 
        });
        
        // Update localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth-user', JSON.stringify(updatedUser));
        }
      } else {
        set({ isLoading: false });
      }
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof ApiError 
        ? error.message 
        : 'Email verification failed.';
      
      set({ 
        isLoading: false,
        error: errorMessage 
      });
      
      return { success: false, error: errorMessage };
    }
  },

  resendVerification: async (email: string) => {
    set({ isLoading: true, error: null });
    
    try {
      await auth.resendVerification(email);
      
      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof ApiError 
        ? error.message 
        : 'Failed to resend verification email.';
      
      set({ 
        isLoading: false,
        error: errorMessage 
      });
      
      return { success: false, error: errorMessage };
    }
  },

  refreshToken: async () => {
    try {
      await auth.refreshToken();
      return true;
    } catch (error) {
      // Token refresh failed, user needs to log in again
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth-user');
      }
      
      set({ 
        user: null,
        isAuthenticated: false,
        error: 'Session expired. Please log in again.' 
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),

  setUser: (user: AuthUser | null) => {
    set({ 
      user,
      isAuthenticated: !!user 
    });
    
    // Update localStorage
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('auth-user', JSON.stringify(user));
      } else {
        localStorage.removeItem('auth-user');
      }
    }
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  setError: (error: string | null) => set({ error }),

  // Initialize authentication state on app load
  hydrate: async () => {
    if (typeof window === 'undefined') return;
    
    const accessToken = tokenUtils.getAccessToken();
    const storedUser = localStorage.getItem('auth-user');
    
    if (!accessToken || !storedUser) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    try {
      const user: AuthUser = JSON.parse(storedUser);
      set({ user, isAuthenticated: true });
      
      // Try to refresh token to validate session
      const success = await get().refreshToken();
      if (!success) {
        set({ isAuthenticated: false, user: null });
      }
    } catch (error) {
      // Invalid stored data
      localStorage.removeItem('auth-user');
      set({ isAuthenticated: false, user: null });
    }
  },
}));

// Convenience hooks
export const useAuth = () => {
  const auth = useAuthStore();
  
  return {
    user: auth.user,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    error: auth.error,
    login: auth.login,
    signup: auth.signup,
    logout: auth.logout,
    verifyEmail: auth.verifyEmail,
    resendVerification: auth.resendVerification,
    clearError: auth.clearError,
  };
};

export const useAuthUser = () => useAuthStore(state => state.user);
export const useAuthStatus = () => useAuthStore(state => ({
  isLoading: state.isLoading,
  isAuthenticated: state.isAuthenticated,
  error: state.error,
}));

// Hook to require authentication
export const useRequireAuth = () => {
  const { isAuthenticated, user } = useAuth();
  
  return {
    isAuthenticated,
    user,
    requireVerification: user && !user.emailVerified,
  };
};

// Initialize auth store on app load
export const initializeAuth = async () => {
  await useAuthStore.getState().hydrate();
};