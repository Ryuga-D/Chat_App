const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const path = require('path');
const fs = require('fs');
const usermodel = require('./models/user');
const chatmodel = require('./models/chat');
const challengeModel = require('./models/challenge');
const crypto = require('crypto');
const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createCanvas } = require('canvas');
const { spawn } = require('child_process');
require('dotenv').config();
const { Server } = require('socket.io');

// Update your server configuration
server.timeout = 600000; // 10 minutes
server.keepAliveTimeout = 650000; // Slightly longer than timeout
server.headersTimeout = 660000; // Slightly longer than keepAliveTimeout

// Ensure crypto is available globally for WebAuthn
if (!globalThis.crypto) {
    globalThis.crypto = crypto;
}
// Increase JSON payload limits to 1GB
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));
// Set view engine and static files directory
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());


// Adding the hashFingerprint function
function hashFingerprint(fingerprintHex) {
    return crypto.createHash('sha256').update(fingerprintHex, 'hex').digest('hex');
}

// Configure multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './public/uploads';
        // Ensure directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        crypto.randomBytes(16, (err, buffer) => {
            if (err) {
                return cb(err);
            }
            // Create a unique filename using the original name and a random prefix
            const uniqueName = `${buffer.toString('hex')}-${Date.now()}-${file.originalname}`;
            // Ensure the filename is safe for use
            cb(null, uniqueName);
        });
    }
});

// 
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 1024, // 1GB limit per file
        fieldSize: 1024 * 1024 * 1024 // 1GB field size limit 
    }
});

// Function to create a random image and return it
async function createRandomImage(width = 1024, height = 1024) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Create image data
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Fill with random colors
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.floor(Math.random() * 256);     // Red
        data[i + 1] = Math.floor(Math.random() * 256); // Green
        data[i + 2] = Math.floor(Math.random() * 256); // Blue
        data[i + 3] = 255;                             // Alpha (fully opaque)
    }

    // Put the image data on canvas
    ctx.putImageData(imageData, 0, 0);

    return canvas;
}

// Helper function to execute Python script
function executePython(command, data, timeout = 600000) {
    return new Promise((resolve, reject) => {
        const python = spawn('python', ['Encrypt_Decrypt.py', command, JSON.stringify(data)]);

        let result = '';
        let error = '';

        // Set timeout
        const timer = setTimeout(() => {
            python.kill();
            reject(new Error('Python script timeout'));
        }, timeout);

        python.stdout.on('data', (data) => {
            result += data.toString();
        });

        python.stderr.on('data', (data) => {
            error += data.toString();
        });

        python.on('close', (code) => {
            clearTimeout(timer);

            if (code !== 0) {
                reject(new Error(error || `Python script exited with code ${code}`));
            } else {
                try {
                    const parsedResult = JSON.parse(result.trim());
                    if (parsedResult.error) {
                        reject(new Error(parsedResult.error));
                    } else {
                        resolve(parsedResult);
                    }
                } catch (e) {
                    reject(new Error('Failed to parse Python output: ' + result));
                }
            }
        });

        python.on('error', (err) => {
            clearTimeout(timer);
            reject(new Error('Failed to start Python process: ' + err.message));
        });
    });
}

// Initialize Socket.IO with increased limits
const io = new Server(server, {
    maxHttpBufferSize: 1 * 1024 * 1024 * 1024, // 1GB
    pingTimeout: 300000, // 5 minutes
    pingInterval: 25000,
    cors: {
        origin: process.env.NODE_ENV === 'production' ? false : ["http://localhost:3000"],
        methods: ["GET", "POST"]
    }
});

const connectedUsers = {}; // userID maps to socketID
const socketToUser = {}; // socketID maps to userID
const activeTransfers = {}; // Added this for file transfer tracking

