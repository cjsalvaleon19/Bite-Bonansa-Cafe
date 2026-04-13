import { calculatePointsEarned } from '../../../utils/pointsCalculator';

/**
 * POST /api/loyalty/calculate-points
 * Body: { amount: number }
 * Returns points that would be earned for the given purchase amount.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { amount } = req.body;
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    return res.status(400).json({ success: false, message: 'Valid amount is required' });
  }

  const points = calculatePointsEarned(amount);
  const rate = amount >= 500 ? '0.5%' : '0.2%';

  return res.status(200).json({ success: true, points, rate, amount });
}
