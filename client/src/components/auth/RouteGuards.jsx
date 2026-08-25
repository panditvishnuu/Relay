import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

/** Shown while the initial refresh call decides whether we have a session. */
function BootSplash() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="brand-gradient grid size-14 animate-pulse place-items-center rounded-2xl text-white shadow-lg">
          <MessagesSquare className="size-7" />
        </div>
        <p className="text-sm text-muted-foreground">Restoring your session…</p>
      </div>
    </div>
  );
}

/** Blocks the app until authenticated, remembering where the user was headed. */
export function RequireAuth() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'loading') return <BootSplash />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** Keeps signed-in users off /login and /register. */
export function RedirectIfAuthed() {
  const status = useAuthStore((s) => s.status);

  if (status === 'loading') return <BootSplash />;
  if (status === 'authenticated') return <Navigate to="/app" replace />;
  return <Outlet />;
}
