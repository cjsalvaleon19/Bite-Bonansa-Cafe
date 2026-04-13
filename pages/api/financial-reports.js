import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { type = 'income_statement', startDate, endDate } = req.query;
  const start = startDate || new Date().toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  if (type === 'income_statement') {
    const { data: transactions, error } = await supabase
      .from('financial_transactions')
      .select('*')
      .gte('date', start)
      .lte('date', end);

    if (error) return res.status(500).json({ error: error.message });

    const sales = transactions.filter(t => t.type === 'sale').reduce((s, t) => s + parseFloat(t.amount), 0);
    const cogs = transactions.filter(t => t.type === 'cogs').reduce((s, t) => s + parseFloat(t.amount), 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
    const grossProfit = sales - cogs;
    const netIncome = grossProfit - expenses;

    // Department breakdown from orders + order_items
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total_amount, created_at, order_items(department, unit_price, quantity)')
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59');

    const deptBreakdown = {};
    (orders || []).forEach(o => {
      (o.order_items || []).forEach(item => {
        const dept = item.department || 'Other';
        if (!deptBreakdown[dept]) deptBreakdown[dept] = 0;
        deptBreakdown[dept] += parseFloat(item.unit_price) * parseInt(item.quantity);
      });
    });

    return res.status(200).json({
      type: 'income_statement',
      period: { start, end },
      sales: parseFloat(sales.toFixed(2)),
      cogs: parseFloat(cogs.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      operatingExpenses: parseFloat(expenses.toFixed(2)),
      netIncome: parseFloat(netIncome.toFixed(2)),
      departmentBreakdown: deptBreakdown,
    });
  }

  if (type === 'balance_sheet') {
    // Cash from sales in period
    const { data: saleTxns } = await supabase
      .from('financial_transactions')
      .select('amount')
      .eq('type', 'sale')
      .gte('date', start)
      .lte('date', end);

    const cashFromSales = (saleTxns || []).reduce((s, t) => s + parseFloat(t.amount), 0);

    // Inventory value: raw materials * cost_per_unit
    const { data: rawMaterials } = await supabase
      .from('raw_materials')
      .select('quantity_on_hand, cost_per_unit');

    const inventoryValue = (rawMaterials || []).reduce(
      (s, r) => s + parseFloat(r.quantity_on_hand) * parseFloat(r.cost_per_unit), 0
    );

    const totalAssets = cashFromSales + inventoryValue;

    return res.status(200).json({
      type: 'balance_sheet',
      period: { start, end },
      assets: {
        cash: parseFloat(cashFromSales.toFixed(2)),
        inventory: parseFloat(inventoryValue.toFixed(2)),
        total: parseFloat(totalAssets.toFixed(2)),
      },
      liabilities: { total: 0, notes: 'Liabilities not yet tracked' },
      equity: { total: parseFloat(totalAssets.toFixed(2)), notes: 'Equity = Total Assets - Liabilities' },
    });
  }

  return res.status(400).json({ error: 'Invalid type. Use income_statement or balance_sheet' });
}
