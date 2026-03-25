import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { CoachPanel } from '../coach/CoachPanel'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [coachOpen, setCoachOpen] = useState(false)

  useEffect(() => {
    const handler = () => setCoachOpen(true);
    window.addEventListener('open-coach', handler);
    return () => window.removeEventListener('open-coach', handler);
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <CoachPanel isOpen={coachOpen} onClose={() => setCoachOpen(false)} />

      {/* Mobile FAB — opens coach panel; hidden on desktop */}
      <button
        onClick={() => setCoachOpen(true)}
        aria-label="Open coach"
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-transform active:scale-95 md:hidden ${coachOpen ? 'hidden' : 'flex'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>
    </div>
  )
}
