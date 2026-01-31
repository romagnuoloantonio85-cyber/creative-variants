import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase, signIn, signUp, getCurrentUser } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Check if user is already logged in
    checkUser()
  }, [])

  const checkUser = async () => {
    const user = await getCurrentUser()
    if (user) {
      router.push('/dashboard')
    }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        const { data, error } = await signIn(email, password)
        if (error) throw error
        router.push('/dashboard')
      } else {
        const { data, error } = await signUp(email, password)
        if (error) throw error
        setError('Check your email for confirmation!')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h1 style={{
          fontSize: '4rem',
          fontWeight: 'bold',
          marginBottom: '20px',
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          CREATIVE VARIANTS
        </h1>
        <p style={{
          fontSize: '1.5rem',
          color: 'var(--text-secondary)',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          Genera varianti intelligenti delle tue creative video con AI
        </p>
      </div>

      {/* Auth Form */}
      <div className="card" style={{
        maxWidth: '400px',
        width: '100%'
      }}>
        <h2 style={{ marginBottom: '24px', textAlign: 'center' }}>
          {isLogin ? 'Accedi' : 'Registrati'}
        </h2>

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              Email
            </label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          {error && (
            <div style={{
              padding: '12px',
              background: error.includes('Check') ? 'var(--accent-primary)20' : '#ff4d4f20',
              border: `1px solid ${error.includes('Check') ? 'var(--accent-primary)' : '#ff4d4f'}`,
              borderRadius: '8px',
              color: error.includes('Check') ? 'var(--accent-primary)' : '#ff4d4f',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '16px' }}
          >
            {loading ? '⏳ Caricamento...' : (isLogin ? '🚀 Accedi' : '✨ Registrati')}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          color: 'var(--text-secondary)'
        }}>
          {isLogin ? 'Non hai un account?' : 'Hai già un account?'}
          {' '}
          <button
            onClick={() => {
              setIsLogin(!isLogin)
              setError('')
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-primary)',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 'inherit',
              fontFamily: 'inherit'
            }}
          >
            {isLogin ? 'Registrati' : 'Accedi'}
          </button>
        </div>
      </div>

      {/* Features */}
      <div style={{
        marginTop: '80px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '30px',
        maxWidth: '900px',
        width: '100%'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎬</div>
          <h3 style={{ marginBottom: '8px' }}>Genera Video AI</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            3 video da 3 frame con Luma AI
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🤖</div>
          <h3 style={{ marginBottom: '8px' }}>Varianti Intelligenti</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Gemini AI estrae dati e genera varianti
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>☁️</div>
          <h3 style={{ marginBottom: '8px' }}>Cloud Managed</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Zero configurazione, tutto server-side
          </p>
        </div>
      </div>
    </div>
  )
}
