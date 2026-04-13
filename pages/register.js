import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../utils/supabaseClient';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Register via Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, phone } },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Generate Customer ID via API
      const res = await fetch('/api/loyalty/register-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.user.id, name, email, phone }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.message || 'Failed to create customer profile');
        setLoading(false);
        return;
      }

      setSuccess(`Registration successful! Your Customer ID is: ${json.customerId}. Please check your email to confirm your account.`);
      setLoading(false);
    } catch (err) {
      setError('Registration failed. Please try again.');
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    border: '2px solid #ffc107',
    borderRadius: '6px',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: '14px',
    boxSizing: 'border-box',
    transition: 'all 0.3s',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: '600',
    color: '#ffc107',
    fontSize: '14px',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
      fontFamily: "'Poppins', sans-serif",
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        backgroundColor: '#1a1a1a',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 15px 50px rgba(255, 193, 7, 0.15)',
        border: '1px solid #ffc107',
      }}>
        <h2 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          marginBottom: '10px',
          textAlign: 'center',
          color: '#ffc107',
          fontFamily: "'Playfair Display', serif",
        }}>
          ☕ Create Account
        </h2>

        <p style={{ textAlign: 'center', color: '#999', marginBottom: '30px', fontSize: '14px' }}>
          Join Bite Bonansa and earn loyalty points!
        </p>

        {error && (
          <div style={{
            backgroundColor: '#3a1a1a',
            color: '#ff6b6b',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '14px',
            border: '1px solid #ff6b6b',
          }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div style={{
            backgroundColor: '#1a3a1a',
            color: '#6bff6b',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '14px',
            border: '1px solid #6bff6b',
          }}>
            ✅ {success}
          </div>
        )}

        {!success && (
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan dela Cruz"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = '#ffb300'; e.target.style.boxShadow = '0 0 10px rgba(255,193,7,0.3)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#ffc107'; e.target.style.boxShadow = 'none'; }}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = '#ffb300'; e.target.style.boxShadow = '0 0 10px rgba(255,193,7,0.3)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#ffc107'; e.target.style.boxShadow = 'none'; }}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09XX-XXX-XXXX"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = '#ffb300'; e.target.style.boxShadow = '0 0 10px rgba(255,193,7,0.3)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#ffc107'; e.target.style.boxShadow = 'none'; }}
                required
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = '#ffb300'; e.target.style.boxShadow = '0 0 10px rgba(255,193,7,0.3)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#ffc107'; e.target.style.boxShadow = 'none'; }}
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
                fontFamily: "'Poppins', sans-serif",
              }}
              onMouseOver={(e) => { if (!loading) { e.target.style.backgroundColor = '#ffb300'; } }}
              onMouseOut={(e) => { if (!loading) { e.target.style.backgroundColor = '#ffc107'; } }}
            >
              {loading ? '⏳ Creating account...' : '🎉 Register'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: '20px', color: '#999', fontSize: '14px' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#ffc107', textDecoration: 'none', fontWeight: '700' }}>
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
