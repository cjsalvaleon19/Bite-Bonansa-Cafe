import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../utils/supabaseClient';
import { generateCustomerId } from '../utils/loyaltyUtils';

const inputStyle = {
  width: '100%', padding: '12px', border: '2px solid #333', borderRadius: '6px',
  backgroundColor: '#2a2a2a', color: '#fff', fontSize: '14px', boxSizing: 'border-box',
  outline: 'none', fontFamily: "'Poppins', sans-serif",
};

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const customerId = generateCustomerId();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { name: form.name, role: 'customer' },
        },
      });

      if (authError) { setError(authError.message); setLoading(false); return; }

      const userId = authData.user?.id;

      // Create customer record via API
      const resp = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, name: form.name, email: form.email, phone: form.phone }),
      });
      const result = await resp.json();
      if (!resp.ok) { setError(result.error || 'Failed to create customer record'); setLoading(false); return; }

      setSuccess(`Account created! Your Customer ID is: ${result.data.customer_id}. Redirecting to login...`);
      setTimeout(() => { window.location.href = '/login'; }, 3000);
    } catch (err) {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
      fontFamily: "'Poppins', sans-serif", padding: '20px',
    }}>
      <div style={{
        maxWidth: '450px', width: '100%', backgroundColor: '#1a1a1a', padding: '40px',
        borderRadius: '12px', boxShadow: '0 15px 50px rgba(255, 193, 7, 0.15)', border: '1px solid #ffc107',
      }}>
        <h2 style={{
          fontSize: '28px', fontWeight: 'bold', marginBottom: '6px', textAlign: 'center',
          color: '#ffc107', fontFamily: "'Playfair Display', serif",
        }}>
          ☕ Create Account
        </h2>
        <p style={{ textAlign: 'center', color: '#999', marginBottom: '28px', fontSize: '13px' }}>
          Join the Bite Bonansa loyalty program
        </p>

        {error && (
          <div style={{ backgroundColor: '#3a1a1a', color: '#f44336', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', border: '1px solid #f44336' }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{ backgroundColor: '#1a3a1a', color: '#4caf50', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', border: '1px solid #4caf50' }}>
            ✅ {success}
          </div>
        )}

        <form onSubmit={handleRegister}>
          {[
            { label: 'Full Name', name: 'name', type: 'text', placeholder: 'Juan dela Cruz' },
            { label: 'Email', name: 'email', type: 'email', placeholder: 'juan@example.com' },
            { label: 'Phone', name: 'phone', type: 'tel', placeholder: '09XXXXXXXXX' },
            { label: 'Password', name: 'password', type: 'password', placeholder: '••••••••' },
          ].map(field => (
            <div key={field.name} style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#ffc107', fontSize: '13px' }}>
                {field.label}
              </label>
              <input
                type={field.type} name={field.name} value={form[field.name]}
                onChange={handleChange} placeholder={field.placeholder} required={field.name !== 'phone'}
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#ffc107'; e.target.style.boxShadow = '0 0 8px rgba(255,193,7,0.3)'; }}
                onBlur={e => { e.target.style.borderColor = '#333'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          ))}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '14px', backgroundColor: loading ? '#555' : '#ffc107',
              color: loading ? '#999' : '#0a0a0a', border: 'none', borderRadius: '6px',
              fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Poppins', sans-serif", marginTop: '8px',
            }}
          >
            {loading ? '⏳ Creating account...' : '🚀 REGISTER'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', color: '#999', fontSize: '13px' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#ffc107', textDecoration: 'none', fontWeight: '700' }}>
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
