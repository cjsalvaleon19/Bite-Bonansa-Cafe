'use strict';

const mongoose = require('mongoose');

const JournalEntrySchema = new mongoose.Schema({
    debitAccount: {
        type: String,
        required: true,
    },
    creditAccount: {
        type: String,
        required: true,
    },
    transactionType: {
        type: String,
        enum: ['debit', 'credit'],
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('JournalEntry', JournalEntrySchema);