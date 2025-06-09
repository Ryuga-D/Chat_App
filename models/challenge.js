const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
    userid:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    challenge: String
});

module.exports = mongoose.model('challenge', challengeSchema);