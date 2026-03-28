import { useState, useEffect, useRef } from 'react'
import { Sidebar } from './Sidebar'
import { CoachPanel } from '../coach/CoachPanel'
import { useChatContext } from '../../contexts/ChatContext'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [coachOpen, setCoachOpen] = useState(false)
  const { plan } = useChatContext()
  const prevPlanStatusRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const handler = () => setCoachOpen(true);
    window.addEventListener('open-coach', handler);
    return () => window.removeEventListener('open-coach', handler);
  }, []);

  // Lock body scroll on mobile when coach panel is open (prevents Safari scrolling the page behind)
  useEffect(() => {
    document.body.style.overflow = coachOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [coachOpen]);

  // Auto-close coach panel when plan finishes onboarding and becomes active
  useEffect(() => {
    if (prevPlanStatusRef.current === 'onboarding' && plan?.status === 'active') {
      setCoachOpen(false);
    }
    prevPlanStatusRef.current = plan?.status;
  }, [plan?.status]);

  // FAB: text pill for no-plan/onboarding, icon-only for active, hidden when panel is open
  const fabLabel = !plan ? 'Start New Plan' : plan.status === 'onboarding' ? 'Continue Planning' : null;
  const fabIconOnly = plan?.status === 'active';
  const showFab = !coachOpen && (fabLabel !== null || fabIconOnly);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <CoachPanel isOpen={coachOpen} onClose={() => setCoachOpen(false)} />

      {/* Mobile FAB — opens coach panel; hidden on desktop */}
      {showFab && (
        <button
          onClick={() => setCoachOpen(true)}
          aria-label={fabLabel ?? 'Open coach'}
          className={`fixed bottom-6 right-4 z-40 bg-blue-600 text-white shadow-lg flex items-center gap-2 hover:bg-blue-700 transition-transform active:scale-95 md:hidden ${
            fabIconOnly
              ? 'w-14 h-14 rounded-full justify-center'
              : 'px-4 py-3 rounded-full text-sm font-medium'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          {!fabIconOnly && fabLabel}
        </button>
      )}
    </div>
  )
}
