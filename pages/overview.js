import React from 'react';
import Link from 'next/link';

const bg = '#0a0a0a', card = '#1a1a1a', accent = '#ffc107', text = '#fff', muted = '#999';

const modules = [
  {
    title: '🧾 Cashier POS',
    color: '#ffc107',
    href: '/cashier',
    features: [
      'Process dine-in, pickup, delivery orders',
      'Customer ID lookup & loyalty points',
      'Cash + GCash + Points hybrid payment',
      'Delivery toggle (enable/disable)',
      'Mark items out of stock',
      'Print customer & kitchen receipts',
      'Department-based kitchen routing'
    ]
  },
  {
    title: '⭐ Loyalty Points',
    color: '#4ade80',
    href: '/admin/customers',
    features: [
      'Auto-generated Customer IDs (BBC-XXXXX)',
      '₱0-499: earn 0.2% in points',
      '₱500+: earn 0.5% in points',
      '1 point = ₱1 redemption value',
      'Points balance tracking',
      'Transaction history',
      'Hybrid payment with points'
    ]
  },
  {
    title: '🍽️ Menu Management',
    color: '#60a5fa',
    href: '/admin/menu',
    features: [
      'Add/edit/delete menu items',
      'Assign to kitchen department (1 per item)',
      'Costing calculator (materials, labor, overhead)',
      'Auto-calculate contribution margin',
      'Auto-calculate mark-up %',
      'Suggested selling price by target margin',
      'Item availability toggle'
    ]
  },
  {
    title: '📦 Raw Materials',
    color: '#f97316',
    href: '/admin/inventory',
    features: [
      'Track quantity on hand per material',
      'Cost per unit with average cost method',
      'Restock with automatic average cost calc',
      'Low stock alerts & reorder points',
      'Supplier information',
      'Cost history tracking',
      'Units: grams, ml, pcs, liters, hours, etc.'
    ]
  },
  {
    title: '📊 Financial Reports',
    color: '#a78bfa',
    href: '/admin/reports',
    features: [
      'Income Statement (customizable date range)',
      'Sales Revenue, COGS, Gross Profit',
      'Operating Expenses, Net Income',
      'Balance Sheet (as-of date)',
      'Assets: Cash + Inventory at average cost',
      'Daily sales chart',
      'Period presets: Today, Week, Month, Year',
      'Print / Export to PDF'
    ]
  },
  {
    title: '⭐ Review System',
    color: '#fb923c',
    href: '/reviews',
    features: [
      'QR code on every receipt',
      'Review form via QR scan',
      'Pre-filled receipt number & name',
      '1-5 star rating + written review',
      '"Would recommend" option',
      'Admin moderation: approve/reject/hide',
      'Public reviews (approved only)',
      'Privacy: address/TIN/business NOT shown'
    ]
  },
  {
    title: '🏪 Kitchen System',
    color: '#34d399',
    href: '/admin/departments',
    features: [
      'Departments: Fryer 1, Fryer 2, Drinks, Pastries',
      'Each item assigned to ONE department',
      'Separate thermal receipts per department',
      'Kitchen receipt: items + qty + instructions',
      'NO price/customer info on kitchen receipt',
      'Timestamp on each kitchen ticket',
      'Extensible (add new departments)'
    ]
  },
  {
    title: '🛵 Delivery Control',
    color: '#f472b6',
    href: '/cashier',
    features: [
      'Cashier toggle: enable/disable delivery',
      'Real-time sync to online platform',
      'Delivery option hidden when disabled',
      'Online customers cannot select delivery',
      'Useful when no available riders'
    ]
  }
];