// Handle chat messages
io.on('connection', (socket) => {
    const host = socket.handshake.headers.host;
    let origin;

    if (host && host.includes('.loca.lt')) {
        // Force HTTPS for localtunnel
        origin = `https://${host}`;
    } else if (host && host.includes('localhost')) {
        // Use HTTP for localhost
        origin = `http://${host}`;
    } else {
        // Default behavior
        origin = socket.handshake.headers.origin ||
            `${socket.handshake.secure ? 'https' : 'http'}://${host}`;
    }

    const rpID = origin.includes('localhost') ? 'localhost' : new URL(origin).hostname;

    socket.origin = origin;
    socket.rpID = rpID;

    console.log(`Socket connected - Origin: ${origin}, RP ID: ${rpID}`);

    // Log the connection
    socket.on('join', async (userId) => {
        connectedUsers[userId] = socket.id;
        socketToUser[socket.id] = userId;
        console.log(`User ${userId} joined with socket ${socket.id}`);

        // Send missed messages (unread messages sent while offline)
        try {
            const missedMessages = await chatmodel.find({
                receiver: userId,
                isRead: false
            }).sort({ timestamp: 1 }).populate('sender receiver', 'username name');

            if (missedMessages.length > 0) {
                // Group messages by sender and count them
                const senderGroups = {};

                missedMessages.forEach(msg => {
                    const senderId = msg.sender._id.toString();

                    if (!senderGroups[senderId]) {
                        senderGroups[senderId] = {
                            sender: msg.sender,
                            messageCount: 0,
                        };
                    }
                    senderGroups[senderId].messageCount++;
                });

                // Send one notification per unique sender
                Object.values(senderGroups).forEach(group => {
                    socket.emit('missedMessages', {
                        sender: group.sender.username,
                        n_sender: group.sender.name,
                        messageCount: group.messageCount,
                    });
                });
            }
        } catch (error) {
            console.error('Error fetching missed messages:', error);
        }

        // Notify all other users that this user is now online
        socket.broadcast.emit('userOnline', userId);
    });
    socket.on('markMessagesAsRead', async (data) => {
        try {
            const { senderId, receiverId } = data;

            await chatmodel.updateMany({
                sender: senderId,
                receiver: receiverId,
                isRead: false
            }, {
                isRead: true
            });

            console.log(`Marked messages as read between ${senderId} and ${receiverId}`);
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    });

    // Handle status check requests
    socket.on('checkUserStatus', (userId) => {
        const isOnline = connectedUsers[userId] ? true : false;
        socket.emit('userStatusResponse', { userId, isOnline });
    });
    // Handle file upload events
    socket.on('fileUploadStart', (data) => {
        try {
            const { fileId, senderId, receiverId, fileName, fileSize } = data;

            if (!fileId || !senderId || !receiverId) {
                socket.emit('messageError', { error: 'Invalid file upload data' });
                return;
            }

            activeTransfers[fileId] = {
                senderId,
                receiverId,
                fileName,
                fileSize,
                startTime: Date.now()
            };

            // Notify receiver that file upload started if they are online
            const receiverSocketId = connectedUsers[receiverId];
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('fileUploadStarted', {
                    fileId,
                    fileName,
                    fileSize,
                    sender: { _id: senderId }
                });
            }
        }
        catch (error) {
            console.error('Error in fileUploadStart:', error);
            socket.emit('messageError', { error: 'Failed to start file upload' });
        }
    });
    socket.on('fileUploadProgress', (data) => {
        try {
            const { fileId, progress } = data;
            const transfer = activeTransfers[fileId];

            if (transfer) {
                // Forward progress to receiver
                const receiverSocketId = connectedUsers[transfer.receiverId];
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('fileUploadProgress', {
                        fileId,
                        progress,
                        fileName: transfer.fileName,
                        sender: { _id: transfer.senderId }
                    });
                }
            }
        }
        catch (error) {
            console.error('Error in fileUploadProgress:', error);
        }
    });
    socket.on('fileUploadComplete', async (data) => {
        try {
            const { fileId, fileData, message } = data;
            const transfer = activeTransfers[fileId];

            if (!transfer) {
                socket.emit('messageError', { error: 'Transfer not found' });
                return;
            }
            // Don't save to database here - let the encryption handler do it
            // Just confirm the upload and trigger encryption
            // Send to sender for encryption (not as a regular message)
            socket.emit('messageConfirmed', {
                fileData: fileData,
                message: message || '',
            });
            // Clean up transfer
            delete activeTransfers[fileId];

        } catch (error) {
            console.error('Error in file upload complete:', error);
            socket.emit('messageError', { error: 'Failed to process file upload' });
            
            // Clean up transfer on error
            const { fileId } = data;
            if (fileId && activeTransfers[fileId]) {
                delete activeTransfers[fileId];
            }
        }
    });
    socket.on('fileUploadFailed', (data) => {
        try {
            const { fileId } = data;
            const transfer = activeTransfers[fileId];

            if (transfer) {
                // Notify receiver that upload failed
                const receiverSocketId = connectedUsers[transfer.receiverId];
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('fileUploadFailed', {
                        fileId,
                        sender: { _id: transfer.senderId }
                    });
                }

                // Clean up the transfer
                delete activeTransfers[fileId];
            }
        } catch (error) {
            console.error('Error in fileUploadFailed:', error);
        }
    });
    // Handle sending messages
    // Handle encrypted message sending
    socket.on('sendEncryptedMessage', async (data) => {
        try {
            const { senderId, receiverId, message } = data;

            // Emit initial progress
            socket.emit('encryptionProgress', { stage: 'Preparing encryption...', progress: 10 });

            // Create random cover image
            const coverImage = await createRandomImage();
            const coverImagePath = `./public/uploads/cover-${Date.now()}.png`;

            // Save canvas as PNG
            const buffer = coverImage.toBuffer('image/png');
            fs.writeFileSync(coverImagePath, buffer);

            socket.emit('encryptionProgress', { stage: 'Generating keys...', progress: 30 });

            // Get user fingerprints
            const sender = await usermodel.findById(senderId);
            const receiver = await usermodel.findById(receiverId);

            if (!sender || !receiver) {
                socket.emit('messageError', { error: 'User not found' });
                return;
            }

            // ✅ Get raw hex, then hash it to make it smaller
            const rawFp1 = sender.passkey[0].credential.publicKey.toString('hex');
            const rawFp2 = receiver.passkey[0].credential.publicKey.toString('hex');

            const fp1 = hashFingerprint(rawFp1);
            const fp2 = hashFingerprint(rawFp2);

            console.log('🔍 DEBUG - Encryption fingerprints:');
            console.log('  Sender ID:', senderId);
            console.log('  Raw FP1:', rawFp1);
            console.log('  Hashed FP1:', fp1);
            console.log('  Receiver ID:', receiverId);
            console.log('  Raw FP2:', rawFp2);
            console.log('  Hashed FP2:', fp2);

            // Define output path for encrypted image
            const outputPath = `./public/uploads/encrypted-message-${Date.now()}.png`;

            socket.emit('encryptionProgress', { stage: 'Encrypting message...', progress: 60 });

            // Call Python encryption script
            const result = await executePython('encrypt', {
                fp1: fp1,
                fp2: fp2,
                message: message,
                imagePath: coverImagePath,
                outputPath: outputPath
            });

            socket.emit('encryptionProgress', { stage: 'Finalizing...', progress: 90 });

            // Clean up cover image
            fs.unlinkSync(coverImagePath);

            // Save encrypted message to database
            const messageData = {
                sender: senderId,
                receiver: receiverId,
                message: '', // Empty since content is encrypted
                encryptedData: {
                    imagePath: outputPath,
                    isEncrypted: true,
                    type: 'message',
                    originalFileName: undefined,
                    originalFileSize: undefined,
                    originalFileType: undefined
                },
                timestamp: new Date(),
                isRead: false
            };

            const newMessage = await chatmodel.create(messageData);
            await newMessage.populate('sender receiver', 'username name');

            socket.emit('encryptionProgress', { stage: 'Complete!', progress: 100 });

            // Send to receiver if online
            const receiverSocketId = connectedUsers[receiverId];
            if (receiverSocketId) {
                // First send incoming alert
                io.to(receiverSocketId).emit('encryptedMessageIncoming', {
                    sender: newMessage.sender,
                    type: 'message'
                });

                // Then send the actual message
                io.to(receiverSocketId).emit('receiveEncryptedMessage', {
                    _id: newMessage._id,
                    sender: newMessage.sender,
                    receiver: newMessage.receiver,
                    encryptedData: newMessage.encryptedData,
                    timestamp: newMessage.timestamp
                });
            }

            // Confirm to sender
            socket.emit('encryptedMessageConfirmed', {
                _id: newMessage._id,
                sender: newMessage.sender,
                receiver: newMessage.receiver,
                encryptedData: newMessage.encryptedData,
                timestamp: newMessage.timestamp
            });

        } catch (error) {
            console.error('Error sending encrypted message:', error);
            socket.emit('messageError', { error: error.message });
        }
    });

    // Handle encrypted file sending
    socket.on('sendEncryptedFile', async (data) => {
        try {
            const { senderId, receiverId, fileData } = data;

            // Emit initial progress
            socket.emit('fileEncryptionProgress', { stage: 'Preparing file encryption...', progress: 10 });

            // Create random cover image
            const coverImage = await createRandomImage();
            const coverImagePath = `./public/uploads/cover-${Date.now()}.png`;

            // Save canvas as PNG
            const buffer = coverImage.toBuffer('image/png');
            fs.writeFileSync(coverImagePath, buffer);

            socket.emit('fileEncryptionProgress', { stage: 'Generating encryption keys...', progress: 25 });

            // Get user fingerprints
            const sender = await usermodel.findById(senderId);
            const receiver = await usermodel.findById(receiverId);

            if (!sender || !receiver) {
                socket.emit('messageError', { error: 'User not found' });
                return;
            }

            // ✅ Get raw hex, then hash it
            const rawFp1 = sender.passkey[0].credential.publicKey.toString('hex');
            const rawFp2 = receiver.passkey[0].credential.publicKey.toString('hex');

            const fp1 = hashFingerprint(rawFp1);
            const fp2 = hashFingerprint(rawFp2);

            // Define output path for encrypted image
            const outputPath = `./public/uploads/encrypted-file-${Date.now()}.png`;

            socket.emit('fileEncryptionProgress', { stage: 'Encrypting file data...', progress: 60 });

            // Call Python encryption script for file
            const result = await executePython('encrypt_file', {
                fp1: fp1,
                fp2: fp2,
                filePath: `./public${fileData.path}`,
                imagePath: coverImagePath,
                outputPath: outputPath
            });

            socket.emit('fileEncryptionProgress', { stage: 'Finalizing encryption...', progress: 90 });

            // Clean up cover image and original file
            fs.unlinkSync(coverImagePath);
            fs.unlinkSync(`./public${fileData.path}`);

            // Save encrypted file message to database
            const messageData = {
                sender: senderId,
                receiver: receiverId,
                message: '',
                encryptedData: {
                    imagePath: outputPath,
                    isEncrypted: true,
                    type: 'file',
                    originalFileName: fileData.originalName,
                    originalFileSize: fileData.size,
                    originalFileType: fileData.mimetype
                },
                timestamp: new Date(),
                isRead: false
            };

            const newMessage = await chatmodel.create(messageData);
            await newMessage.populate('sender receiver', 'username name');

            socket.emit('fileEncryptionProgress', { stage: 'Complete!', progress: 100 });

            // Send to receiver if online
            const receiverSocketId = connectedUsers[receiverId];
            if (receiverSocketId) {
                // First send incoming alert
                io.to(receiverSocketId).emit('encryptedMessageIncoming', {
                    sender: newMessage.sender,
                    type: 'file'
                });

                // Then send the actual message
                io.to(receiverSocketId).emit('receiveEncryptedMessage', {
                    _id: newMessage._id,
                    sender: newMessage.sender,
                    receiver: newMessage.receiver,
                    encryptedData: newMessage.encryptedData,
                    timestamp: newMessage.timestamp
                });
            }

            // Confirm to sender
            socket.emit('encryptedMessageConfirmed', {
                _id: newMessage._id,
                sender: newMessage.sender,
                receiver: newMessage.receiver,
                encryptedData: newMessage.encryptedData,
                timestamp: newMessage.timestamp
            });

        } catch (error) {
            console.error('Error sending encrypted file:', error);
            socket.emit('messageError', { error: error.message });
        }
    });

    // Handle decryption challenge request
    socket.on('requestDecryptionChallenge', async (data) => {
        try {
            const { messageId, userId } = data;

            const user = await usermodel.findById(userId);
            if (!user || !user.passkey[0]) {
                socket.emit('decryptionError', { error: 'User authentication data not found' });
                return;
            }
            const arr = await challengeModel.find({ userid: user._id, messageId: messageId });
            if (arr.length > 0) {
                await challengeModel.deleteMany({ userid: user._id, messageId: messageId }); // Clear any existing challenges for the user
            }
            const challengeOptions = await generateAuthenticationOptions({
                rpID: socket.rpID,
            });

            // Store challenge temporarily
            await challengeModel.create({
                userid: userId,
                challenge: challengeOptions.challenge,
                messageId: messageId
            });

            socket.emit('decryptionChallenge', {
                messageId: messageId,
                options: challengeOptions
            });

        } catch (error) {
            console.error('Error generating decryption challenge:', error);
            socket.emit('decryptionError', { error: 'Failed to generate challenge' });
        }
    });

    // Handle decryption after challenge verification
    socket.on('verifyAndDecrypt', async (data) => {
        try {
            const { messageId, userId, credential } = data;

            const challenge = await challengeModel.findOne({ userid: userId, messageId: messageId });
            const user = await usermodel.findById(userId);
            const message = await chatmodel.findById(messageId);

            if (!challenge || !user || !message) {
                socket.emit('decryptionError', { error: 'Invalid decryption request' });
                return;
            }

            // Check if user is authorized (sender or receiver)
            if (userId !== message.sender.toString() && userId !== message.receiver.toString()) {
                socket.emit('decryptionError', { error: 'You are not authorized to decrypt this message' });
                return;
            }

            socket.emit('decryptionProgress', {
                messageId: messageId,
                stage: 'Verifying identity...',
                progress: 20
            });

            // Verify authentication
            const storedPasskey = user.passkey[0];
            const credentialForVerification = {
                id: storedPasskey.credential.id,
                publicKey: storedPasskey.credential.publicKey,
                counter: storedPasskey.credential.counter || 0,
                transports: storedPasskey.credential.transports || ['internal']
            };

            const verificationResult = await verifyAuthenticationResponse({
                expectedChallenge: challenge.challenge,
                expectedOrigin: socket.origin,
                expectedRPID: socket.rpID,
                response: credential,
                credential: credentialForVerification,
            });

            if (!verificationResult || !verificationResult.verified) {
                await challengeModel.findOneAndDelete({ userid: userId, messageId: messageId });
                socket.emit('decryptionError', { error: 'Authentication failed' });
                return;
            }

            socket.emit('decryptionProgress', {
                messageId: messageId,
                stage: 'Preparing decryption...',
                progress: 40
            });

            const rawFingerprint = user.passkey[0].credential.publicKey.toString('hex');
            const fingerprint = hashFingerprint(rawFingerprint);
            console.log('🔍 DEBUG - Decryption fingerprint:', fingerprint);
            console.log('🔍 DEBUG - User ID:', userId);

            const imagePath = message.encryptedData.imagePath;

            if (message.encryptedData.type === 'message') {

                socket.emit('decryptionProgress', {
                    messageId: messageId,
                    stage: 'Decrypting message...',
                    progress: 70
                });

                const result = await executePython('decrypt', {
                    fingerprint: fingerprint,
                    imagePath: imagePath
                });

                socket.emit('decryptionProgress', {
                    messageId: messageId,
                    stage: 'Complete!',
                    progress: 100
                });

                socket.emit('decryptionSuccess', {
                    messageId: messageId,
                    type: 'message',
                    content: result.message
                });
            } else if (message.encryptedData.type === 'file') {

                socket.emit('decryptionProgress', {
                    messageId: messageId,
                    stage: 'Decrypting file...',
                    progress: 70
                });

                const outputPath = `./public/uploads/decrypted-${Date.now()}-${message.encryptedData.originalFileName}`;

                const result = await executePython('decrypt_file', {
                    fingerprint: fingerprint,
                    imagePath: imagePath,
                    outputPath: outputPath
                });

                socket.emit('decryptionProgress', {
                    messageId: messageId,
                    stage: 'Complete!',
                    progress: 100
                });

                socket.emit('decryptionSuccess', {
                    messageId: messageId,
                    type: 'file',
                    downloadPath: outputPath.replace('./public', ''),
                    fileName: message.encryptedData.originalFileName,
                    fileSize: message.encryptedData.originalFileSize,
                    fileType: message.encryptedData.originalFileType
                });
            }

            // Clean up challenge
            await challengeModel.findOneAndDelete({ userid: userId, messageId: messageId });

        } catch (error) {
            console.error('Error during decryption:', error);
            socket.emit('decryptionError', { error: 'Decryption failed: ' + error.message });
        }
    });

    socket.on('decryptMessage', async (data) => {
        try {
            const { messageId, userId } = data;
            // Get the encrypted message
            const message = await chatmodel.findById(messageId);
            const user = await usermodel.findById(userId);

            if (!message || !user) {
                socket.emit('decryptionError', { error: 'Message or user not found' });
                return;
            }

            // Hash the user's fingerprint
            const fingerprint = hashFingerprint(user.passkey[0].credential.id);

            // Call Python decryption script
            const result = await executePython('decrypt', {
                fingerprint: fingerprint,
                imagePath: message.encryptedData.imagePath
            });

            // Send decrypted content back
            socket.emit('decryptionSuccess', {
                messageId: messageId,
                content: result.message,
                type: message.encryptedData.type
            });

        } catch (error) {
            console.error('Error decrypting message:', error);
            socket.emit('decryptionError', { error: error.message });
        }
    });

    socket.on('disconnect', () => {
        const userId = socketToUser[socket.id];
        if (userId) {
            delete connectedUsers[userId];
            delete socketToUser[socket.id];
            console.log(`User ${userId} disconnected`);

            // Notify all other users that this user went offline
            socket.broadcast.emit('userOffline', userId);
        }
    });
});
const authenticateToken = function (req, res, next) {
    if (req.cookies.access_token) {
        jwt.verify(req.cookies.access_token, process.env.ACCESS_SECRET_KEY, (err, data) => {
            if (err) {
                res.redirect('/logout');
                return;
            }
            else {
                req.data = data;
                next();
            }
        });
    }
    else {
        if (req.cookies.refresh_token) {
            jwt.verify(req.cookies.refresh_token, process.env.REFRESH_SECRET_KEY, (err, data) => {
                if (err) {
                    res.redirect('/logout');
                    return;
                }
                else {
                    const new_access_token = jwt.sign({ Email: data.Email }, process.env.ACCESS_SECRET_KEY, { expiresIn: process.env.ACCESS_TOKEN_EXPIRE_IN });
                    res.cookie('access_token', new_access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 1000 * 60 * 15 });
                    const protective_route = req.originalUrl;
                    res.redirect(protective_route);
                }
            });
        }
        else {
            res.redirect('/');
            return;
        }
    }
};

