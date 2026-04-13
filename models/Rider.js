const mongoose = require('mongoose');

const riderSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    deliveriesCompleted: {
        type: Number,
        default: 0
    },
    totalEarnings: {
        type: Number,
        default: 0
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    currentLocation: {
        type: { type: String, enum: ['Point'], required: true },
        coordinates: { type: [Number], required: true }
    }
}, { timestamps: true });

module.exports = mongoose.model('Rider', riderSchema);