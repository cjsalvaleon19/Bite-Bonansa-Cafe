import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function NotificationBell({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Set up real-time subscription for new notifications
      const subscription = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            setNotifications(prev => [payload.new, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  async function fetchNotifications() {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    } catch (err) {
      console.error('[NotificationBell] Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (!error) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('[NotificationBell] Failed to mark as read:', err);
    }
  }

  async function markAllAsRead() {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', unreadIds);

      if (!error) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('[NotificationBell] Failed to mark all as read:', err);
    }
  }

  function getNotificationIcon(type) {
    const icons = {
      order_status: '📦',
      order_ready_pickup: '✅',
      anniversary: '🎉',
      announcement: '📢',
      new_menu_item: '🍕',
      default: '🔔'
    };
    return icons[type] || icons.default;
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <div style={styles.container} ref={dropdownRef}>
      <button 
        style={styles.bellButton}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span style={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>
            <h3 style={styles.dropdownTitle}>Notifications</h3>
            {unreadCount > 0 && (
              <button
                style={styles.markAllBtn}
                onClick={markAllAsRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={styles.notificationList}>
            {loading ? (
              <div style={styles.emptyState}>
                <p style={styles.emptyText}>Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div style={styles.emptyState}>
                <span style={styles.emptyIcon}>🔔</span>
                <p style={styles.emptyText}>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  style={{
                    ...styles.notificationItem,
                    backgroundColor: notification.is_read ? '#1a1a1a' : '#2a2a2a',
                    borderLeft: notification.is_read
                      ? '3px solid transparent'
                      : '3px solid #ffc107'
                  }}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                >
                  <div style={styles.notificationIcon}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div style={styles.notificationContent}>
                    <h4 style={styles.notificationTitle}>
                      {notification.title}
                    </h4>
                    <p style={styles.notificationMessage}>
                      {notification.message}
                    </p>
                    <span style={styles.notificationTime}>
                      {formatTime(notification.created_at)}
                    </span>
                  </div>
                  {!notification.is_read && (
                    <div style={styles.unreadDot}></div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
  },
  bellButton: {
    position: 'relative',
    padding: '8px 12px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '18px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.3s',
  },
  badge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    backgroundColor: '#f44336',
    color: '#fff',
    borderRadius: '10px',
    padding: '2px 6px',
    fontSize: '10px',
    fontWeight: 'bold',
    minWidth: '18px',
    textAlign: 'center',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '360px',
    maxHeight: '480px',
    backgroundColor: '#0f0f0f',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
  },
  dropdownHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '1px solid #2a2a2a',
  },
  dropdownTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#ffc107',
    margin: 0,
  },
  markAllBtn: {
    padding: '4px 12px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  notificationList: {
    overflowY: 'auto',
    maxHeight: '400px',
  },
  notificationItem: {
    display: 'flex',
    gap: '12px',
    padding: '12px 16px',
    borderBottom: '1px solid #2a2a2a',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    position: 'relative',
  },
  notificationIcon: {
    fontSize: '24px',
    flexShrink: 0,
  },
  notificationContent: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff',
    margin: '0 0 4px 0',
  },
  notificationMessage: {
    fontSize: '13px',
    color: '#ccc',
    margin: '0 0 4px 0',
    lineHeight: '1.4',
  },
  notificationTime: {
    fontSize: '11px',
    color: '#888',
  },
  unreadDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#ffc107',
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: '6px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '12px',
    opacity: 0.5,
  },
  emptyText: {
    fontSize: '14px',
    color: '#888',
    margin: 0,
  },
};
