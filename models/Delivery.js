const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
    riderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Rider',
        required: true
    },
    customerAddress: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zip: { type: String, required: true }
    },
    deliveryStatus: {
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    billingInformation: {
        totalAmount: { type: Number, required: true },
        paymentMethod: { type: String, required: true }
    },
},{
    timestamps: true
});

module.exports = mongoose.model('Delivery', deliverySchema);