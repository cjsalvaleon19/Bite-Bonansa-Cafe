const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    item: {
        type: String,
        required: true
    },
    costOfGoodsSold: {
        type: Number,
        required: true
    },
    contributionMargin: {
        type: Number,
        required: true
    },
    markup: {
        type: Number,
        required: true
    },
    sellingPrice: {
        type: Number,
        required: true
    },
    stockStatus: {
        type: String,
        enum: ['In Stock', 'Out of Stock', 'Pre-Order'],
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', inventorySchema);