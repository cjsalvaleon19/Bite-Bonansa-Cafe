import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useRoleGuard } from '../../utils/useRoleGuard';

// Redirect cashier to dashboard
export default function CashierIndexRedirect() {
  const router = useRouter();
  const { loading: authLoading } = useRoleGuard('cashier');

  useEffect(() => {
    if (!authLoading) {
      router.replace('/cashier/dashboard');
    }
  }, [authLoading, router]);

  return (
    <div style={styles.center}>
      <p style={{ color: '#ffc107', fontFamily: "'Poppins', sans-serif" }}>
        ⏳ Loading…
      </p>
    </div>
  );
}

const styles = {
  center: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
  },
};
