const mongoose = require('mongoose');

const encryptedDataSchema = new mongoose.Schema({
    imagePath: {
        type: String,
        required: true
    },
    isEncrypted: {
        type: Boolean,
        default: true
    },
    type: {
        type: String,
        enum: ['message', 'file'],
        required: true
    },
    originalFileName: {
        type: String,
        default: null
    },
    originalFileSize: {
        type: Number,
        default: null
    },
    originalFileType: {
        type: String,
        default: null
    }
}, { _id: false }); // Don't create separate _id for subdocument

const chatSchema = new mongoose.Schema({
    message: {
        type: String,
        default: ''
    },
    fileData: {
        type: mongoose.Schema.Types.Mixed
    },
    encryptedData: {
        type: encryptedDataSchema,  //  Use proper subdocument schema
        default: null
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