import React from 'react';
import { useRouter } from 'next/router';

export default function NotFound() {
  const router = useRouter();

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.code}>404</h1>
        <h2 style={styles.title}>☕ Resource Not Found</h2>
        <p style={styles.message}>
          The page or resource you&#39;re looking for is unavailable.
          It may have been moved, deleted, or never existed.
        </p>
        <div style={styles.actions}>
          <button style={styles.btn} onClick={() => router.push('/dashboard')}>
            Go to Dashboard
          </button>
          <button style={styles.btnSecondary} onClick={() => router.back()}>
            Go Back
          </button>
        </div>
        <p style={styles.hint}>
          If you arrived here from a link in the app, the destination page may still be under
          development. Check the dashboard for available sections.
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    fontFamily: "'Poppins', sans-serif",
    padding: '20px',
  },
  container: {
    textAlign: 'center',
    maxWidth: '480px',
  },
  code: {
    fontSize: '96px',
    fontWeight: '700',
    color: '#ffc107',
    margin: '0 0 8px',
    fontFamily: "'Playfair Display', serif",
    lineHeight: 1,
  },
  title: {
    fontSize: '24px',
    color: '#fff',
    margin: '0 0 16px',
    fontFamily: "'Playfair Display', serif",
  },
  message: {
    fontSize: '15px',
    color: '#aaa',
    lineHeight: 1.6,
    margin: '0 0 28px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  btn: {
    padding: '10px 24px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  btnSecondary: {
    padding: '10px 24px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  hint: {
    fontSize: '12px',
    color: '#666',
    lineHeight: 1.5,
  },
};
