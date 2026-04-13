import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../utils/supabaseClient';

const navCards = [
  { role: 'cashier', label: '🧾 Cashier POS', href: '/cashier', desc: 'Process orders, print receipts, manage delivery toggle' },
  { role: 'admin', label: '⚙️ Admin Panel', href: '/admin', desc: 'Manage menu, inventory, reports, reviews' },
  { role: 'customer', label: '🍽️ Order Online', href: '/customer/menu', desc: 'Browse menu and place orders' },
  { role: 'any', label: '⭐ Reviews', href: '/reviews', desc: 'View customer reviews' },
];

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user);
      if (!data?.user) window.location.href = '/login';
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)', fontFamily: "'Poppins', sans-serif", padding: '40px 20px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <h1 style={{ color: '#ffc107', fontFamily: "'Playfair Display', serif", fontSize: '36px', margin: 0 }}>
            ☕ Bite Bonansa Cafe
          </h1>
          <button onClick={handleLogout} style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '6px', padding: '8px 20px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
            Logout
          </button>
        </div>
        <p style={{ color: '#999', marginBottom: '32px', fontSize: '14px' }}>Logged in as: {user?.email}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {navCards.map(card => (
            <Link key={card.href} href={card.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '28px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.borderColor = '#ffc107'}
                onMouseOut={e => e.currentTarget.style.borderColor = '#333'}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>{card.label.split(' ')[0]}</div>
                <h3 style={{ color: '#ffc107', margin: '0 0 8px', fontSize: '16px' }}>{card.label.slice(card.label.indexOf(' ') + 1)}</h3>
                <p style={{ color: '#999', fontSize: '13px', margin: 0 }}>{card.desc}</p>
              </div>
            </Link>
          ))}
        </div>
        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <Link href="/overview" style={{ color: '#ffc107', fontSize: '14px' }}>📊 System Overview</Link>
        </div>
      </div>
    </div>
  );
}
