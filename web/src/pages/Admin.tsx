import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface AdminUser {
  _id: string;
  email: string;
  active?: boolean;
  tempPassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

function getUserStatus(user: AdminUser): 'Active' | 'Pending' | 'Deactivated' {
  if (user.active === false) return 'Deactivated';
  if (user.tempPassword) return 'Pending';
  return 'Active';
}

function StatusBadge({ user }: { user: AdminUser }) {
  const status = getUserStatus(user);
  if (status === 'Active') {
    return <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Active</span>;
  }
  if (status === 'Pending') {
    return <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">Pending</span>;
  }
  return <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">Deactivated</span>;
}

function formatCost(n: number): string {
  return '$' + n.toFixed(2);
}

function formatLastLogin(date?: Date | string): string {
  if (!date) return 'Never';
  const d = new Date(date);
  return d.toLocaleString('sv-SE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).replace('T', ' ');
}

export function Admin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [tempPasswordModal, setTempPasswordModal] = useState<{ password: string; heading: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [usageSummary, setUsageSummary] = useState<Record<string, { thisMonth: number; allTime: number }>>({});
  const { token, email: adminEmail } = useAuth();

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, summaryRes] = await Promise.all([
        fetch('/api/users', { headers: { 'X-Authorization': `Bearer ${token}` } }),
        fetch('/api/users/usage-summary', { headers: { 'X-Authorization': `Bearer ${token}` } }),
      ]);
      if (!usersRes.ok) throw new Error('Failed to load users. Please refresh the page.');
      const data = await usersRes.json() as { users: AdminUser[] };
      setUsers(data.users);
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json() as { summary: Record<string, { thisMonth: number; allTime: number }> };
        setUsageSummary(summaryData.summary ?? {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!createEmail.trim()) { setCreateError('Email is required'); return; }
    setCreateLoading(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: createEmail.trim() }),
      });
      const data = await res.json() as { tempPassword?: string; error?: string };
      if (!res.ok) { setCreateError(`Failed to create user. ${data.error ?? ''}`); return; }
      setShowCreateModal(false);
      setCreateEmail('');
      setTempPasswordModal({ password: data.tempPassword!, heading: 'New Account Created' });
    } catch {
      setCreateError('Failed to create user.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleResetPassword = async (user: AdminUser) => {
    if (!window.confirm(`Reset password for ${user.email}? A new temporary password will be generated.`)) return;
    try {
      const res = await fetch(`/api/users/${user._id}/reset-password`, {
        method: 'POST',
        headers: { 'X-Authorization': `Bearer ${token}` },
      });
      const data = await res.json() as { tempPassword?: string; error?: string };
      if (!res.ok) { setError(`Failed to reset password. ${data.error ?? ''}`); return; }
      setTempPasswordModal({ password: data.tempPassword!, heading: 'Password Reset' });
    } catch {
      setError('Failed to reset password.');
    }
  };

  const handleToggleActive = async (user: AdminUser, newActive: boolean) => {
    if (!newActive) {
      if (!window.confirm(`Deactivate ${user.email}? They will no longer be able to log in.`)) return;
    }
    try {
      const res = await fetch(`/api/users/${user._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` },
        body: JSON.stringify({ active: newActive }),
      });
      const data = await res.json() as { user?: AdminUser; error?: string };
      if (!res.ok) { setError(`Failed to update user. ${data.error ?? ''}`); return; }
      setUsers(prev => prev.map(u => u._id === user._id ? { ...u, active: newActive } : u));
    } catch {
      setError('Failed to update user.');
    }
  };

  const handleDismissTempModal = async () => {
    setTempPasswordModal(null);
    setCopied(false);
    await fetchUsers();
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
        <button
          onClick={() => { setShowCreateModal(true); setCreateError(null); setCreateEmail(''); }}
          className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
        >
          Create User
        </button>
      </div>

      {error !== null && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 text-sm">No users yet. Create the first account using the button above.</p>
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <ul className="md:hidden divide-y divide-gray-100">
              {users.map(user => {
                const isSelf = user.email === adminEmail;
                const isDeactivated = user.active === false;
                return (
                  <li key={user._id} className="px-4 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-900 break-all">{user.email}</span>
                      <StatusBadge user={user} />
                    </div>
                    <p className="text-xs text-gray-400">Last login: {formatLastLogin(user.lastLoginAt)}</p>
                    <p className="text-xs text-gray-400 mb-3">
                      Month: {formatCost(usageSummary[user._id]?.thisMonth ?? 0)} &nbsp;&middot;&nbsp; All-time: {formatCost(usageSummary[user._id]?.allTime ?? 0)}
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={() => handleResetPassword(user)}
                        aria-label={`Reset password for ${user.email}`}
                        className="text-sm font-bold text-gray-700 hover:text-gray-900 cursor-pointer"
                      >
                        Reset Password
                      </button>
                      {isDeactivated ? (
                        <button
                          onClick={() => handleToggleActive(user, true)}
                          aria-label={`Activate ${user.email}`}
                          className="text-sm font-bold text-green-600 hover:text-green-800 cursor-pointer"
                        >
                          Activate
                        </button>
                      ) : isSelf ? (
                        <button
                          disabled
                          aria-disabled="true"
                          title="Cannot deactivate your own account"
                          className="text-sm font-bold text-gray-300 cursor-not-allowed"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleActive(user, false)}
                          aria-label={`Deactivate ${user.email}`}
                          className="text-sm font-bold text-red-600 hover:text-red-800 cursor-pointer"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th scope="col" className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide text-left">Email</th>
                    <th scope="col" className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide text-left">Status</th>
                    <th scope="col" className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide text-left">Last Login</th>
                    <th scope="col" className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide text-left">Month</th>
                    <th scope="col" className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide text-left">All-time</th>
                    <th scope="col" className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const isSelf = user.email === adminEmail;
                    const isDeactivated = user.active === false;
                    const lastLogin = formatLastLogin(user.lastLoginAt);
                    return (
                      <tr key={user._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">{user.email}</td>
                        <td className="px-4 py-3"><StatusBadge user={user} /></td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {lastLogin === 'Never' ? <span className="text-gray-400">Never</span> : lastLogin}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatCost(usageSummary[user._id]?.thisMonth ?? 0)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatCost(usageSummary[user._id]?.allTime ?? 0)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleResetPassword(user)}
                            aria-label={`Reset password for ${user.email}`}
                            className="text-sm font-bold text-gray-700 hover:text-gray-900 cursor-pointer mr-4"
                          >
                            Reset Password
                          </button>
                          {isDeactivated ? (
                            <button
                              onClick={() => handleToggleActive(user, true)}
                              aria-label={`Activate ${user.email}`}
                              className="text-sm font-bold text-green-600 hover:text-green-800 cursor-pointer"
                            >
                              Activate
                            </button>
                          ) : isSelf ? (
                            <button
                              disabled
                              aria-disabled="true"
                              title="Cannot deactivate your own account"
                              className="text-sm font-bold text-gray-300 cursor-not-allowed"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleActive(user, false)}
                              aria-label={`Deactivate ${user.email}`}
                              className="text-sm font-bold text-red-600 hover:text-red-800 cursor-pointer"
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-heading"
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
          onKeyDown={(e) => e.key === 'Escape' && setShowCreateModal(false)}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 my-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 id="create-user-heading" className="text-lg font-bold text-gray-900">Create User</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >✕</button>
            </div>
            <input
              type="email"
              value={createEmail}
              onChange={e => setCreateEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            {createError && <p className="text-sm text-red-600 mt-1 mb-3">{createError}</p>}
            <div className="flex gap-3 mt-4 justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-bold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={handleCreate}
                disabled={createLoading}
                className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {createLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tempPasswordModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="temp-pw-heading"
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 my-auto">
            <h2 id="temp-pw-heading" className="text-lg font-bold text-gray-900 mb-4">{tempPasswordModal.heading}</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-4">
              Save this password — it won&apos;t be shown again.
            </div>
            <div
              className="bg-gray-100 rounded-lg p-4 font-mono text-lg text-gray-900 text-center select-all mb-4"
              aria-label="Temporary password"
              role="textbox"
            >
              {tempPasswordModal.password}
            </div>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(tempPasswordModal.password);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className={`w-full py-2 text-sm font-bold rounded-lg mb-3 cursor-pointer ${copied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
            <button
              onClick={handleDismissTempModal}
              className="w-full py-2 text-sm font-bold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer"
            >
              I&apos;ve saved the password
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
