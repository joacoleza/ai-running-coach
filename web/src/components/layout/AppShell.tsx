import { Sidebar } from './Sidebar'
import { CoachPanel } from '../coach/CoachPanel'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <CoachPanel />
    </div>
  )
}
