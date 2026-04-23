# Secure Chat App

A highly secure, real-time web-based chat application that leverages modern cryptographic techniques, steganography, and WebAuthn for robust security. 

## Features

- **Real-Time Messaging**: Instant communication with online status and missed message notifications, powered by Socket.IO.
- **File Sharing**: Support for uploading and sharing files natively within the chat.
- **Authentication**: Secure user login using **WebAuthn / Passkeys** (e.g., fingerprint, Face ID) along with traditional passwords.
- **Advanced End-to-End Encryption**:
  - Uses **Shamir's Secret Sharing** and **AES-256** to encrypt messages and files.
  - Generates encryption keys based on the unique biometric fingerprints of both the sender and receiver.
- **Steganography**: Encrypted data is not just transmitted; it is invisibly embedded within random cover images before sending, hiding the fact that secure communication is even taking place!

## Tech Stack

- **Backend**: Node.js, Express.js, Socket.IO
- **Database**: MongoDB (via Mongoose)
- **Authentication**: @simplewebauthn (Server & Browser)
- **Encryption Engine**: Python 3, PyCryptodome, NumPy, Pillow (PIL)

## Installation & Setup

1. **Clone the repository** (if not already cloned)
2. **Install Node dependencies**:
   ```bash
   npm install
   ```
3. **Install Python dependencies** (required for the encryption engine):
   ```bash
   pip install pycryptodome Pillow numpy
   ```
4. **Environment Variables**:
   Create a `.env` file in the root directory and add necessary variables (e.g., `MONGO_URI`, `PORT`, etc.)
5. **Run the Application**:
   ```bash
   npm start
   ```

## How Encryption Works

1. When a user sends a message, a Python script (`Encrypt_Decrypt.py`) is invoked.
2. The user's biometric passkey identifier is hashed.
3. The message is encrypted via AES-256 using a combined key generated via Shamir's Secret Sharing.
4. The ciphertext is injected into a randomly generated PNG image using Least Significant Bit (LSB) steganography.
5. The receiver's client solves a decryption challenge to extract and decrypt the secret from the image.