function ModuleCard({ module }) {
  return (
    <div style={{ background: card, border: `1px solid ${module.color}33`, borderRadius: '12px', padding: '24px', borderTop: `3px solid ${module.color}` }}>
      <Link href={module.href} style={{ textDecoration: 'none' }}>
        <h3 style={{ color: module.color, margin: '0 0 14px', fontSize: '16px' }}>{module.title}</h3>
      </Link>
      <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'none' }}>
        {module.features.map((f, i) => (
          <li key={i} style={{ color: '#ccc', fontSize: '12px', marginBottom: '5px', position: 'relative' }}>
            <span style={{ color: module.color, position: 'absolute', left: '-14px' }}>•</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SystemOverview() {
  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Poppins', sans-serif", padding: '40px 20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{ color: accent, fontFamily: "'Playfair Display', serif", fontSize: '40px', margin: '0 0 12px' }}>
            ☕ Bite Bonansa Cafe
          </h1>
          <h2 style={{ color: text, fontSize: '20px', fontWeight: '400', margin: '0 0 8px' }}>
            POS + Accounting System Overview
          </h2>
          <p style={{ color: muted, fontSize: '14px', margin: 0 }}>
            Complete system architecture — click any module to navigate
          </p>
        </div>

        {/* Central flow diagram */}
        <div style={{ background: card, border: '1px solid #333', borderRadius: '16px', padding: '28px', marginBottom: '40px', textAlign: 'center' }}>
          <h3 style={{ color: text, marginTop: 0, marginBottom: '20px', fontSize: '16px' }}>System Data Flow</h3>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '13px' }}>
            {[
              { label: '👤 Customer', color: '#4ade80' },
              { arrow: '→' },
              { label: '🧾 Order', color: accent },
              { arrow: '→' },
              { label: '🍳 Kitchen', color: '#f97316' },
              { arrow: '→' },
              { label: '📄 Receipt', color: '#60a5fa' },
              { arrow: '→' },
              { label: '⭐ Review', color: '#fb923c' },
              { arrow: '→' },
              { label: '📊 Reports', color: '#a78bfa' },
            ].map((item, i) => (
              item.arrow ? <span key={i} style={{ color: '#555', fontSize: '20px' }}>{item.arrow}</span>
              : <span key={i} style={{ background: `${item.color}22`, border: `1px solid ${item.color}55`, borderRadius: '8px', padding: '8px 14px', color: item.color, fontWeight: '600' }}>{item.label}</span>
            ))}
          </div>
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { label: '📦 Inventory → COGS → Income Statement', color: '#f97316' },
              { label: '⭐ Points → Payment → Balance Update', color: '#4ade80' },
              { label: '🏪 Department → Kitchen Receipt Routing', color: '#34d399' },
            ].map((item, i) => (
              <span key={i} style={{ color: item.color, fontSize: '12px' }}>• {item.label}</span>
            ))}
          </div>
        </div>

        {/* Module Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          {modules.map((m, i) => <ModuleCard key={i} module={m} />)}
        </div>

        {/* Database Schema Summary */}
        <div style={{ background: card, border: '1px solid #333', borderRadius: '12px', padding: '28px', marginBottom: '32px' }}>
          <h3 style={{ color: accent, marginTop: 0 }}>🗄️ Database Tables</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {[
              { group: 'Menu & Products', tables: ['menu_items', 'menu_item_ingredients', 'menu_item_labor', 'menu_item_overhead', 'kitchen_departments'] },
              { group: 'Inventory', tables: ['raw_materials', 'raw_material_cost_history', 'delivery_settings'] },
              { group: 'Customers & Loyalty', tables: ['customers', 'points_transactions'] },
              { group: 'Orders & Receipts', tables: ['orders', 'order_items', 'receipt_customer_details', 'financial_transactions'] },
              { group: 'Reviews', tables: ['customer_reviews', 'review_helpful_votes'] },
            ].map(g => (
              <div key={g.group}>
                <div style={{ color: accent, fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>{g.group}</div>
                {g.tables.map(t => (
                  <div key={t} style={{ color: muted, fontSize: '12px', fontFamily: 'monospace', marginBottom: '3px' }}>• {t}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { href: '/dashboard', label: '🏠 Dashboard' },
            { href: '/cashier', label: '🧾 Cashier POS' },
            { href: '/admin', label: '⚙️ Admin Panel' },
            { href: '/customer/menu', label: '🍽️ Online Menu' },
            { href: '/reviews', label: '⭐ Reviews' },
          ].map(link => (
            <Link key={link.href} href={link.href} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '10px 20px', color: accent, textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}
              onMouseOver={e => e.currentTarget.style.borderColor = accent}
              onMouseOut={e => e.currentTarget.style.borderColor = '#333'}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
