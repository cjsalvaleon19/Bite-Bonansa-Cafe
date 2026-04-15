import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../utils/supabaseClient';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!supabase) {
        router.replace('/login');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      setUser(session.user);
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    router.replace('/login');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
        color: '#ffc107',
        fontFamily: "'Poppins', sans-serif",
        fontSize: '18px',
      }}>
        ⏳ Loading...
      </div>
    );
  }

  const navCards = [
    {
      icon: '🍽️',
      label: 'Browse Menu',
      href: '/customer/menu',
      desc: 'View our menu & place orders',
    },
    {
      icon: '💳',
      label: 'Cashier',
      href: '/cashier',
      desc: 'Process orders & payments',
    },
    {
      icon: '⚙️',
      label: 'Admin Panel',
      href: '/admin',
      desc: 'Manage inventory & reports',
    },
    {
      icon: '⭐',
      label: 'Reviews',
      href: '/reviews',
      desc: 'View & submit reviews',
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
      fontFamily: "'Poppins', sans-serif",
      color: '#fff',
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '40px',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#ffc107',
            fontFamily: "'Playfair Display', serif",
            margin: 0,
          }}>
            ☕ Bite Bonansa Cafe
          </h1>
          <button
            onClick={handleLogout}
            style={{
              padding: '10px 20px',
              backgroundColor: 'transparent',
              color: '#ff6b6b',
              border: '1px solid #ff6b6b',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.3s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#ff6b6b';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#ff6b6b';
            }}
          >
            🚪 Logout
          </button>
        </div>

        {/* Welcome card */}
        <div style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          padding: '30px',
          marginBottom: '30px',
          border: '1px solid #ffc107',
          boxShadow: '0 5px 20px rgba(255, 193, 7, 0.1)',
        }}>
          <h2 style={{
            fontSize: '24px',
            color: '#ffc107',
            fontFamily: "'Playfair Display', serif",
            marginTop: 0,
            marginBottom: '8px',
          }}>
            Welcome back! 👋
          </h2>
          <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>
            Signed in as: <span style={{ color: '#fff' }}>{user?.email}</span>
          </p>
        </div>

        {/* Navigation cards */}
        <h3 style={{
          color: '#ffc107',
          fontFamily: "'Playfair Display', serif",
          fontSize: '18px',
          marginBottom: '16px',
        }}>
          Quick Access
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '20px',
        }}>
          {navCards.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: 'block',
                backgroundColor: '#1a1a1a',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid #333',
                textDecoration: 'none',
                transition: 'all 0.3s',
                cursor: 'pointer',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.border = '1px solid #ffc107';
                e.currentTarget.style.boxShadow = '0 5px 20px rgba(255, 193, 7, 0.15)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.border = '1px solid #333';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>{item.icon}</div>
              <h3 style={{
                color: '#ffc107',
                fontSize: '15px',
                marginTop: 0,
                marginBottom: '8px',
                fontWeight: '700',
              }}>
                {item.label}
              </h3>
              <p style={{ color: '#999', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                {item.desc}
              </p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
