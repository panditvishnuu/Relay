import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * UI-only state: theme, which conversation is open, whether the details pane
 * is showing. Server/chat data lands in its own store in chunk 3.
 */
export const useUIStore = create()(
  persist(
    (set, get) => ({
      theme: 'light',
      activeConversationId: null,
      detailsOpen: false,

      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

      openConversation: (id) => set({ activeConversationId: id, detailsOpen: false }),
      closeConversation: () => set({ activeConversationId: null, detailsOpen: false }),

      setDetailsOpen: (open) => set({ detailsOpen: open }),
      toggleDetails: () => set((s) => ({ detailsOpen: !s.detailsOpen })),
    }),
    {
      name: 'relay-ui',
      partialize: (s) => ({ theme: s.theme, activeConversationId: s.activeConversationId }),
      onRehydrateStorage: () => (state) => applyTheme(state?.theme ?? 'light'),
    }
  )
);

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}
