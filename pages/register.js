import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

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
  outline: 'none',
};

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontWeight: '600',
  color: '#ffc107',
  fontSize: '14px',
};

const Register = () => {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validate = () => {
    if (!form.fullName.trim()) return 'Full name is required.';
    if (!form.email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Invalid email address.';
    if (!form.phone.trim()) return 'Phone number is required.';
    const phoneDigits = form.phone.replace(/[\s+\-()]/g, '');
    if (!/^\d{7,15}$/.test(phoneDigits)) return 'Invalid phone number.';
    if (!form.password) return 'Password is required.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          address: form.address.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      setSuccess(data.customerId);
      setLoading(false);

      // Redirect to login after 4 seconds
      setTimeout(() => {
        router.push('/login');
      }, 4000);
    } catch {
      setError('Registration failed. Please try again.');
      setLoading(false);
    }
  };

  const focusStyle = (e) => {
    e.target.style.borderColor = '#ffb300';
    e.target.style.boxShadow = '0 0 10px rgba(255, 193, 7, 0.3)';
  };
  const blurStyle = (e) => {
    e.target.style.borderColor = '#ffc107';
    e.target.style.boxShadow = 'none';
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
          ☕ Bite Bonansa
        </h2>

        <p style={{
          textAlign: 'center',
          color: '#999',
          marginBottom: '30px',
          fontSize: '14px',
        }}>
          Create your account to start ordering
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

        {success ? (
          <div style={{
            backgroundColor: '#1a3a1a',
            color: '#4caf50',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            border: '1px solid #4caf50',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '20px', marginBottom: '8px' }}>🎉 Account Created!</p>
            <p style={{ marginBottom: '12px' }}>
              Welcome to Bite Bonansa Cafe. Your loyalty account is ready.
            </p>
            <div style={{
              backgroundColor: '#0a1a0a',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '12px',
            }}>
              <p style={{ color: '#999', fontSize: '12px', marginBottom: '4px' }}>Your Customer Loyalty ID</p>
              <p style={{
                color: '#ffc107',
                fontWeight: '700',
                fontSize: '22px',
                letterSpacing: '2px',
                fontFamily: "'Playfair Display', serif",
              }}>
                {success}
              </p>
              <p style={{ color: '#999', fontSize: '11px', marginTop: '4px' }}>
                Keep this ID to earn and redeem loyalty points
              </p>
            </div>
            <p style={{ color: '#aaa', fontSize: '13px' }}>
              Redirecting to login in a moment...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                placeholder="e.g. Catherine Jean Salvaleon"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="your@email.com"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="e.g. 09514915138"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
                required
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
                required
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>
                Address <span style={{ color: '#666', fontWeight: '400' }}>(optional)</span>
              </label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Your delivery address"
                style={inputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
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
                fontFamily: "'Poppins', sans-serif",
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
              {loading ? '⏳ Creating account...' : '🚀 CREATE ACCOUNT'}
            </button>
          </form>
        )}

        <p style={{
          textAlign: 'center',
          marginTop: '20px',
          color: '#999',
          fontSize: '14px',
        }}>
          Already have an account?{' '}
          <Link href="/login" style={{
            color: '#ffc107',
            textDecoration: 'none',
            fontWeight: '700',
          }}>
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
