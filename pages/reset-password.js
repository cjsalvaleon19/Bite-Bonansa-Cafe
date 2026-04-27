import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';

const ResetPassword = () => {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);

  useEffect(() => {
    // Check if we have a valid session from the password reset link
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setIsValidToken(true);
        } else {
          setError('Invalid or expired reset link. Please request a new password reset.');
        }
      } catch (err) {
        setError('Failed to verify reset link. Please try again.');
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      if (!supabase) {
        setError('Service unavailable. Please contact support.');
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login').catch(console.error);
      }, 3000);
    } catch (err) {
      setError('Failed to reset password. Please try again.');
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
          Create your new password
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

        {success ? (
          <div style={{
            backgroundColor: '#1a3a1a',
            color: '#4caf50',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            border: '1px solid #4caf50',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '20px', marginBottom: '8px' }}>✅ Password Reset!</p>
            <p style={{ marginBottom: '12px' }}>
              Your password has been successfully reset.
            </p>
            <p style={{ color: '#aaa', fontSize: '13px' }}>
              Redirecting to login page...
            </p>
          </div>
        ) : isValidToken ? (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '600',
                color: '#ffc107',
                fontSize: '14px'
              }}>
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
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
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
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
              {loading ? '⏳ Resetting...' : '🔐 RESET PASSWORD'}
            </button>
          </form>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '20px'
          }}>
            <p style={{
              color: '#999',
              fontSize: '14px',
              marginBottom: '20px'
            }}>
              This password reset link is invalid or has expired.
            </p>
            <Link href="/forgot-password">
              <button style={{
                padding: '12px 24px',
                backgroundColor: '#ffc107',
                color: '#0a0a0a',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}>
                Request New Reset Link
              </button>
            </Link>
          </div>
        )}

        <p style={{
          textAlign: 'center',
          marginTop: '20px',
          color: '#999',
          fontSize: '14px'
        }}>
          Remember your password?{' '}
          <Link href="/login" style={{
            color: '#ffc107',
            textDecoration: 'none',
            fontWeight: '700'
          }}>
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
