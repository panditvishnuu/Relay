import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from '@/components/ui/sonner';
import { RedirectIfAuthed, RequireAuth } from '@/components/auth/RouteGuards';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ChatPage from '@/pages/ChatPage';
import { useAuthStore } from '@/store/auth';

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const location = useLocation();

  // one refresh call on mount decides authenticated vs anonymous
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <>
      {/* keyed on pathname so login↔register cross-fade instead of hard-cutting */}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="/app" element={<ChatPage />} />
        </Route>

          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </AnimatePresence>

      <Toaster richColors closeButton />
    </>
  );
}
