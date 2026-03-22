import { useState } from 'react'

interface PasswordPageProps {
  onSuccess: () => void
}

export function PasswordPage({ onSuccess }: PasswordPageProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/health', {
        headers: { 'X-App-Password': password },
      })

      if (response.ok) {
        localStorage.setItem('app_password', password)
        setPassword('')
        onSuccess()
      } else if (response.status === 401) {
        setError('Wrong password')
        setPassword('')
      } else if (response.status === 503) {
        setError('Service locked. Contact administrator.')
      } else {
        setError('Unexpected error. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-6">AI Running Coach</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !password}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
          >
            {loading ? 'Checking...' : 'Unlock'}
          </button>
          {error && (
            <p className="text-red-600 text-sm mt-2">{error}</p>
          )}
        </form>
      </div>
    </div>
  )
}
