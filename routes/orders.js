const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

router.post('/orders', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        await newOrder.save();
        res.status(201).json({ success: true, message: 'Order created successfully', order: newOrder });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating order', error: error.message });
    }
});

router.get('/orders', async (req, res) => {
    try {
        const orders = await Order.find();
        res.status(200).json({ success: true, orders });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching orders', error: error.message });
    }
});

router.get('/orders/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        res.status(200).json({ success: true, order });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching order', error: error.message });
    }
});

router.put('/orders/:id', async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({ success: true, message: 'Order updated successfully', order });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating order', error: error.message });
    }
});

router.delete('/orders/:id', async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Order deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting order', error: error.message });
    }
});

module.exports = router;