import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ChatThread } from '@/components/thread/ChatThread';
import { EmptyThread } from '@/components/thread/EmptyThread';
import { DetailsPanel } from '@/components/details/DetailsPanel';
import { ConnectionBanner } from '@/components/common/ConnectionBanner';
import { useIsDesktop, useIsTablet } from '@/hooks/useMediaQuery';
import { useRealtime } from '@/hooks/useRealtime';
import { useUIStore } from '@/store/ui';
import { useChatStore } from '@/store/chat';
import { cn } from '@/lib/utils';
import { ease } from '@/lib/motion';

/**
 * Responsive orchestration for the three panes:
 *   < 768px   one pane at a time — list, or thread; details in a Sheet
 *   768–1279  list + thread;                        details in a Sheet
 *   >= 1280   list + thread + docked details column
 */
export default function ChatPage() {
  useRealtime();

  const isDesktop = useIsDesktop();
  const isTablet = useIsTablet();

  const activeId = useUIStore((s) => s.activeConversationId);
  const detailsOpen = useUIStore((s) => s.detailsOpen);
  const openConversation = useUIStore((s) => s.openConversation);
  const closeConversation = useUIStore((s) => s.closeConversation);
  const setDetailsOpen = useUIStore((s) => s.setDetailsOpen);
  const toggleDetails = useUIStore((s) => s.toggleDetails);

  const conversations = useChatStore((s) => s.conversations);
  const fetchConversations = useChatStore((s) => s.fetchConversations);

  useEffect(() => {
    fetchConversations().catch(() => toast.error('Could not load your chats'));
  }, [fetchConversations]);

  const active = conversations.find((c) => c._id === activeId) ?? null;

  const showSidebar = isTablet || !active;
  const showThread = isTablet || !!active;
  const dockDetails = isDesktop && detailsOpen && !!active;
  const sheetDetails = !isDesktop && detailsOpen && !!active;

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-muted/40 p-0 xl:p-4">
      <ConnectionBanner />

      <div
        className={cn(
          'mx-auto grid h-full w-full max-w-[1800px] overflow-hidden bg-card',
          'xl:rounded-3xl xl:border xl:shadow-xl',
          'grid-cols-1',
          isTablet && !dockDetails && 'md:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr]',
          dockDetails && 'xl:grid-cols-[360px_1fr_360px]'
        )}
      >
        {/*
          On phones the two panes replace each other, so they slide: the list
          exits left as the thread enters from the right. On wider screens both
          are mounted at once and no transition applies.
        */}
        <AnimatePresence initial={false} mode="popLayout">
          {showSidebar && (
            <motion.div
              key="sidebar"
              initial={isTablet ? false : { x: '-100%' }}
              animate={{ x: 0 }}
              exit={isTablet ? undefined : { x: '-100%' }}
              transition={{ duration: 0.28, ease: ease.out }}
              className="h-full min-h-0 md:border-r"
            >
              <Sidebar activeId={activeId} onSelect={openConversation} />
            </motion.div>
          )}
        </AnimatePresence>

        {showThread && (
          <div className="h-full min-h-0">
            {active ? (
              <ChatThread
                key={active._id}
                conversation={active}
                showBack={!isTablet}
                onBack={closeConversation}
                onOpenDetails={toggleDetails}
              />
            ) : (
              <EmptyThread />
            )}
          </div>
        )}

        {dockDetails && (
          <div className="h-full min-h-0 border-l">
            <DetailsPanel conversation={active} onClose={() => setDetailsOpen(false)} />
          </div>
        )}
      </div>

      {/* below xl the details pane slides in as an overlay instead of a column */}
      <Sheet open={sheetDetails} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetTitle className="sr-only">Conversation details</SheetTitle>
          <SheetDescription className="sr-only">Profile, shared media and settings</SheetDescription>
          {active && <DetailsPanel conversation={active} onClose={() => setDetailsOpen(false)} showClose={false} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
