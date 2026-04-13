import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';

const S = {
  page: { minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Poppins', sans-serif", color: '#fff' },
  nav: {
    background: '#1a1a1a', borderBottom: '1px solid #333', padding: '0 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px',
  },
  logo: { color: '#ffc107', fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 'bold' },
  btn: (color = '#ffc107') => ({
    padding: '8px 16px', backgroundColor: color, color: color === '#ffc107' ? '#0a0a0a' : '#fff',
    border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  }),
  card: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '24px' },
};

function NavBar({ user }) {
  const logout = async () => { await supabase.auth.signOut(); window.location.href = '/login'; };
  return (
    <nav style={S.nav}>
      <span style={S.logo}>☕ Bite Bonansa — Admin</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: '#999', fontSize: '13px' }}>{user?.email}</span>
        <button onClick={logout} style={S.btn('#333')}>Logout</button>
      </div>
    </nav>
  );
}

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ menuItems: 0, rawMaterials: 0, todaySales: 0 });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return; }
      setUser(session.user);
    });

    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      fetch('/api/menu-items?includeOutOfStock=true').then(r => r.json()),
      fetch('/api/raw-materials').then(r => r.json()),
      fetch(`/api/financial-reports?type=income_statement&startDate=${today}&endDate=${today}`).then(r => r.json()),
    ]).then(([menu, raw, fin]) => {
      setStats({
        menuItems: menu.data?.length || 0,
        rawMaterials: raw.data?.length || 0,
        todaySales: fin.sales || 0,
      });
    });
  }, []);

  const navCards = [
    { href: '/admin/menu-items', icon: '🍽️', title: 'Menu Items', desc: 'Manage dishes, pricing & ingredients', color: '#ffc107' },
    { href: '/admin/raw-materials', icon: '📦', title: 'Raw Materials', desc: 'Track inventory & supplier costs', color: '#ff9800' },
    { href: '/admin/financial-reports', icon: '📊', title: 'Financial Reports', desc: 'Income statements & balance sheets', color: '#4caf50' },
    { href: '/customer', icon: '👥', title: 'Customer View', desc: 'See customer-facing portal', color: '#2196f3' },
  ];

  if (!user) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#999' }}>Loading...</p>
    </div>
  );

  return (
    <div style={S.page}>
      <NavBar user={user} />
      <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: '#ffc107', marginBottom: '8px', fontSize: '32px' }}>
          Admin Dashboard
        </h1>
        <p style={{ color: '#999', marginBottom: '32px' }}>Manage your cafe operations</p>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '36px' }}>
          {[
            { label: 'Menu Items', value: stats.menuItems, icon: '🍽️', color: '#ffc107' },
            { label: 'Raw Materials', value: stats.rawMaterials, icon: '📦', color: '#ff9800' },
            { label: "Today's Sales", value: `₱${parseFloat(stats.todaySales).toFixed(2)}`, icon: '💰', color: '#4caf50' },
          ].map(stat => (
            <div key={stat.label} style={{ ...S.card, textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>{stat.icon}</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: stat.color, marginBottom: '4px' }}>{stat.value}</div>
              <div style={{ color: '#999', fontSize: '14px' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Nav Cards */}
        <h2 style={{ color: '#fff', marginBottom: '20px', fontSize: '18px' }}>Quick Navigation</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {navCards.map(card => (
            <Link key={card.href} href={card.href} style={{ textDecoration: 'none' }}>
              <div style={{
                ...S.card, cursor: 'pointer', transition: 'all 0.2s',
                borderLeft: `4px solid ${card.color}`,
              }}
                onMouseOver={e => { e.currentTarget.style.borderColor = card.color; e.currentTarget.style.background = '#222'; }}
                onMouseOut={e => { e.currentTarget.style.background = '#1a1a1a'; }}
              >
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>{card.icon}</div>
                <div style={{ fontWeight: '700', color: card.color, marginBottom: '6px', fontSize: '16px' }}>{card.title}</div>
                <div style={{ color: '#999', fontSize: '13px' }}>{card.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
