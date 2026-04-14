// pages/api/customers.js

import { customers } from '../../data/customers'; // Importing customer data

/**
 * Handles customer lookup by Customer ID.
 * @param {string} customerId - The Customer ID to look up (format: BBC-XXXXX)
 * @returns {Object|null} - Returns customer object if found, null otherwise.
 */
export default function handler(req, res) {
    const { customerId } = req.query;
    
    if (!customerId || !/^BBC-\d{5}$/.test(customerId)) {
        res.status(400).json({ error: 'Invalid Customer ID format. Use BBC-XXXXX.' });
        return;
    }

    const customer = customers.find(c => c.id === customerId);
    
    if (customer) {
        res.status(200).json(customer);
    } else {
        res.status(404).json({ error: 'Customer not found.' });
    }
} 
