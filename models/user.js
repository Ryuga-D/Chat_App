const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/ChatApp');

const userSchema = new mongoose.Schema({
  name: String,
  username: String,
  password: String,
  email: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  passkey: {
    type: [{
      fmt: String,
      aaguid: String,
      credentialType: String,
      credential: {
        id: Buffer,          
        publicKey: Buffer,      
        counter: Number,
        transports: {
          type: [String],
          default: []
        }
      },
      attestationObject: Buffer,
      userVerified: Boolean,
      credentialDeviceType: String,
      credentialBackedUp: Boolean,
      origin: String,
      rpID: String,
      authenticatorExtensionResults: mongoose.Schema.Types.Mixed,
    }],
    default: []
  }
});

module.exports = mongoose.model('user', userSchema);
