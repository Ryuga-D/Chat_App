const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    message: {
        type: String,
        default: ''
    },
    fileData: {
        type: mongoose.Schema.Types.Mixed
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    isRead: {
        type: Boolean,
        default: false
    }
});

// Index for efficient querying ie searching by sender, receiver, and timestamp
chatSchema.index({ sender: 1, receiver: 1, timestamp: 1 });

module.exports = mongoose.model('chat', chatSchema);