const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
    messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'chat',
        required:false  // Optional field, only used for decryption challenges
    },
    userid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    challenge: String
});

module.exports = mongoose.model('challenge', challengeSchema);