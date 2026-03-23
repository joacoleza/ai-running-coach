import { NavLink } from 'react-router-dom'

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/plan', label: 'Training Plan', icon: '📅' },
  { path: '/coach', label: 'Coach Chat', icon: '💬' },
  { path: '/runs', label: 'Runs', icon: '🏃' },
]

export function Sidebar() {
  return (
    <aside className="flex flex-col bg-gray-900 text-white w-16 md:w-56 min-h-screen transition-all duration-200" data-testid="sidebar">
      <div className="p-4 hidden md:block">
        <h2 className="text-lg font-bold">AI Coach</h2>
      </div>
      <nav className="flex-1 mt-4" role="navigation" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white border-l-4 border-blue-500'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white border-l-4 border-transparent'
              }`
            }
          >
            <span className="text-lg" role="img" aria-label={item.label}>{item.icon}</span>
            <span className="ml-3 hidden md:inline">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-2 mb-2">
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('app_password')
            window.location.href = '/'
          }}
          className="flex items-center w-full text-left px-4 py-3 text-sm text-gray-400 hover:bg-gray-800 hover:text-white rounded transition-colors"
        >
          <span className="text-lg">&#x1F6AA;</span>
          <span className="ml-3 hidden md:inline">Logout</span>
        </button>
      </div>
    </aside>
  )
}
