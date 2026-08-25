import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { TooltipProvider } from '@/components/ui/tooltip';
import App from './App';
import { applyTheme, useUIStore } from '@/store/ui';
import './index.css';

// paint the persisted theme before first render to avoid a light-mode flash
applyTheme(useUIStore.getState().theme);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 } },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/*
        reducedMotion="user" makes every Framer animation in the app respect the
        OS setting. The CSS guard in index.css only covers CSS animations, so
        without this the JS-driven motion would keep playing for people who have
        asked the system not to animate.
      */}
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={200}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>
);
