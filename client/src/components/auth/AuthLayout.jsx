import { motion, useReducedMotion } from 'framer-motion';
import { MessagesSquare, ShieldCheck, Users, Zap } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { listContainer, listItem, pageVariants, spring } from '@/lib/motion';

const highlights = [
  { icon: Zap, title: 'Instant delivery', body: 'Messages land in milliseconds over a live socket — no refresh, ever.' },
  { icon: Users, title: 'Groups that keep up', body: 'Create a room, add your people, rename it whenever the project pivots.' },
  { icon: ShieldCheck, title: 'Sessions done right', body: 'Rotating refresh tokens in httpOnly cookies. Stay signed in, stay safe.' },
];

/** Split screen: brand story on the left (desktop only), form on the right. */
export function AuthLayout({ children }) {
  const reduceMotion = useReducedMotion();

  // two blooms drifting on long, offset loops — slow enough to read as ambient
  // light rather than movement competing with the form
  const drift = (i) =>
    reduceMotion
      ? {}
      : {
          animate: { x: [0, 30 * (i ? -1 : 1), 0], y: [0, 24, 0], scale: [1, 1.12, 1] },
          transition: { duration: 18 + i * 6, repeat: Infinity, ease: 'easeInOut' },
        };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="grid min-h-[100dvh] lg:grid-cols-2"
    >
      {/* ---- brand side ---- */}
      <div className="brand-gradient relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* drifting light blooms */}
        <motion.div
          {...drift(0)}
          className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-white/20 blur-3xl"
        />
        <motion.div
          {...drift(1)}
          className="pointer-events-none absolute -right-20 -bottom-32 size-[28rem] rounded-full bg-white/10 blur-3xl"
        />

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.smooth}
          className="relative flex items-center gap-2.5"
        >
          <div className="grid size-10 place-items-center rounded-xl bg-white/20 backdrop-blur">
            <MessagesSquare className="size-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">Relay</span>
        </motion.div>

        <div className="relative max-w-md">
          <h1 className="text-4xl leading-tight font-extrabold text-balance">
            Talk without the lag.
          </h1>
          <p className="mt-3 text-white/80">
            Relay keeps every conversation in sync across every device you sign in on.
          </p>

          <motion.ul variants={listContainer} initial="initial" animate="animate" className="mt-10 space-y-6">
            {highlights.map(({ icon: Icon, title, body }) => (
              <motion.li key={title} variants={listItem} className="flex gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur">
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-white/75">{body}</p>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <p className="relative text-xs text-white/60">Built on the MERN stack · Socket.io</p>
      </div>

      {/* ---- form side ---- */}
      <div className="relative flex items-center justify-center bg-background px-5 py-10 sm:px-8">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          {/* compact logo for the mobile layout, where the brand panel is hidden */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="brand-gradient grid size-10 place-items-center rounded-xl text-white shadow-md">
              <MessagesSquare className="size-5" />
            </div>
            <span className="text-xl font-extrabold tracking-tight">Relay</span>
          </div>

          {children}
        </div>
      </div>
    </motion.div>
  );
}
