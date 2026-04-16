import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import * as Dialog from '@radix-ui/react-dialog';
import { supabase } from '../../utils/supabaseClient';
import { getUserRole, ROLES, canAccessPage } from '../../utils/roleGuard';

// ─── Admin: Inventory Management ─────────────────────────────────────────────
// Displays inventory items and lets admins update stock status, cost, and
// pricing details.  Auth-guarded: redirects to /login if no active session.
// Role-guarded: only admins can access this page.

const STOCK_OPTIONS = ['In Stock', 'Low Stock', 'Out of Stock'];
const EMPTY_FORM = {
  item: '',
  costOfGoodsSold: '',
  contributionMargin: '',
  markup: '',
  sellingPrice: '',
  stockStatus: 'In Stock',
};

export default function InventoryPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
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
        if (!roleData || !canAccessPage(roleData.role, '/admin/inventory')) {
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

  // ── Fetch inventory ─────────────────────────────────────────────────────────
  const fetchInventory = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('id, item, costOfGoodsSold, contributionMargin, markup, sellingPrice, stockStatus')
        .order('item');
      if (!error && data) setInventory(data);
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) fetchInventory();
  }, [authLoading, fetchInventory]);

  // ── Open dialog ─────────────────────────────────────────────────────────────
  const openNew = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setSaveError('');
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditItem(row);
    setForm({
      item: row.item,
      costOfGoodsSold: String(row.costOfGoodsSold ?? ''),
      contributionMargin: String(row.contributionMargin ?? ''),
      markup: String(row.markup ?? ''),
      sellingPrice: String(row.sellingPrice ?? ''),
      stockStatus: row.stockStatus ?? 'In Stock',
    });
    setSaveError('');
    setDialogOpen(true);
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.item.trim()) { setSaveError('Item name is required.'); return; }
    const cogs = parseFloat(form.costOfGoodsSold);
    const cm = parseFloat(form.contributionMargin);
    const mu = parseFloat(form.markup);
    const sp = parseFloat(form.sellingPrice);
    if (isNaN(cogs) || cogs < 0) { setSaveError('Cost of Goods Sold must be a valid non-negative number.'); return; }
    if (isNaN(cm) || cm < 0) { setSaveError('Contribution Margin must be a valid non-negative number.'); return; }
    if (isNaN(mu) || mu < 0) { setSaveError('Markup must be a valid non-negative number.'); return; }
    if (isNaN(sp) || sp < 0) { setSaveError('Selling Price must be a valid non-negative number.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        item: form.item.trim(),
        costOfGoodsSold: cogs,
        contributionMargin: cm,
        markup: mu,
        sellingPrice: sp,
        stockStatus: form.stockStatus,
      };
      let error;
      if (editItem) {
        ({ error } = await supabase.from('inventory').update(payload).eq('id', editItem.id));
      } else {
        ({ error } = await supabase.from('inventory').insert(payload));
      }
      if (error) throw error;
      setDialogOpen(false);
      fetchInventory();
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
      await supabase.from('inventory').delete().eq('id', deleteTarget.id);
      setDeleteTarget(null);
      fetchInventory();
    } catch { /* non-fatal */ } finally {
      setDeleting(false);
    }
  };

  const stockColor = (s) =>
    s === 'In Stock' ? '#4caf50' : s === 'Low Stock' ? '#ff9800' : '#f44336';

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
        <h1 style={styles.logo}>📦 Inventory Management</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={styles.addBtn} onClick={openNew}>+ Add Item</button>
          <button style={styles.backBtn} onClick={() => router.push('/dashboard').catch(console.error)}>← Dashboard</button>
        </div>
      </header>

      <main style={styles.main}>
        {!supabase && (
          <p style={styles.notice}>
            ⚠️ Supabase is not configured. Connect your database to manage inventory.
          </p>
        )}

        {loading && <p style={{ color: '#aaa', fontSize: '14px' }}>Loading inventory…</p>}

        {!loading && inventory.length === 0 && supabase && (
          <p style={{ color: '#aaa', fontSize: '14px' }}>
            No inventory items found. Add your first item using the button above.
          </p>
        )}

        {inventory.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Item', 'COGS (₱)', 'Contribution Margin (₱)', 'Markup (%)', 'Selling Price (₱)', 'Stock Status', 'Actions'].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inventory.map((row) => (
                  <tr key={row.id} style={styles.tr}>
                    <td style={styles.td}>{row.item}</td>
                    <td style={styles.td}>₱{Number(row.costOfGoodsSold ?? 0).toFixed(2)}</td>
                    <td style={styles.td}>₱{Number(row.contributionMargin ?? 0).toFixed(2)}</td>
                    <td style={styles.td}>{Number(row.markup ?? 0).toFixed(1)}%</td>
                    <td style={styles.td}>₱{Number(row.sellingPrice ?? 0).toFixed(2)}</td>
                    <td style={styles.td}>
                      <span style={{ color: stockColor(row.stockStatus) }}>
                        {row.stockStatus}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button style={styles.editBtn} onClick={() => openEdit(row)}>Edit</button>
                      <button style={styles.deleteBtn} onClick={() => setDeleteTarget(row)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ── Add / Edit Dialog ───────────────────────────────────────────────── */}
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay style={styles.overlay} />
          <Dialog.Content style={styles.dialogContent}>
            <Dialog.Title style={styles.dialogTitle}>
              {editItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
            </Dialog.Title>
            <Dialog.Description style={styles.dialogDescription}>
              {editItem
                ? 'Update the costing and stock details for this item.'
                : 'Enter the details for a new inventory item.'}
            </Dialog.Description>

            {[
              { id: 'invItem', label: 'Item Name *', key: 'item', type: 'text', placeholder: 'e.g. Coffee Beans' },
              { id: 'invCogs', label: 'Cost of Goods Sold (₱) *', key: 'costOfGoodsSold', type: 'number', placeholder: '0.00' },
              { id: 'invCm', label: 'Contribution Margin (₱) *', key: 'contributionMargin', type: 'number', placeholder: '0.00' },
              { id: 'invMu', label: 'Markup (%) *', key: 'markup', type: 'number', placeholder: '0' },
              { id: 'invSp', label: 'Selling Price (₱) *', key: 'sellingPrice', type: 'number', placeholder: '0.00' },
            ].map(({ id, label, key, type, placeholder }) => (
              <div key={id} style={styles.field}>
                <label style={styles.fieldLabel} htmlFor={id}>{label}</label>
                <input
                  id={id}
                  style={styles.fieldInput}
                  type={type}
                  min={type === 'number' ? '0' : undefined}
                  step={type === 'number' ? '0.01' : undefined}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                />
              </div>
            ))}

            <div style={styles.field}>
              <label style={styles.fieldLabel} htmlFor="invStock">Stock Status *</label>
              <select
                id="invStock"
                style={styles.fieldInput}
                value={form.stockStatus}
                onChange={(e) => setForm({ ...form, stockStatus: e.target.value })}
              >
                {STOCK_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
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
            <Dialog.Title style={styles.dialogTitle}>Delete Inventory Item</Dialog.Title>
            <Dialog.Description style={styles.dialogDescription}>
              Are you sure you want to delete &ldquo;{deleteTarget?.item}&rdquo;? This action cannot
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
    maxWidth: '1100px',
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
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #2a2a2a',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#ccc',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
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
    maxHeight: '90vh',
    overflowY: 'auto',
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
    marginBottom: '14px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#aaa',
    marginBottom: '5px',
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
    marginTop: '4px',
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
