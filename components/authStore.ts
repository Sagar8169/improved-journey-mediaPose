import { create } from 'zustand';

export interface AuthUser {
  name: string;
  email: string;
  password: string; // plain for demo only
}

interface AuthState {
  users: AuthUser[];
  currentUser: AuthUser | null;
  sessionToken: string | null;
  lastAuthAt: number | null; // timestamp of last explicit login/signup
  signup: (u: { name: string; email: string; password: string }) => { ok: true } | { ok: false; error: string };
  login: (email: string, password: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  updateProfile: (updates: Partial<AuthUser>) => { ok: true } | { ok: false; error: string };
  hydrateSession: (email: string, token: string) => boolean; // returns success
}

const validateEmail = (email: string) => email.includes('@');

function makeToken(){
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2)+Date.now().toString(36);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  users: [
    { name: 'Demo User', email: 'demo@jiujitsu.com', password: 'demo123' },
  ],
  currentUser: null,
  sessionToken: null,
  lastAuthAt: null,
  signup: ({ name, email, password }) => {
    name = name.trim();
    email = email.trim().toLowerCase();
    if (!name) return { ok: false, error: 'Name required' };
    if (!email) return { ok: false, error: 'Email required' };
    if (!validateEmail(email)) return { ok: false, error: 'Invalid email' };
    if (password.length < 6) return { ok: false, error: 'Password too short' };
    const { users } = get();
    if (users.some(u => u.email === email)) return { ok: false, error: 'Email already registered' };
    const user = { name, email, password };
    const token = makeToken();
    set({ users: [...users, user], currentUser: user, sessionToken: token, lastAuthAt: Date.now() });
    return { ok: true };
  },
  login: (email, password) => {
    email = email.trim().toLowerCase();
    const { users } = get();
    const found = users.find(u => u.email === email);
    if (!found) return { ok: false, error: 'Email not found' };
    if (found.password !== password) return { ok: false, error: 'Incorrect password' };
    const token = makeToken();
    set({ currentUser: found, sessionToken: token, lastAuthAt: Date.now() });
    return { ok: true };
  },
  logout: () => set({ currentUser: null, sessionToken: null }),
  updateProfile: (updates) => {
    const { currentUser, users } = get();
    if (!currentUser) return { ok: false, error: 'Not authenticated' };
    const nextEmail = updates.email?.trim().toLowerCase();
    if (updates.name !== undefined && !updates.name.trim()) return { ok: false, error: 'Name required' };
    if (nextEmail !== undefined) {
      if (!nextEmail) return { ok: false, error: 'Email required' };
      if (!validateEmail(nextEmail)) return { ok: false, error: 'Invalid email' };
      if (users.some(u => u.email === nextEmail && u.email !== currentUser.email)) return { ok: false, error: 'Email already taken' };
    }
    if (updates.password !== undefined && updates.password.length < 6) return { ok: false, error: 'Password too short' };
    const updated: AuthUser = {
      ...currentUser,
      ...updates,
      email: nextEmail !== undefined ? nextEmail : currentUser.email,
    };
    set({ currentUser: updated, users: users.map(u => u.email === currentUser.email ? updated : u) });
    return { ok: true };
  },
  hydrateSession: (email, token) => {
    const { users } = get();
    const found = users.find(u => u.email === email);
    if (!found) return false;
    // Accept any token for now (demo) – could verify format or signature.
    set({ currentUser: found, sessionToken: token });
    return true;
  }
}));

export const useAuth = () => useAuthStore(s => ({ user: s.currentUser, login: s.login, logout: s.logout }));