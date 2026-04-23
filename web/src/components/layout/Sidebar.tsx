import { useState, useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: "📊" },
  { path: "/plan", label: "Training Plan", icon: "📅" },
  { path: "/runs", label: "Runs", icon: "🏃" },
  { path: "/archive", label: "Archive", icon: "🗄️" },
];

export function Sidebar() {
  const { token, logout, isAdmin, email } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  return (
    <aside
      className="flex flex-col bg-gray-900 text-white w-16 md:w-56 h-full sticky top-0 overflow-y-auto transition-all duration-200"
      data-testid="sidebar"
    >
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(prev => !prev)}
          className="flex items-center w-full px-3 py-3 hover:bg-gray-800 transition-colors cursor-pointer"
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
        >
          {/* Logo — small on mobile, slightly larger on desktop */}
          <div className="bg-white rounded-full p-1 flex-shrink-0 flex items-center justify-center w-8 h-8 md:w-9 md:h-9">
            <img src="/logo.png" alt="AI Running Coach" className="w-5 h-5 md:w-6 md:h-6 object-contain" />
          </div>
          {/* Email — hidden on mobile (icon-only sidebar), visible on desktop */}
          <span className="ml-2 flex-1 text-xs text-gray-300 truncate hidden md:block">
            {email ?? ''}
          </span>
          {/* Chevron — hidden on mobile */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-gray-400 flex-shrink-0 hidden md:block transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div className="absolute left-0 top-full min-w-[140px] bg-gray-800 border border-gray-700 rounded shadow-lg z-50">
            <button
              type="button"
              onClick={async () => {
                setDropdownOpen(false);
                const refreshToken = localStorage.getItem('refresh_token');
                try {
                  await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Authorization': `Bearer ${token ?? ''}`,
                    },
                    body: JSON.stringify({ refreshToken }),
                  });
                } catch {
                  // ignore — clear client state regardless
                }
                logout();
              }}
              className="flex items-center w-full px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        )}
      </div>

      <nav
        className="flex-1 mt-4"
        role="navigation"
        aria-label="Main navigation"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={true}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 text-sm transition-colors ${
                isActive
                  ? "bg-gray-800 text-white border-l-4 border-blue-500"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white border-l-4 border-transparent"
              }`
            }
          >
            <span className="text-lg" role="img" aria-label={item.label}>
              {item.icon}
            </span>
            <span className="ml-3 hidden md:inline">{item.label}</span>
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            end={true}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 text-sm transition-colors ${
                isActive
                  ? "bg-gray-800 text-white border-l-4 border-blue-500"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white border-l-4 border-transparent"
              }`
            }
          >
            <span className="text-lg" role="img" aria-label="Admin">⚙️</span>
            <span className="ml-3 hidden md:inline">Admin</span>
          </NavLink>
        )}
      </nav>
    </aside>
  );
}
