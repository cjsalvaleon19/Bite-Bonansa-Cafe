const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    customerDetails: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true },
    },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }
    }],
    paymentMethod: { type: String, required: true },
    deliveryInfo: {
        address: { type: String, required: true },
        deliveryDate: { type: Date, required: true }
    },
    orderStatus: { type: String, enum: ['Pending', 'Processing', 'Completed', 'Cancelled'], default: 'Pending' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

OrderSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Order', OrderSchema);