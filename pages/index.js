import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
      fontFamily: "'Poppins', sans-serif",
      padding: '20px'
    }}>
      <div style={{
        textAlign: 'center',
        color: '#ffc107'
      }}>
        <h1 style={{
          fontSize: '48px',
          fontWeight: 'bold',
          marginBottom: '20px',
          fontFamily: "'Playfair Display', serif"
        }}>
          ☕ Bite Bonansa Cafe
        </h1>
        
        <p style={{
          fontSize: '18px',
          marginBottom: '40px',
          color: '#999'
        }}>
          Welcome to our coffee shop ordering system
        </p>

        <Link href="/login" style={{
          display: 'inline-block',
          padding: '14px 40px',
          backgroundColor: '#ffc107',
          color: '#0a0a0a',
          borderRadius: '6px',
          fontSize: '16px',
          fontWeight: '700',
          textDecoration: 'none',
          transition: 'all 0.3s',
          boxShadow: '0 5px 15px rgba(255, 193, 7, 0.2)'
        }}
        onMouseOver={(e) => {
          e.target.style.backgroundColor = '#ffb300';
          e.target.style.boxShadow = '0 10px 25px rgba(255, 193, 7, 0.4)';
        }}
        onMouseOut={(e) => {
          e.target.style.backgroundColor = '#ffc107';
          e.target.style.boxShadow = '0 5px 15px rgba(255, 193, 7, 0.2)';
        }}>
          🔓 Go to Login
        </Link>
      </div>
    </div>
  );
}
