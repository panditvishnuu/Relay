import { create } from 'zustand';
import { api, rawApi, refreshSession, setAccessToken, setOnAuthLost } from '@/lib/api';

/**
 * The access token deliberately lives in module memory (see lib/api.js), not
 * here and not in localStorage — a page reload recovers the session from the
 * httpOnly refresh cookie instead, which XSS can't read.
 */
export const useAuthStore = create((set) => ({
  user: null,
  status: 'loading', // loading | authenticated | anonymous

  async bootstrap() {
    try {
      const { user } = await refreshSession();
      set({ user, status: 'authenticated' });
    } catch {
      set({ user: null, status: 'anonymous' });
    }
  },

  async register(values) {
    const { data } = await rawApi.post('/auth/register', values);
    setAccessToken(data.accessToken);
    set({ user: data.user, status: 'authenticated' });
    return data.user;
  },

  async login(values) {
    const { data } = await rawApi.post('/auth/login', values);
    setAccessToken(data.accessToken);
    set({ user: data.user, status: 'authenticated' });
    return data.user;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      set({ user: null, status: 'anonymous' });
    }
  },

  async updateProfile(patch) {
    const { data } = await api.patch('/users/me', patch);
    set({ user: data.user });
    return data.user;
  },

  setUser: (user) => set({ user }),
}));

// a failed refresh anywhere in the app drops us back to the login screen
setOnAuthLost(() => useAuthStore.setState({ user: null, status: 'anonymous' }));
