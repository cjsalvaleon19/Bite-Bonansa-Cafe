import { supabase } from '../../utils/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { type, start_date, end_date } = req.query;

    if (type === 'income_statement') {
      // Sales Revenue
      const { data: sales } = await supabase.from('financial_transactions')
        .select('amount')
        .eq('type', 'sale')
        .gte('transaction_date', start_date)
        .lte('transaction_date', end_date);
      const salesRevenue = sales?.reduce((s, t) => s + Number(t.amount), 0) || 0;

      // COGS
      const { data: cogs } = await supabase.from('financial_transactions')
        .select('amount')
        .eq('type', 'cogs')
        .gte('transaction_date', start_date)
        .lte('transaction_date', end_date);
      const cogsTotal = cogs?.reduce((s, t) => s + Number(t.amount), 0) || 0;

      // Operating Expenses (labor + overhead)
      const { data: expenses } = await supabase.from('financial_transactions')
        .select('amount,type,category')
        .in('type', ['labor', 'overhead', 'expense'])
        .gte('transaction_date', start_date)
        .lte('transaction_date', end_date);
      const operatingExpenses = expenses?.reduce((s, t) => s + Number(t.amount), 0) || 0;

      const grossProfit = salesRevenue - cogsTotal;
      const netIncome = grossProfit - operatingExpenses;

      return res.status(200).json({
        period: { start_date, end_date },
        sales_revenue: salesRevenue,
        cogs: cogsTotal,
        gross_profit: grossProfit,
        operating_expenses: operatingExpenses,
        net_income: netIncome
      });
    }

    if (type === 'balance_sheet') {
      const { data: inventory } = await supabase.from('raw_materials').select('quantity_on_hand,cost_per_unit');
      const inventoryValue = inventory?.reduce((s, m) => s + (Number(m.quantity_on_hand) * Number(m.cost_per_unit)), 0) || 0;

      // Cash: sum of completed sales
      const { data: cashData } = await supabase.from('financial_transactions')
        .select('amount').eq('type', 'sale').lte('transaction_date', end_date);
      const cashAssets = cashData?.reduce((s, t) => s + Number(t.amount), 0) || 0;

      return res.status(200).json({
        as_of: end_date,
        assets: {
          cash: cashAssets,
          inventory: inventoryValue,
          total_assets: cashAssets + inventoryValue
        },
        liabilities: { accounts_payable: 0 },
        equity: {
          retained_earnings: cashAssets - inventoryValue,
          total_equity: cashAssets - inventoryValue
        }
      });
    }

    // Sales by day for chart
    if (type === 'daily_sales') {
      const { data } = await supabase.from('financial_transactions')
        .select('amount,transaction_date')
        .eq('type', 'sale')
        .gte('transaction_date', start_date)
        .lte('transaction_date', end_date)
        .order('transaction_date');
      return res.status(200).json(data || []);
    }

    return res.status(400).json({ error: 'Invalid report type' });
  }
  res.status(405).end();
}
