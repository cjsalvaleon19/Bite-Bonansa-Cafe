import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import * as Dialog from '@radix-ui/react-dialog';
import { supabase } from '../../utils/supabaseClient';
import { getUserRole, ROLES, canAccessPage } from '../../utils/roleGuard';

// ─── Admin: Menu Management ───────────────────────────────────────────────────
// Lists all menu items and lets admins add, edit, and toggle availability.
// Auth-guarded: redirects to /login if no active session.
// Role-guarded: only admins can access this page.

const EMPTY_FORM = { name: '', category: '', price: '', available: true };

export default function MenuPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null); // null = new item
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── Auth & Role guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      if (!supabase) {
        if (mounted) { setAuthLoading(false); router.replace('/login'); }
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (!session) { router.replace('/login'); return; }
        
        // Check user role
        const roleData = await getUserRole();
        if (!roleData || !canAccessPage(roleData.role, '/admin/menu')) {
          // User doesn't have permission, redirect to their default page
          if (roleData?.role === ROLES.CUSTOMER) {
            router.replace('/customer/menu');
          } else if (roleData?.role === ROLES.CASHIER) {
            router.replace('/cashier');
          } else if (roleData?.role === ROLES.RIDER) {
            router.replace('/rider/deliveries');
          } else {
            router.replace('/dashboard');
          }
          return;
        }
        
        setAuthLoading(false);
      } catch {
        if (mounted) { setAuthLoading(false); router.replace('/login'); }
      }
    }
    checkSession();
    return () => { mounted = false; };
  }, [router]);

  // ── Fetch menu items ────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, category, price, available')
        .order('category');
      if (!error && data) setItems(data);
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) fetchItems();
  }, [authLoading, fetchItems]);

  // ── Open dialog ─────────────────────────────────────────────────────────────
  const openNew = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setSaveError('');
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.name,
      category: item.category ?? '',
      price: String(item.price),
      available: item.available,
    });
    setSaveError('');
    setDialogOpen(true);
  };

  // ── Save (create or update) ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { setSaveError('Name is required.'); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { setSaveError('Price must be a valid number.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        price,
        available: form.available,
      };
      let error;
      if (editItem) {
        ({ error } = await supabase.from('menu_items').update(payload).eq('id', editItem.id));
      } else {
        ({ error } = await supabase.from('menu_items').insert(payload));
      }
      if (error) throw error;
      setDialogOpen(false);
      fetchItems();
    } catch (err) {
      setSaveError(err?.message ?? 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await supabase.from('menu_items').delete().eq('id', deleteTarget.id);
      setDeleteTarget(null);
      fetchItems();
    } catch { /* non-fatal */ } finally {
      setDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ffc107', fontFamily: "'Poppins', sans-serif" }}>⏳ Loading…</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={styles.header}>
        <h1 style={styles.logo}>🍽️ Menu Management</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={styles.addBtn} onClick={openNew}>+ Add Item</button>
          <button style={styles.backBtn} onClick={() => router.push('/dashboard').catch(console.error)}>← Dashboard</button>
        </div>
      </header>

      <main style={styles.main}>
        {!supabase && (
          <p style={styles.notice}>
            ⚠️ Supabase is not configured. Connect your database to manage menu items.
          </p>
        )}

        {loading && <p style={{ color: '#aaa', fontSize: '14px' }}>Loading menu…</p>}

        {!loading && items.length === 0 && supabase && (
          <p style={{ color: '#aaa', fontSize: '14px' }}>
            No menu items found. Add your first item using the button above.
          </p>
        )}

        {items.length > 0 && (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Name', 'Category', 'Price (₱)', 'Available', 'Actions'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={styles.tr}>
                  <td style={styles.td}>{item.name}</td>
                  <td style={styles.td}>{item.category ?? '—'}</td>
                  <td style={styles.td}>₱{Number(item.price).toFixed(2)}</td>
                  <td style={styles.td}>
                    <span style={{ color: item.available ? '#4caf50' : '#f44336' }}>
                      {item.available ? '✅ Yes' : '❌ No'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button style={styles.editBtn} onClick={() => openEdit(item)}>Edit</button>
                    <button style={styles.deleteBtn} onClick={() => setDeleteTarget(item)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      {/* ── Add / Edit Dialog ───────────────────────────────────────────────── */}
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay style={styles.overlay} />
          <Dialog.Content style={styles.dialogContent}>
            <Dialog.Title style={styles.dialogTitle}>
              {editItem ? 'Edit Menu Item' : 'Add Menu Item'}
            </Dialog.Title>
            <Dialog.Description style={styles.dialogDescription}>
              {editItem
                ? 'Update the details for this menu item.'
                : 'Fill in the details to add a new item to the menu.'}
            </Dialog.Description>

            <div style={styles.field}>
              <label style={styles.fieldLabel} htmlFor="itemName">Name *</label>
              <input
                id="itemName"
                style={styles.fieldInput}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Caramel Macchiato"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.fieldLabel} htmlFor="itemCategory">Category</label>
              <input
                id="itemCategory"
                style={styles.fieldInput}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Coffee, Pastry"
              />
            </div>
            <div style={styles.field}>
              <label style={styles.fieldLabel} htmlFor="itemPrice">Price (₱) *</label>
              <input
                id="itemPrice"
                style={styles.fieldInput}
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <input
                id="itemAvailable"
                type="checkbox"
                checked={form.available}
                onChange={(e) => setForm({ ...form, available: e.target.checked })}
              />
              <label htmlFor="itemAvailable" style={{ color: '#ccc', fontSize: '14px' }}>
                Available for ordering
              </label>
            </div>

            {saveError && <p style={styles.errorMsg}>{saveError}</p>}

            <div style={styles.dialogActions}>
              <Dialog.Close asChild>
                <button style={styles.cancelBtn}>Cancel</button>
              </Dialog.Close>
              <button style={styles.confirmBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ── Delete Confirm Dialog ───────────────────────────────────────────── */}
      <Dialog.Root open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <Dialog.Portal>
          <Dialog.Overlay style={styles.overlay} />
          <Dialog.Content style={styles.dialogContent}>
            <Dialog.Title style={styles.dialogTitle}>Delete Menu Item</Dialog.Title>
            <Dialog.Description style={styles.dialogDescription}>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This action cannot
              be undone.
            </Dialog.Description>
            <div style={styles.dialogActions}>
              <Dialog.Close asChild>
                <button style={styles.cancelBtn}>Cancel</button>
              </Dialog.Close>
              <button
                style={{ ...styles.confirmBtn, backgroundColor: '#f44336' }}
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    fontFamily: "'Poppins', sans-serif",
    color: '#fff',
  },
  center: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    backgroundColor: '#1a1a1a',
    borderBottom: '1px solid #ffc107',
  },
  logo: {
    fontSize: '22px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
  },
  addBtn: {
    padding: '8px 18px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  backBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  main: {
    padding: '32px',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  notice: {
    color: '#ffb300',
    fontSize: '13px',
    marginBottom: '24px',
    backgroundColor: 'rgba(255,193,7,0.1)',
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid rgba(255,193,7,0.3)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    borderBottom: '2px solid #ffc107',
    color: '#ffc107',
    fontSize: '13px',
    fontWeight: '600',
  },
  tr: {
    borderBottom: '1px solid #2a2a2a',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#ccc',
    verticalAlign: 'middle',
  },
  editBtn: {
    padding: '5px 12px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    marginRight: '6px',
    fontFamily: "'Poppins', sans-serif",
  },
  deleteBtn: {
    padding: '5px 12px',
    backgroundColor: 'transparent',
    color: '#f44336',
    border: '1px solid #f44336',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 100,
  },
  dialogContent: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '32px',
    minWidth: '360px',
    maxWidth: '480px',
    width: '90%',
    zIndex: 101,
    boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
  },
  dialogTitle: {
    fontSize: '20px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginTop: 0,
    marginBottom: '8px',
  },
  dialogDescription: {
    color: '#ccc',
    fontSize: '14px',
    marginBottom: '20px',
  },
  field: {
    marginBottom: '16px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#aaa',
    marginBottom: '6px',
  },
  fieldInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #444',
    borderRadius: '6px',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  errorMsg: {
    color: '#f44336',
    fontSize: '13px',
    marginBottom: '12px',
  },
  dialogActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  cancelBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    color: '#ccc',
    border: '1px solid #555',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  confirmBtn: {
    padding: '8px 18px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
};
