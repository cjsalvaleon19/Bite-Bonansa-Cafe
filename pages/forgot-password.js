import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../utils/supabaseClient';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (!supabase) {
        setError('Service unavailable. Please contact support.');
        setLoading(false);
        return;
      }

      // Get the current origin for the redirect URL
      const origin = window.location.origin;
      
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err) {
      setError('Failed to send reset email. Please try again.');
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
          Reset your password
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
            <p style={{ fontSize: '20px', marginBottom: '8px' }}>✅ Email Sent!</p>
            <p style={{ marginBottom: '12px' }}>
              We've sent a password reset link to <strong>{email}</strong>
            </p>
            <p style={{ color: '#aaa', fontSize: '13px' }}>
              Please check your email and click the link to reset your password.
              If you don't see it, check your spam folder.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: '600',
                color: '#ffc107',
                fontSize: '14px'
              }}>
                Email Address
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
              <p style={{
                fontSize: '12px',
                color: '#999',
                marginTop: '8px'
              }}>
                Enter the email address associated with your account
              </p>
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
              {loading ? '⏳ Sending...' : '📧 SEND RESET LINK'}
            </button>
          </form>
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

export default ForgotPassword;