app.get('/', (req, res) => {
    res.render('index1');
});

app.get('/get-started', authenticateToken, async (req, res) => {
    const user = await usermodel.findOne({ email: req.data.Email });
    res.render('Get-Started', { usernamne: user.username, name: user.name, email: user.email });
});

app.post('/get-started', async (req, res) => {
    if (req.cookies.refresh_token) {
        jwt.verify(req.cookies.refresh_token, process.env.REFRESH_SECRET_KEY, (err, data) => {
            if (err) {
                if (req.cookies.access_token) {
                    res.clearCookie('access_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
                }
                if (req.cookies.refresh_token) {
                    res.clearCookie('refresh_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
                }
                return res.json({ verified: false, message: 'You are not logged in, please login to continue' });
            }
            else {
                return res.json({ verified: true, message: 'Welcome back!' });
            }
        });
    }
    else {
        return res.json({ verified: false, message: 'You are not logged in, please login to continue' });
    }
});

// File upload endpoint
app.post('/upload-file', authenticateToken, (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File too large. Maximum size is 1GB.' });
            }
            return res.status(400).json({ error: `Upload error: ${err.message}` });
        } else if (err) {
            console.error('Upload error:', err);
            return res.status(500).json({ error: 'Internal server error during upload' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        res.json({
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            path: `/uploads/${req.file.filename}`
        });
    });
});

app.get('/chat/:username/verify', authenticateToken, async (req, res) => {
    const user = await usermodel.findOne({ username: req.params.username });
    const user1 = await usermodel.findOne({ email: req.data.Email });
    if (user) {
        return res.json({ verified: true });
    }
    else {
        return res.json({ verified: false, message: 'User not found!! Please try again' });
    }
});

app.get('/chat/:username', authenticateToken, async (req, res) => {
    const user_chat = await usermodel.findOne({ username: req.params.username });
    const user = await usermodel.findOne({ email: req.data.Email });

    // Get chat history between these two users and $or is mongoDB 'LOGICAL OR' operator to find documents that match either condition
    const chatHistory = await chatmodel.find({
        $or: [
            { sender: user._id, receiver: user_chat._id },
            { sender: user_chat._id, receiver: user._id }
        ]
    }).sort({ timestamp: 1 }).populate('sender receiver', 'username name');

    // Mark messages from chat user as read when loading chat
    await chatmodel.updateMany({
        sender: user_chat._id,
        receiver: user._id,
        isRead: false
    }, {
        isRead: true
    });

    res.render('chat', {
        currentUser: user,
        chatUser: user_chat,
        messages: chatHistory
    });
});

// Generate a challenge for registration and send to the client
app.post('/register', async (req, res) => {
    const { name, username, email, password } = req.body;
    let u = await usermodel.findOne({ email: email });// Check if user already exists with the same email
    if (u) {
        if (u.passkey.length > 0) {
            return res.json({ verified: false, message: 'User already exists,please login in' });
        }
    }
    let u1 = await usermodel.findOne({ username: username });// Check if username is already taken
    if (u1) {
        if (u1.passkey.length > 0) {
            return res.json({ verified: false, message: 'Username already taken, please try another one.' });
        }
    }
    // Get the actual origin from the request
    const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const rpID = origin.includes('localhost') ? 'localhost' : new URL(origin).hostname;
    bcrypt.genSalt(10, (err, salt) => {
        if (err) {
            console.error('Error generating salt:', err);
            return res.status(500).send('Internal Server Error');
        }
        bcrypt.hash(password, salt, async (err, hash) => {
            if (err) {
                console.error('Error hashing password:', err);
                return res.status(500).send('Internal Server Error');
            }
            if (u) {
                const array = await challengeModel.find({ userid: u._id })
                if (array.length > 0) {
                    await challengeModel.deleteMany({ userid: u._id });
                }
                if (u.passkey.length === 0) {
                    await usermodel.deleteMany({ username: u.username });
                }
            }
            if (u1 && u === null) {
                const array = await challengeModel.find({ userid: u1._id })
                if (array.length > 0) {
                    await challengeModel.deleteMany({ userid: u1._id });
                }
                if (u1.passkey.length === 0) {
                    await usermodel.deleteMany({ username: u1.username });
                }
            }
            const user = await usermodel.create({ name, username, email, password: hash });
            const challengePayload = await generateRegistrationOptions({
                rpName: 'ChatApp',
                rpID: rpID,
                userName: user.email,
            });
            await challengeModel.create({ userid: user._id, challenge: challengePayload.challenge });
            return res.json({ verified: true, option: challengePayload, id: user._id });
        });
    });
});

// Receive the credential from the client after giving the challenge,and store the public key in the database
app.post('/register/credential', async (req, res) => {
    const { credential, userId } = req.body;

    // Get the actual origin from the request
    const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const rpID = origin.includes('localhost') ? 'localhost' : new URL(origin).hostname;

    const c = await challengeModel.findOne({ userid: userId });
    const verificationResult = await verifyRegistrationResponse({
        expectedChallenge: c.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        response: credential,
    });
    if (!verificationResult.verified) {
        await challengeModel.findOneAndDelete({ userid: userId });
        await usermodel.findOneAndDelete({ _id: userId }); // Clean up user if registration fails
        return res.json({ verified: false, message: 'Registration failed. Please try again.' });
    }
    const info = verificationResult.registrationInfo;
    // Convert Uint8Arrays to Buffers for Mongoose
    if (info.credential?.id && info.credential.id instanceof Uint8Array) {
        info.credential.id = Buffer.from(info.credential.id);
    }
    if (info.credential?.publicKey && info.credential.publicKey instanceof Uint8Array) {
        info.credential.publicKey = Buffer.from(info.credential.publicKey);
    }
    if (info.attestationObject && info.attestationObject instanceof Uint8Array) {
        info.attestationObject = Buffer.from(info.attestationObject);
    }

    const user = await usermodel.findOne({ _id: userId });
    user.passkey.push(info);
    await user.save();
    await challengeModel.findOneAndDelete({ userid: userId });
    return res.json({ verified: true, message: 'Registered Successfully!! Proceed to login' });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    // Get the actual origin from the request
    const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const rpID = origin.includes('localhost') ? 'localhost' : new URL(origin).hostname;

    const user = await usermodel.findOne({ email: email });
    if (!user) {
        return res.json({ verified: false, message: 'Invalid email or password' });
    }
    bcrypt.compare(password, user.password, async (err, result) => {
        if (err) {
            return res.status(500).send('Internal Server Error');
        }
        if (!result) {
            return res.json({ verified: false, message: 'Invalid email or password' });
        }
        const arr = await challengeModel.find({ userid: user._id });
        if (arr.length > 0) {
            await challengeModel.deleteMany({ userid: user._id }); // Clear any existing challenges for the user
        }
        const challenge_auth = await generateAuthenticationOptions({ // This is similar to the challenge payload in the registration process
            rpID: rpID,
        });
        await challengeModel.create({ userid: user._id, challenge: challenge_auth.challenge });
        return res.json({ verified: true, option: challenge_auth, id: user._id });
    });
});

app.post('/login/credential', async (req, res) => {
    const { credential, userId } = req.body;
    const c = await challengeModel.findOne({ userid: userId });
    const user = await usermodel.findOne({ _id: userId });

    // Get the actual origin from the request
    const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const rpID = origin.includes('localhost') ? 'localhost' : new URL(origin).hostname;

    // Get the stored passkey
    const storedPasskey = user.passkey[0];

    // Create the credential object based on verifyAuthenticationResponse requirements
    const credentialForVerification = {
        id: storedPasskey.credential.id,
        publicKey: storedPasskey.credential.publicKey,
        counter: storedPasskey.credential.counter || 0,
        transports: storedPasskey.credential.transports || ['internal']
    };

    const verificationResult_auth = await verifyAuthenticationResponse({
        expectedChallenge: c.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        response: credential,
        credential: credentialForVerification,
    });
    if (verificationResult_auth.verified) {
        const newCounter = verificationResult_auth.authenticationInfo.newCounter;// This is the updated counter after successful authentication
        console.log('Authentication successful, updating counter to:', newCounter);

        // Update the counter in the stored passkey
        await usermodel.findOneAndUpdate(
            { _id: userId, 'passkey.credential.id': storedPasskey.credential.id },
            { $set: { 'passkey.$.credential.counter': newCounter } },
            { new: true } // Return the updated document
        );
        await challengeModel.findOneAndDelete({ userid: userId });

        let access_token = jwt.sign({ Email: user.email }, process.env.ACCESS_SECRET_KEY, { expiresIn: process.env.ACCESS_TOKEN_EXPIRE_IN });
        let refresh_token = jwt.sign({ Email: user.email }, process.env.REFRESH_SECRET_KEY, { expiresIn: process.env.REFRESH_TOKEN_EXPIRE_IN });
        res.cookie('access_token', access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 1000 * 60 * 15});
        res.cookie('refresh_token', refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 1000 * 60 * 60 * 24 * 7 });
        return res.json({ verified: true, message: 'Login Successful!!' });
    }
    await challengeModel.findOneAndDelete({ userid: userId });
    return res.json({ verified: false, message: 'Login Failed. You are not authenticated.' });
});

// Cleanup decrypted files
app.post('/cleanup-decrypted-file', authenticateToken, (req, res) => {
    try {
        console.log('Cleanup request received');
        const { filePath } = req.body;
        const fullPath = `./public${filePath}`;

        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({ error: 'Cleanup failed' });
    }
})

app.get('/logout', (req, res) => {
    if (req.cookies.access_token) {
        res.clearCookie('access_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    }
    if (req.cookies.refresh_token) {
        res.clearCookie('refresh_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    }
    res.redirect('/');
});
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});


