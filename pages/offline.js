import React, { useState } from 'react';
import { useRouter } from 'next/router';

export default function Offline() {
  const router = useRouter();
  const [retryMsg, setRetryMsg] = useState('');

  function handleRetry() {
    if (!navigator.onLine) {
      setRetryMsg('Still offline — please check your connection and try again.');
      return;
    }
    setRetryMsg('');
    router.reload();
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.icon}>📵</h1>
        <h2 style={styles.title}>You&#39;re Offline</h2>
        <p style={styles.message}>
          Content unavailable — this page could not be loaded because your
          device is not connected to the internet.
        </p>
        <p style={styles.hint}>
          Check your Wi-Fi or mobile data connection, then try again.
        </p>
        <div style={styles.actions}>
          <button style={styles.btn} onClick={handleRetry}>
            🔄 Try Again
          </button>
          <button style={styles.btnSecondary} onClick={() => router.push('/').catch(console.error)}>
            Go to Home
          </button>
        </div>
        {retryMsg && (
          <p style={styles.retryMsg}>{retryMsg}</p>
        )}
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
  icon: {
    fontSize: '72px',
    margin: '0 0 8px',
    lineHeight: 1,
  },
  title: {
    fontSize: '28px',
    color: '#ffc107',
    margin: '0 0 16px',
    fontFamily: "'Playfair Display', serif",
  },
  message: {
    color: '#ccc',
    fontSize: '15px',
    lineHeight: '1.6',
    margin: '0 0 12px',
  },
  hint: {
    color: '#888',
    fontSize: '13px',
    margin: '0 0 32px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  btn: {
    padding: '12px 28px',
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
    padding: '12px 28px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  retryMsg: {
    marginTop: '16px',
    color: '#ff6b6b',
    fontSize: '13px',
  },
};
