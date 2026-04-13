import React from 'react';
import Link from 'next/link';

const sections = [
  { href: '/admin/menu', label: '🍽️ Menu Management', desc: 'Add, edit, delete menu items with costing calculator' },
  { href: '/admin/inventory', label: '📦 Raw Materials', desc: 'Track inventory, costs, average cost method' },
  { href: '/admin/reports', label: '📊 Financial Reports', desc: 'Income Statement, Balance Sheet, custom date range' },
  { href: '/admin/reviews', label: '⭐ Review Moderation', desc: 'Approve, reject, hide customer reviews' },
  { href: '/admin/customers', label: '👥 Customers', desc: 'Loyalty points, customer management' },
  { href: '/admin/departments', label: '🏪 Departments', desc: 'Manage kitchen departments' },
];

export default function AdminDashboard() {
  const card = { background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '28px', cursor: 'pointer', transition: 'border-color 0.2s', textDecoration: 'none', display: 'block' };
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Poppins', sans-serif", padding: '40px 20px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: '#ffc107', fontFamily: "'Playfair Display', serif", fontSize: '32px', margin: 0 }}>⚙️ Admin Panel</h1>
          <Link href="/dashboard" style={{ color: '#999', fontSize: '14px', textDecoration: 'none' }}>← Dashboard</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {sections.map(s => (
            <Link key={s.href} href={s.href} style={card}
              onMouseOver={e => e.currentTarget.style.borderColor = '#ffc107'}
              onMouseOut={e => e.currentTarget.style.borderColor = '#333'}>
              <h3 style={{ color: '#ffc107', margin: '0 0 8px', fontSize: '16px' }}>{s.label}</h3>
              <p style={{ color: '#999', fontSize: '13px', margin: 0 }}>{s.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
