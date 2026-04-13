import React, { useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function Dashboard() {
  useEffect(() => {
    async function redirect() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }

      // Get role from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      const role = profile?.role || session.user.user_metadata?.role || 'customer';

      const routes = { admin: '/admin', cashier: '/cashier', rider: '/rider', customer: '/customer' };
      window.location.href = routes[role] || '/customer';
    }
    redirect();
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a', fontFamily: "'Poppins', sans-serif",
    }}>
      <div style={{ textAlign: 'center', color: '#ffc107' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>☕</div>
        <p style={{ fontSize: '18px', color: '#999' }}>Loading your dashboard...</p>
        <div style={{
          marginTop: '24px', width: '40px', height: '40px', borderRadius: '50%',
          border: '3px solid #333', borderTopColor: '#ffc107',
          animation: 'spin 0.8s linear infinite', margin: '24px auto 0',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
