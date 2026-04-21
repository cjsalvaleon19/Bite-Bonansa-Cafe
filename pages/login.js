import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';

const Login = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!supabase) {
        setError('Service unavailable. Please contact support.');
        setLoading(false);
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      localStorage.setItem('token', data.session.access_token);
      
      // Fetch user role from database to redirect appropriately
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (userError) {
        console.error('[Login] Failed to fetch user role:', userError.message);
        // Default to dashboard if role fetch fails
        await router.push('/dashboard');
        return;
      }

      const role = userData?.role || 'customer';

      // Role-based redirect
      if (role === 'customer') {
        await router.push('/customer/dashboard');
      } else if (role === 'cashier') {
        await router.push('/cashier');
      } else if (role === 'rider') {
        await router.push('/rider/dashboard');
      } else if (role === 'admin') {
        await router.push('/dashboard');
      } else {
        // Default fallback
        await router.push('/dashboard');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
      fontFamily: "'Poppins', sans-serif",
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '450px',
        width: '100%',
        backgroundColor: '#1a1a1a',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 15px 50px rgba(255, 193, 7, 0.15)',
        border: '1px solid #ffc107'
      }}>
        <h2 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          marginBottom: '10px',
          textAlign: 'center',
          color: '#ffc107',
          fontFamily: "'Playfair Display', serif"
        }}>
          ☕ Bite Bonansa
        </h2>

        <p style={{
          textAlign: 'center',
          color: '#999',
          marginBottom: '30px',
          fontSize: '14px'
        }}>
          Welcome back, coffee lover!
        </p>

        {error && (
          <div style={{
            backgroundColor: '#3a1a1a',
            color: '#ff6b6b',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '14px',
            border: '1px solid #ff6b6b'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontWeight: '600',
              color: '#ffc107',
              fontSize: '14px'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #ffc107',
                borderRadius: '6px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box',
                transition: 'all 0.3s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#ffb300';
                e.target.style.boxShadow = '0 0 10px rgba(255, 193, 7, 0.3)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#ffc107';
                e.target.style.boxShadow = 'none';
              }}
              required
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontWeight: '600',
              color: '#ffc107',
              fontSize: '14px'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #ffc107',
                borderRadius: '6px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box',
                transition: 'all 0.3s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#ffb300';
                e.target.style.boxShadow = '0 0 10px rgba(255, 193, 7, 0.3)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#ffc107';
                e.target.style.boxShadow = 'none';
              }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: loading ? '#666' : '#ffc107',
              color: loading ? '#999' : '#0a0a0a',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: '0 5px 15px rgba(255, 193, 7, 0.2)',
              fontFamily: "'Poppins', sans-serif"
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = '#ffb300';
                e.target.style.boxShadow = '0 10px 25px rgba(255, 193, 7, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = '#ffc107';
                e.target.style.boxShadow = '0 5px 15px rgba(255, 193, 7, 0.2)';
              }
            }}
          >
            {loading ? '⏳ Logging in...' : '🔓 LOGIN'}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          marginTop: '20px',
          color: '#999',
          fontSize: '14px'
        }}>
          Don't have an account?{' '}
          <Link href="/register" style={{
            color: '#ffc107',
            textDecoration: 'none',
            fontWeight: '700'
          }}>
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
