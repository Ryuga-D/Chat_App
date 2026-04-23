// Initialize Socket.IO
const socket = io();

// Get DOM elements
const messagesEl = document.getElementById('messages');
const textInput = document.getElementById('textInput');
const fileInput = document.getElementById('fileInput');
const sendBtn = document.getElementById('sendBtn');
const homeBtn = document.getElementById('homeBtn');
const onlineStatus = document.getElementById('onlineStatus');

// Get chat data from data attributes
const chatDataDiv = document.getElementById('chatData');
const currentUser = JSON.parse(decodeURIComponent(chatDataDiv.dataset.currentUser));
const chatUser = JSON.parse(decodeURIComponent(chatDataDiv.dataset.chatUser));
const messages = JSON.parse(decodeURIComponent(chatDataDiv.dataset.messages));

// Add CSS for animations and progress bars
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    @keyframes slideIn {
        0% { 
            opacity: 0; 
            transform: translateY(20px); 
        }
        100% { 
            opacity: 1; 
            transform: translateY(0); 
        }
    }
    
    @keyframes slideInRight {
        0% { 
            opacity: 0; 
            transform: translateX(100%); 
        }
        100% { 
            opacity: 1; 
            transform: translateX(0); 
        }
    }
    
    @keyframes slideOutRight {
        0% { 
            opacity: 1; 
            transform: translateX(0); 
        }
        100% { 
            opacity: 0; 
            transform: translateX(100%); 
        }
    }
    
    @keyframes fadeIn {
        0% { opacity: 0; }
        100% { opacity: 1; }
    }
    
    @keyframes fadeOut {
        0% { opacity: 1; }
        100% { opacity: 0; }
    }
    
    @keyframes progressPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
    }
    
    .encrypted-content:hover {
        box-shadow: 0 4px 15px rgba(13, 110, 253, 0.3);
    }
    
    .message.user .encrypted-content {
        border: 2px solid rgba(13, 110, 253, 0.2);
    }
    
    .message.bot .encrypted-content {
        border: 2px solid rgba(40, 167, 69, 0.2);
    }
    
    .decryption-progress, .file-decryption-progress {
        backdrop-filter: blur(5px);
    }
    
    .progress-bar {
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
    }
    
    .progress-fill {
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    
    .spinner {
        filter: drop-shadow(0 0 3px rgba(13, 110, 253, 0.5));
    }
    
    .message {
        animation: slideIn 0.3s ease;
    }
    
    .encrypted-overlay {
        backdrop-filter: blur(2px);
    }
    
    .file-preview-container {
        animation: slideIn 0.3s ease;
    }
    
    @media (max-width: 768px) {
        .progress-bar {
            width: 200px;
        }
        
        .file-decryption-progress .progress-bar {
            width: 180px;
        }
        
        .encrypted-content {
            max-width: 250px;
        }
    }
`;
document.head.appendChild(style);

// Handle home button click
homeBtn.addEventListener('click', () => {
    socket.disconnect();
    window.location.href = '/get-started';
});

let notificationDelay = 0;

socket.on('connect', () => {
    console.log('Connected to server');

    //  Reset before joining (before missed messages come)
    notificationDelay = 0;

    // Now join and get missed messages
    socket.emit('join', currentUser._id);
    socket.emit('checkUserStatus', chatUser._id);
});

socket.on('missedMessages', (data) => {
    const delay = notificationDelay * 1000;
    notificationDelay++;

    if (data.messageCount === 1) {
        setTimeout(() => {
            showNotification('Missed Messages', `You have an unread message from ${data.sender} ie ${data.n_sender}`);
        }, delay);
    } else {
        setTimeout(() => {
            showNotification('Missed Messages', `You have ${data.messageCount} unread messages from ${data.sender} ie ${data.n_sender}`);
        }, delay);
    }
});

// Listen for CHAT USER's online status response
socket.on('userStatusResponse', (data) => {
    if (data.userId === chatUser._id) {
        if (onlineStatus) {
            onlineStatus.textContent = data.isOnline ? 'Online' : 'Offline';
            if (data.isOnline) {
                onlineStatus.classList.add('online');
            } else {
                onlineStatus.classList.remove('online');
            }
        }
    }
});

// Listen for when CHAT USER comes online
socket.on('userOnline', (userId) => {
    if (userId === chatUser._id && onlineStatus) {
        onlineStatus.textContent = 'Online';
        onlineStatus.classList.add('online');
    }
});

// Listen for when CHAT USER goes offline
socket.on('userOffline', (userId) => {
    if (userId === chatUser._id && onlineStatus) {
        onlineStatus.textContent = 'Offline';
        onlineStatus.classList.remove('online');
    }
});

// Load existing file content on page load
document.addEventListener('DOMContentLoaded', () => {
    // Handle encrypted messages on page load
    const encryptedContents = document.querySelectorAll('.encrypted-content');
    encryptedContents.forEach(container => {
        const messageId = container.closest('[data-message-id]').getAttribute('data-message-id');

        // Add hover effects
        container.addEventListener('mouseenter', () => {
            container.style.transform = 'scale(1.02)';
            const overlay = container.querySelector('.encrypted-overlay');
            if (overlay) overlay.style.opacity = '1';
        });

        container.addEventListener('mouseleave', () => {
            container.style.transform = 'scale(1)';
            const overlay = container.querySelector('.encrypted-overlay');
            if (overlay) overlay.style.opacity = '0';
        });

        // Add click handler for decryption
        container.addEventListener('click', () => {
            requestDecryption(messageId);
        });
    });

    // It automatically scrolls the chat container to the bottom, so the user sees the latest messages.
    messagesEl.scrollTop = messagesEl.scrollHeight;
});

// Create file preview container
function createFilePreview() {
    const previewContainer = document.createElement('div');
    previewContainer.style.cssText = `
        display: none;
        background: #333;
        border-radius: 10px;
        padding: 10px;
        margin: 5px 0;
        align-items: center;
        gap: 10px;
        border: 2px solid #0d6efd;
        animation: slideIn 0.3s ease;
    `;

    const previewContent = document.createElement('div');
    previewContent.style.cssText = `
        flex: 1;
        display: flex;
        align-items: center;
        gap: 10px;
    `;

    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '✕';
    removeBtn.style.cssText = `
        background: #dc3545;
        border: none;
        color: white;
        width: 25px;
        height: 25px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    removeBtn.addEventListener('click', () => {
        fileInput.value = '';
        previewContainer.style.display = 'none';
    });

    previewContainer.appendChild(previewContent);
    previewContainer.appendChild(removeBtn);

    const inputArea = document.querySelector('.input-area');
    inputArea.parentNode.insertBefore(previewContainer, inputArea);

    return { previewContainer, previewContent };
}

const filePreview = createFilePreview();

// Show file preview when file is selected
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
        filePreview.previewContainer.style.display = 'none';
        return;
    }

    // Check file size (1GB limit)
    if (file.size > 1024 * 1024 * 1024) {
        alert('File too large. Maximum size is 1GB.');
        fileInput.value = '';
        filePreview.previewContainer.style.display = 'none';
        return;
    }

    // Clear previous preview
    filePreview.previewContent.innerHTML = '';

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.cssText = `
                width: 40px;
                height: 40px;
                object-fit: cover;
                border-radius: 5px;
            `;

            const fileInfo = document.createElement('div');
            fileInfo.style.cssText = `
                color: white;
                font-size: 0.9em;
            `;
            fileInfo.innerHTML = `
                <div style="font-weight: bold;">📷 ${file.name}</div>
                <div style="opacity: 0.7; font-size: 0.8em;">${formatFileSize(file.size)}</div>
            `;

            filePreview.previewContent.appendChild(img);
            filePreview.previewContent.appendChild(fileInfo);
        };
        reader.readAsDataURL(file);

    } else if (file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const video = document.createElement('video');
            video.src = e.target.result;
            video.style.cssText = `
                width: 40px;
                height: 40px;
                object-fit: cover;
                border-radius: 5px;
            `;

            const fileInfo = document.createElement('div');
            fileInfo.style.cssText = `
                color: white;
                font-size: 0.9em;
            `;
            fileInfo.innerHTML = `
                <div style="font-weight: bold;">🎬 ${file.name}</div>
                <div style="opacity: 0.7; font-size: 0.8em;">${formatFileSize(file.size)}</div>
            `;

            filePreview.previewContent.appendChild(video);
            filePreview.previewContent.appendChild(fileInfo);
        };
        reader.readAsDataURL(file);

    } else {
        const fileIcon = getFileIcon(file.type, file.name);
        const fileInfo = document.createElement('div');
        fileInfo.style.cssText = `
            color: white;
            font-size: 0.9em;
            display: flex;
            align-items: center;
            gap: 10px;
        `;

        const iconDiv = document.createElement('div');
        iconDiv.style.cssText = `
            width: 40px;
            height: 40px;
            background: #555;
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        `;
        iconDiv.innerHTML = fileIcon;

        const fileInfoText = document.createElement('div');
        fileInfoText.innerHTML = `
            <div style="font-weight: bold;">${file.name}</div>
            <div style="opacity: 0.7; font-size: 0.8em;">${formatFileSize(file.size)}</div>
        `;

        fileInfo.appendChild(iconDiv);
        fileInfo.appendChild(fileInfoText);
        filePreview.previewContent.appendChild(fileInfo);
    }

    filePreview.previewContainer.style.display = 'flex';
});

// Format file size helper function
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Modified sendMessage function for encryption
function sendMessage() {
    const text = textInput.value.trim();
    const file = fileInput.files[0];

    if (!text && !file) return;

    if (file) {
        sendEncryptedFile(file);
    } else {
        sendEncryptedMessage(text);
    }
}

function sendEncryptedMessage(message) {
    // Show encrypting status
    sendBtn.disabled = true;
    sendBtn.innerHTML = 'Encrypting...';

    showEncryptionProgress('message', message.substring(0, 50) + '...');

    socket.emit('sendEncryptedMessage', {
        senderId: currentUser._id,
        receiverId: chatUser._id,
        message: message
    });

    // Clear input
    textInput.value = '';
}

function sendEncryptedFile(file) {
    // First upload the file normally, then it will be encrypted
    sendFileWithProgress(file, '');
}

function sendFileWithProgress(file, message) {
    const fileId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);

    // Notify receiver that upload is starting
    socket.emit('fileUploadStart', {
        fileId: fileId,
        senderId: currentUser._id,
        receiverId: chatUser._id,
        fileName: file.name,
        fileSize: file.size
    });

    // Show progress on sender side
    showUploadProgress(fileId, file.name, 'Uploading');

    // Disable send button
    sendBtn.disabled = true;
    sendBtn.innerHTML = 'Uploading...';

    // Create FormData for upload
    const formData = new FormData();
    formData.append('file', file);

    // This is equivalent to the HTML form -->
    // <form enctype="multipart/form-data">
    //     <input type="file" name="file">
    // </form>

    // Create XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest();

    // Set timeout for large files (10 minutes)
    xhr.timeout = 600000;
    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            updateUploadProgress(fileId, progress);

            // Send progress to receiver
            socket.emit('fileUploadProgress', {
                fileId: fileId,
                progress: progress
            });
        }
    });

    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            try {
                const fileData = JSON.parse(xhr.responseText);

                // Complete the upload
                socket.emit('fileUploadComplete', {
                    fileId: fileId,
                    fileData: fileData,
                    message: message
                });
            } catch (error) {
                console.error('Error parsing upload response:', error);
                alert('Upload failed. Please try again.');
                cleanupUpload(fileId);
            }
        } else {
            console.error('Upload failed with status:', xhr.status, xhr.statusText);
            alert(`Upload failed: ${xhr.statusText}. Please try again.`);
            cleanupUpload(fileId);
        }
    });

    xhr.addEventListener('error', (e) => {
        console.error('Upload error:', e);
        alert('Network error during upload. Please check your connection and try again.');
        cleanupUpload(fileId);
    });

    xhr.addEventListener('timeout', () => {
        console.error('Upload timeout');
        alert('Upload timed out. Please try again with a smaller file or better connection.');
        cleanupUpload(fileId);
    });

    xhr.open('POST', '/upload-file');
    xhr.send(formData);
}

// Enhanced progress UI functions with better cleanup
function showUploadProgress(fileId, fileName, type = 'Uploading') {
    // Remove any existing progress with same fileId first
    hideUploadProgress(fileId);

    const progressDiv = document.createElement('div');
    progressDiv.id = `progress-${fileId}`;
    progressDiv.classList.add('message', 'user');
    progressDiv.style.cssText = `
        background: #333;
        padding: 15px;
        margin: 5px 0;
        border-radius: 10px;
        color: white;
        border-left: 4px solid #0d6efd;
    `;

    progressDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div class="spinner" style="
                width: 20px; 
                height: 20px; 
                border: 2px solid #555; 
                border-top: 2px solid #0d6efd; 
                border-radius: 50%; 
                animation: spin 1s linear infinite;
            "></div>
            <span>${type}: ${fileName}</span>
        </div>
        <div class="progress-bar" style="
            background: #555; 
            height: 8px; 
            border-radius: 4px; 
            overflow: hidden;
        ">
            <div class="progress-fill" style="
                background: linear-gradient(90deg, #0d6efd, #0b5ed7); 
                height: 100%; 
                width: 0%; 
                border-radius: 4px; 
                transition: width 0.3s ease;
            "></div>
        </div>
        <div class="progress-text" style="
            font-size: 0.8em; 
            margin-top: 5px; 
            opacity: 0.8;
            text-align: center;
        ">0%</div>
    `;

    // Append the progress element to messages
    messagesEl.appendChild(progressDiv);
    // Scroll to the bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updateUploadProgress(fileId, progress) {
    const progressDiv = document.getElementById(`progress-${fileId}`);
    if (progressDiv) {
        const progressFill = progressDiv.querySelector('.progress-fill');
        const progressText = progressDiv.querySelector('.progress-text');
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${progress}%`;

        // Change color when complete and remove spinner ie buffering or loading sign
        if (progress === 100) {
            if (progressFill) {
                progressFill.style.background = 'linear-gradient(90deg, #28a745, #20c997)';
            }
            const spinner = progressDiv.querySelector('.spinner');
            if (spinner) {
                spinner.style.display = 'none';
            }
        }
    }
}

function hideUploadProgress(fileId) {
    const progressDiv = document.getElementById(`progress-${fileId}`);
    if (progressDiv) {
        progressDiv.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        progressDiv.style.opacity = '0';
        progressDiv.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (progressDiv.parentNode) {
                progressDiv.remove();
            }
        }, 300);
    }
}
// Enhanced progress cleanup function
function cleanupAllProgress() {
    const progressElements = document.querySelectorAll('[id^="progress-"]');
    progressElements.forEach(el => {
        el.style.transition = 'opacity 0.3s ease';
        el.style.opacity = '0';
        setTimeout(() => {
            if (el.parentNode) {
                el.remove();
            }
        }, 300);
    });
}
// Encryption Progress Functions
function showEncryptionProgress(type, content) {
    const progressId = `encryption-${Date.now()}`;

    const progressDiv = document.createElement('div');
    progressDiv.id = progressId;
    progressDiv.classList.add('message', 'user');
    progressDiv.style.cssText = `
        background: #333;
        padding: 15px;
        margin: 5px 0;
        border-radius: 10px;
        color: white;
        border-left: 4px solid #ffc107;
        animation: slideIn 0.3s ease;
    `;

    const contentDisplay = type === 'message' ? content : `File: ${content}`;

    progressDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div class="spinner" style="
                width: 20px; 
                height: 20px; 
                border: 2px solid #555; 
                border-top: 2px solid #ffc107; 
                border-radius: 50%; 
                animation: spin 1s linear infinite;
            "></div>
            <span>🔒 Encrypting ${type === 'message' ? 'Message' : 'File'}</span>
        </div>
        <div style="font-size: 0.9em; opacity: 0.8; margin-bottom: 8px;">
            ${contentDisplay}
        </div>
        <div class="progress-bar" style="
            background: #555; 
            height: 8px; 
            border-radius: 4px; 
            overflow: hidden;
        ">
            <div class="progress-fill" style="
                background: linear-gradient(90deg, #ffc107, #fd7e14); 
                height: 100%; 
                width: 0%; 
                border-radius: 4px; 
                transition: width 0.3s ease;
            "></div>
        </div>
        <div class="progress-text" style="
            font-size: 0.8em; 
            margin-top: 5px; 
            opacity: 0.8;
            text-align: center;
        ">Preparing for encryption...</div>
    `;

    messagesEl.appendChild(progressDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    return progressId;
}

function showFileEncryptionProgress(fileData) {
    const progressId = `file-encryption-${Date.now()}`;

    const progressDiv = document.createElement('div');
    progressDiv.id = progressId;
    progressDiv.classList.add('message', 'user');
    progressDiv.style.cssText = `
        background: #333;
        padding: 15px;
        margin: 5px 0;
        border-radius: 10px;
        color: white;
        border-left: 4px solid #fd7e14;
        animation: slideIn 0.3s ease;
    `;

    const fileIcon = getFileIcon(fileData.mimetype, fileData.originalName);

    progressDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div class="spinner" style="
                width: 20px; 
                height: 20px; 
                border: 2px solid #555; 
                border-top: 2px solid #fd7e14; 
                border-radius: 50%; 
                animation: spin 1s linear infinite;
            "></div>
            <span>🔒 Encrypting File</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <span style="font-size: 24px;">${fileIcon}</span>
            <div>
                <div style="font-weight: bold;">${fileData.originalName}</div>
                <div style="opacity: 0.7; font-size: 0.8em;">${formatFileSize(fileData.size)}</div>
            </div>
        </div>
        <div class="progress-bar" style="
            background: #555; 
            height: 8px; 
            border-radius: 4px; 
            overflow: hidden;
        ">
            <div class="progress-fill" style="
                background: linear-gradient(90deg, #fd7e14, #e55a4e); 
                height: 100%; 
                width: 0%; 
                border-radius: 4px; 
                transition: width 0.3s ease;
            "></div>
        </div>
        <div class="progress-text" style="
            font-size: 0.8em; 
            margin-top: 5px; 
            opacity: 0.8;
            text-align: center;
        ">Preparing for encryption...</div>
    `;

    messagesEl.appendChild(progressDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    return progressId;
}

function updateEncryptionProgress(stage, progress) {
    const progressDiv = document.querySelector('[id^="encryption-"]');
    if (progressDiv) {
        const progressFill = progressDiv.querySelector('.progress-fill');
        const progressText = progressDiv.querySelector('.progress-text');

        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${stage} (${progress}%)`;

        if (progress === 100) {
            const spinner = progressDiv.querySelector('.spinner');
            if (spinner) spinner.style.display = 'none';

            setTimeout(() => {
                if (progressDiv.parentNode) {
                    progressDiv.style.opacity = '0';
                    setTimeout(() => progressDiv.remove(), 300);
                }
            }, 1000);
        }
    }
}

function updateFileEncryptionProgress(stage, progress) {
    const progressDiv = document.querySelector('[id^="file-encryption-"]');
    if (progressDiv) {
        const progressFill = progressDiv.querySelector('.progress-fill');
        const progressText = progressDiv.querySelector('.progress-text');

        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${stage} (${progress}%)`;

        if (progress === 100) {
            const spinner = progressDiv.querySelector('.spinner');
            if (spinner) spinner.style.display = 'none';

            setTimeout(() => {
                if (progressDiv.parentNode) {
                    progressDiv.style.opacity = '0';
                    setTimeout(() => progressDiv.remove(), 300);
                }
            }, 1000);
        }
    }
}

// Decryption Progress Functions
function showDecryptionProgress(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) return;

    const progressOverlay = document.createElement('div');
    progressOverlay.className = 'decryption-progress';
    progressOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        z-index: 10;
        border-radius: 10px;
    `;

    progressOverlay.innerHTML = `
        <div class="spinner" style="
            width: 30px; 
            height: 30px; 
            border: 3px solid #555; 
            border-top: 3px solid #28a745; 
            border-radius: 50%; 
            animation: spin 1s linear infinite;
            margin-bottom: 15px;
        "></div>
        <div style="font-size: 18px; margin-bottom: 10px;">🔓 Decrypting</div>
        <div class="decrypt-stage" style="font-size: 12px; margin-bottom: 10px; opacity: 0.8;">Starting decryption...</div>
        <div class="progress-bar" style="
            background: #555; 
            height: 8px; 
            border-radius: 4px; 
            overflow: hidden;
            width: 200px;
        ">
            <div class="progress-fill" style="
                background: linear-gradient(90deg, #28a745, #20c997); 
                height: 100%; 
                width: 0%; 
                border-radius: 4px; 
                transition: width 0.3s ease;
            "></div>
        </div>
        <div class="progress-percent" style="font-size: 11px; margin-top: 8px; opacity: 0.7;">0%</div>
    `;

    const encryptedContent = messageDiv.querySelector('.encrypted-content');
    if (encryptedContent) {
        encryptedContent.style.position = 'relative';
        encryptedContent.appendChild(progressOverlay);
    }
}

function showFileDecryptionProgress(messageId, fileName) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) return;

    const progressOverlay = document.createElement('div');
    progressOverlay.className = 'file-decryption-progress';
    progressOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        z-index: 10;
        border-radius: 10px;
    `;

    progressOverlay.innerHTML = `
        <div class="spinner" style="
            width: 30px; 
            height: 30px; 
            border: 3px solid #555; 
            border-top: 3px solid #28a745; 
            border-radius: 50%; 
            animation: spin 1s linear infinite;
            margin-bottom: 15px;
        "></div>
        <div style="font-size: 18px; margin-bottom: 10px;">🔓 Decrypting File</div>
        <div style="font-size: 14px; margin-bottom: 15px; text-align: center; max-width: 200px; word-wrap: break-word;">
            📁 ${fileName}
        </div>
        <div class="decrypt-stage" style="font-size: 12px; margin-bottom: 10px; opacity: 0.8;">Starting decryption...</div>
        <div class="progress-bar" style="
            background: #555; 
            height: 8px; 
            border-radius: 4px; 
            overflow: hidden;
            width: 250px;
        ">
            <div class="progress-fill" style="
                background: linear-gradient(90deg, #28a745, #20c997); 
                height: 100%; 
                width: 0%; 
                border-radius: 4px; 
                transition: width 0.3s ease;
            "></div>
        </div>
        <div class="progress-percent" style="font-size: 11px; margin-top: 8px; opacity: 0.7;">0%</div>
    `;

    const encryptedContent = messageDiv.querySelector('.encrypted-content');
    if (encryptedContent) {
        encryptedContent.style.position = 'relative';
        encryptedContent.appendChild(progressOverlay);
    }
}

function updateDecryptionProgress(messageId, stage, progress) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) return;

    const progressOverlay = messageDiv.querySelector('.decryption-progress');
    if (!progressOverlay) return;

    const stageDiv = progressOverlay.querySelector('.decrypt-stage');
    const progressFill = progressOverlay.querySelector('.progress-fill');
    const progressPercent = progressOverlay.querySelector('.progress-percent');

    if (stageDiv) stageDiv.textContent = stage;
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressPercent) progressPercent.textContent = `${progress}%`;

    if (progress === 100) {
        const spinner = progressOverlay.querySelector('.spinner');
        if (spinner) spinner.style.display = 'none';

        setTimeout(() => {
            if (progressOverlay.parentNode) {
                progressOverlay.style.opacity = '0';
                setTimeout(() => progressOverlay.remove(), 300);
            }
        }, 1000);
    }
}

function updateFileDecryptionProgress(messageId, stage, progress) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) return;

    const progressOverlay = messageDiv.querySelector('.file-decryption-progress');
    if (!progressOverlay) return;

    const stageDiv = progressOverlay.querySelector('.decrypt-stage');
    const progressFill = progressOverlay.querySelector('.progress-fill');
    const progressPercent = progressOverlay.querySelector('.progress-percent');

    if (stageDiv) stageDiv.textContent = stage;
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressPercent) progressPercent.textContent = `${progress}%`;

    if (progress === 100) {
        const spinner = progressOverlay.querySelector('.spinner');
        if (spinner) spinner.style.display = 'none';

        setTimeout(() => {
            if (progressOverlay.parentNode) {
                progressOverlay.style.opacity = '0';
                setTimeout(() => progressOverlay.remove(), 300);
            }
        }, 1000);
    }
}

// Helper function to get encrypted data from message element
function getEncryptedDataFromMessage(messageDiv) {
    const encryptedDataAttr = messageDiv.getAttribute('data-encrypted-info');
    if (encryptedDataAttr) {
        try {
            return JSON.parse(decodeURIComponent(encryptedDataAttr));
        } catch (e) {
            return null;
        }
    }
    return null;
}

// Receiver Progress Functions
function showReceivingProgress(messageData) {
    const progressId = `receiving-${messageData._id}`;

    const progressDiv = document.createElement('div');
    progressDiv.id = progressId;
    progressDiv.classList.add('message', 'bot');
    progressDiv.style.cssText = `
        background: #333;
        padding: 15px;
        margin: 5px 0;
        border-radius: 10px;
        color: white;
        border-left: 4px solid #17a2b8;
        animation: slideIn 0.3s ease;
    `;

    const messageType = messageData.encryptedData.type === 'file'
        ? `📁 Encrypted File: ${messageData.encryptedData.originalFileName}`
        : '💬 Encrypted Message';

    progressDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div class="spinner" style="
                width: 20px; 
                height: 20px; 
                border: 2px solid #555; 
                border-top: 2px solid #17a2b8; 
                border-radius: 50%; 
                animation: spin 1s linear infinite;
            "></div>
            <span>📨 Receiving from ${messageData.sender.name}</span>
        </div>
        <div style="font-size: 0.9em; opacity: 0.8; margin-bottom: 8px;">
            ${messageType}
        </div>
        <div class="progress-bar" style="
            background: #555; 
            height: 8px; 
            border-radius: 4px; 
            overflow: hidden;
        ">
            <div class="progress-fill" style="
                background: linear-gradient(90deg, #17a2b8, #138496); 
                height: 100%; 
                width: 0%; 
                border-radius: 4px; 
                animation: progressPulse 2s ease-in-out infinite;
            "></div>
        </div>
        <div class="progress-text" style="
            font-size: 0.8em; 
            margin-top: 5px; 
            opacity: 0.8;
            text-align: center;
        ">Processing encrypted data...</div>
    `;

    messagesEl.appendChild(progressDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);

            setTimeout(() => {
                completeReceivingProgress(progressId, messageData);
            }, 500);
        }

        const progressFill = progressDiv.querySelector('.progress-fill');
        const progressText = progressDiv.querySelector('.progress-text');

        if (progressFill) {
            progressFill.style.width = `${progress}%`;
            progressFill.style.animation = progress === 100 ? 'none' : 'progressPulse 2s ease-in-out infinite';
        }
        if (progressText) {
            progressText.textContent = progress === 100 ? 'Received!' : `Processing... ${Math.round(progress)}%`;
        }
    }, 200);
}

function completeReceivingProgress(progressId, messageData) {
    const progressDiv = document.getElementById(progressId);
    if (progressDiv) {
        progressDiv.style.transition = 'all 0.5s ease';
        progressDiv.style.transform = 'scale(0.95)';
        progressDiv.style.opacity = '0.8';

        setTimeout(() => {
            progressDiv.remove();
            appendEncryptedMessage(messageData);
            showEncryptedContentNotification(messageData);
        }, 500);
    }
}

function showEncryptedContentNotification(messageData) {
    const notificationDiv = document.createElement('div');
    notificationDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        z-index: 1000;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
    `;

    const contentType = messageData.encryptedData.type === 'file'
        ? `📁 Encrypted file: ${messageData.encryptedData.originalFileName}`
        : '💬 Encrypted message';

    notificationDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
            <div style="font-weight: bold;">🔒 New Encrypted Content</div>
        </div>
        <div style="font-size: 0.9em; opacity: 0.9;">
            From: ${messageData.sender.name}<br>
            ${contentType}
        </div>
        <div style="font-size: 0.8em; opacity: 0.7; margin-top: 8px;">
            Click to decrypt with biometric authentication
        </div>
    `;

    document.body.appendChild(notificationDiv);

    setTimeout(() => {
        notificationDiv.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notificationDiv.parentNode) {
                notificationDiv.remove();
            }
        }, 300);
    }, 5000);
}

function showIncomingMessageAlert(data) {
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 20px;
        border-radius: 15px;
        text-align: center;
        z-index: 1001;
        animation: fadeIn 0.3s ease;
        border: 2px solid #17a2b8;
    `;

    const messageType = data.type === 'file' ? 'file' : 'message';

    alertDiv.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 10px;">📨</div>
        <div style="font-weight: bold; margin-bottom: 5px;">
            Incoming Encrypted ${messageType.charAt(0).toUpperCase() + messageType.slice(1)}
        </div>
        <div style="opacity: 0.8;">
            From: ${data.sender.name}
        </div>
    `;

    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 300);
    }, 2000);
}

// Handle receiver-side progress updates
socket.on('fileUploadStarted', (data) => {
    if (data.sender._id === chatUser._id) {
        // Only show progress if we don't already have one for this file
        if (!document.getElementById(`progress-${data.fileId}`)) {
            showUploadProgress(data.fileId, data.fileName, 'Receiving');
        }
    }
});

socket.on('fileUploadProgress', (data) => {
    if (data.sender._id === chatUser._id) {
        updateUploadProgress(data.fileId, data.progress);
        // ✅ Auto-cleanup when complete
        if (data.progress === 100) {
            setTimeout(() => {
                hideUploadProgress(data.fileId);
            }, 1000); // Give 1 second to see 100%, then remove
        }
    }
});

// Add handler for upload failures
socket.on('fileUploadFailed', (data) => {
    if (data.sender._id === chatUser._id) {
        hideUploadProgress(data.fileId);
    }
});

// Enhanced message confirmation handler for encryption
socket.on('messageConfirmed', (messageData) => {
    // Clean up ALL progress indicators that might be related to this message
    // Clean up upload progress
    cleanupAllProgress();
    const encryptionProgressId = showFileEncryptionProgress(messageData.fileData);
    // Show encryption progress
    sendBtn.innerHTML = 'Encrypting File...';

    // Send for encryption instead of displaying normally
    socket.emit('sendEncryptedFile', {
        senderId: currentUser._id,
        receiverId: chatUser._id,
        fileData: messageData.fileData
    });

    // Clear file input
    fileInput.value = '';
    filePreview.previewContainer.style.display = 'none';
});

// Handle encrypted message confirmation
socket.on('encryptedMessageConfirmed', (messageData) => {
    sendBtn.disabled = false;
    sendBtn.innerHTML = 'Send';

    const encryptionProgress = document.querySelector('[id^="encryption-"]');
    if (encryptionProgress) {
        encryptionProgress.style.opacity = '0';
        setTimeout(() => {
            if (encryptionProgress.parentNode) {
                encryptionProgress.remove();
            }
        }, 300);
    }

    const fileEncryptionProgress = document.querySelector('[id^="file-encryption-"]');
    if (fileEncryptionProgress) {
        fileEncryptionProgress.style.opacity = '0';
        setTimeout(() => {
            if (fileEncryptionProgress.parentNode) {
                fileEncryptionProgress.remove();
            }
        }, 300);
    }

    cleanupAllProgress();
    appendEncryptedMessage(messageData);
});


// Handle receiving encrypted messages
socket.on('receiveEncryptedMessage', (messageData) => {
    if (messageData.sender._id === chatUser._id) {
        // Clean up any progress indicators for this file
        if (messageData.encryptedData && messageData.encryptedData.originalFileName) {
            const fileName = messageData.encryptedData.originalFileName;
            const progressElements = document.querySelectorAll('[id^="progress-"]');
            progressElements.forEach(el => {
                if (el.textContent.includes(fileName) ||
                    el.textContent.includes('Receiving') ||
                    el.textContent.includes(messageData.sender.username)) {
                    el.style.transition = 'opacity 0.3s ease';
                    el.style.opacity = '0';
                    setTimeout(() => {
                        if (el.parentNode) {
                            el.remove();
                        }
                    }, 300);
                }
            });
        }
        showReceivingProgress(messageData);
        if (!document.hidden) {
            // User is actively viewing the chat
            socket.emit('markMessagesAsRead', {
                senderId: messageData.sender._id,
                receiverId: currentUser._id
            });
        } else {
            // User is not actively viewing (tab hidden/minimized)
            showNotification('New Message', `You have a new message from ${messageData.sender.username} ie ${messageData.sender.name}`);
        }
    } else {
        // This is a message from someone else (not the current chat user)
        showNotification('New Message', `You have a new message from ${messageData.sender.username} ie ${messageData.sender.name}`);
    }
});
// Handle incoming encrypted message notifications
socket.on('encryptedMessageIncoming', (data) => {
    if (data.sender._id === chatUser._id) {
        showIncomingMessageAlert(data);
    }
});

// Handle encryption progress updates
socket.on('encryptionProgress', (data) => {
    updateEncryptionProgress(data.stage, data.progress);
});

socket.on('fileEncryptionProgress', (data) => {
    updateFileEncryptionProgress(data.stage, data.progress);
});
// Handle decryption challenge
socket.on('decryptionChallenge', async (data) => {
    try {
        const { messageId, options } = data;

        // Import WebAuthn functions
        const { startAuthentication } = await import('https://cdn.skypack.dev/@simplewebauthn/browser');

        const authResponse = await startAuthentication(options);

        socket.emit('verifyAndDecrypt', {
            messageId: messageId,
            userId: currentUser._id,
            credential: authResponse
        });

    } catch (error) {
        console.error('Authentication failed:', error);
        // ✅ CLEANUP: Remove progress overlay when authentication fails/cancelled
        const messageDiv = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (messageDiv) {
            const progressOverlay = messageDiv.querySelector('.decryption-progress, .file-decryption-progress');
            if (progressOverlay) {
                progressOverlay.style.opacity = '0';
                setTimeout(() => {
                    if (progressOverlay.parentNode) {
                        progressOverlay.remove();
                    }
                }, 300);
            }
        }

        // Show appropriate error message
        if (error.name === 'NotAllowedError') {
            showNotification('Authentication Cancelled', 'Biometric authentication was cancelled');
        } else if (error.name === 'AbortError') {
            showNotification('Authentication Aborted', 'Authentication process was aborted');
        } else {
            showNotification('Authentication Failed', 'Could not verify your identity');
        }
    }
});
// Handle decryption progress updates
socket.on('decryptionProgress', (data) => {
    const messageDiv = document.querySelector(`[data-message-id="${data.messageId}"]`);
    const encryptedData = getEncryptedDataFromMessage(messageDiv);

    if (encryptedData && encryptedData.type === 'file') {
        updateFileDecryptionProgress(data.messageId, data.stage, data.progress);
    } else {
        updateDecryptionProgress(data.messageId, data.stage, data.progress);
    }
})
// Handle successful decryption
socket.on('decryptionSuccess', (data) => {
    const { messageId, type, content, downloadPath, fileName, fileSize, fileType } = data;

    if (type === 'message') {
        showMessagePreview(content, messageId);
    } else if (type === 'file') {
        downloadDecryptedFile(downloadPath, fileName);
    }
});

// Handle decryption errors
socket.on('decryptionError', (data) => {
    console.error('Decryption error:', data.error);
    // ✅ CLEANUP: Remove any stuck progress overlays
    if (data.messageId) {
        cleanupDecryptionProgress(data.messageId);
    }
    showNotification('Decryption Failed', data.error);
});

// Function to request decryption
function requestDecryption(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    const encryptedData = getEncryptedDataFromMessage(messageDiv);

    if (encryptedData && encryptedData.type === 'file') {
        showFileDecryptionProgress(messageId, encryptedData.originalFileName);
    } else {
        showDecryptionProgress(messageId);
    }

    socket.emit('requestDecryptionChallenge', {
        messageId: messageId,
        userId: currentUser._id
    });
}

// Add cleanup function
function cleanupUpload(fileId) {
    hideUploadProgress(fileId);
    sendBtn.disabled = false;
    sendBtn.innerHTML = 'Send';

    // Notify receiver that upload failed
    socket.emit('fileUploadFailed', { fileId: fileId });
}
// Add this helper function to clean up progress overlays
function cleanupDecryptionProgress(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageDiv) {
        const progressOverlay = messageDiv.querySelector('.decryption-progress, .file-decryption-progress');
        if (progressOverlay) {
            progressOverlay.style.transition = 'opacity 0.3s ease';
            progressOverlay.style.opacity = '0';
            setTimeout(() => {
                if (progressOverlay.parentNode) {
                    progressOverlay.remove();
                }
            }, 300);
        }
    }
}
// Function to append encrypted messages
function appendEncryptedMessage(messageData) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    msgDiv.classList.add(messageData.sender._id === currentUser._id ? 'user' : 'bot');
    msgDiv.setAttribute('data-message-id', messageData._id);
    msgDiv.setAttribute('data-encrypted', 'true');

    // Create encrypted image container
    const encryptedContainer = document.createElement('div');
    encryptedContainer.className = 'encrypted-content';
    encryptedContainer.style.cssText = `
        position: relative;
        cursor: pointer;
        border-radius: 10px;
        overflow: hidden;
        max-width: 300px;
        transition: transform 0.2s ease;
    `;

    const encryptedImg = document.createElement('img');
    encryptedImg.src = messageData.encryptedData.imagePath.replace('./public', '');
    encryptedImg.style.cssText = `
        width: 100%;
        height: auto;
        display: block;
    `;

    const overlay = document.createElement('div');
    overlay.className = 'encrypted-overlay';
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        opacity: 0;
        transition: opacity 0.2s ease;
    `;

    const lockIcon = messageData.encryptedData.type === 'file' ? '📁🔒' : '💬🔒';
    const overlayText = messageData.encryptedData.type === 'file'
        ? `${lockIcon} Encrypted File\n${messageData.encryptedData.originalFileName}`
        : `${lockIcon} Encrypted Message`;

    overlay.innerHTML = `<div style="text-align: center; white-space: pre-line;">${overlayText}</div>`;

    // Add hover effects
    encryptedContainer.addEventListener('mouseenter', () => {
        encryptedContainer.style.transform = 'scale(1.02)';
        overlay.style.opacity = '1';
    });

    encryptedContainer.addEventListener('mouseleave', () => {
        encryptedContainer.style.transform = 'scale(1)';
        overlay.style.opacity = '0';
    });

    // Add click handler for decryption
    encryptedContainer.addEventListener('click', () => {
        if (messageData.receiver._id === currentUser._id || messageData.sender._id === currentUser._id) {
            requestDecryption(messageData._id);
        } else {
            showNotification('Access Denied', 'You are not authorized to decrypt this message');
        }
    });

    encryptedContainer.appendChild(encryptedImg);
    encryptedContainer.appendChild(overlay);
    msgDiv.appendChild(encryptedContainer);

    const timeSpan = document.createElement('div');
    timeSpan.className = 'timestamp';
    timeSpan.textContent = new Date(messageData.timestamp).toLocaleTimeString();
    msgDiv.appendChild(timeSpan);

    // Remove "no messages" display if it exists
    const noMessages = messagesEl.querySelector('.no-messages');
    if (noMessages) {
        noMessages.remove();
    }

    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Function to show message preview modal
function showMessagePreview(content, messageId) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        padding: 20px;
    `;

    const previewContainer = document.createElement('div');
    previewContainer.style.cssText = `
        background: #222;
        padding: 30px;
        border-radius: 15px;
        max-width: 80%;
        max-height: 80%;
        overflow-y: auto;
        position: relative;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
        position: absolute;
        top: 15px;
        right: 20px;
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        font-size: 20px;
        width: 35px;
        height: 35px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Decrypted Message';
    title.style.cssText = `
        color: white;
        margin: 0 0 20px 0;
        padding-right: 50px;
    `;

    const messageContent = document.createElement('div');
    messageContent.textContent = content;
    messageContent.style.cssText = `
        color: white;
        font-size: 16px;
        line-height: 1.5;
        word-wrap: break-word;
        background: #333;
        padding: 20px;
        border-radius: 10px;
        border-left: 4px solid #0d6efd;
    `;

    previewContainer.appendChild(closeBtn);
    previewContainer.appendChild(title);
    previewContainer.appendChild(messageContent);
    modal.appendChild(previewContainer);
    document.body.appendChild(modal);

    const closeModal = () => {
        document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Auto-close after 30 seconds
    setTimeout(closeModal, 30000);
}

async function downloadDecryptedFile(downloadPath, fileName) {
    try {
        showNotification('Download Started', `Downloading ${fileName}...`);

        // Fetch the file as a blob
        const response = await fetch(downloadPath);
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();

        // Verify blob has content
        if (blob.size === 0) {
            throw new Error('Downloaded file is empty');
        }

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.target = '_blank';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up blob URL
        window.URL.revokeObjectURL(url);

        showNotification('File Downloaded', `${fileName} has been downloaded successfully`);

        // Now notify server that download is complete
        fetch('/cleanup-decrypted-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filePath: downloadPath })
        }).catch(err => console.error('Cleanup error:', err));

    } catch (error) {
        console.error('Download error:', error);

        // More specific error messages
        let errorMessage = 'Failed to download file';
        if (error.message.includes('404')) {
            errorMessage = 'File no longer available on server';
        } else if (error.message.includes('Network')) {
            errorMessage = 'Network error - check your connection';
        } else if (error.message.includes('empty')) {
            errorMessage = 'Downloaded file is corrupted or empty';
        }

        showNotification('Download Failed', `${fileName}: ${errorMessage}`);

        // Optional: Still try to cleanup on server in case file exists
        fetch('/cleanup-decrypted-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filePath: downloadPath })
        }).catch(err => console.error('Cleanup error after failed download:', err));
    }
}

// Get appropriate file icon based on file type
function getFileIcon(fileType, fileName) {
    if (!fileName || typeof fileName !== 'string') {
        return '📎';
    }

    const extension = fileName.split('.').pop().toLowerCase();

    if (fileType.includes('pdf') || extension === 'pdf') return '📄';
    if (fileType.includes('word') || ['doc', 'docx'].includes(extension)) return '📝';
    if (fileType.includes('excel') || ['xls', 'xlsx'].includes(extension)) return '📊';
    if (fileType.includes('powerpoint') || ['ppt', 'pptx'].includes(extension)) return '📋';
    if (fileType.includes('text') || extension === 'txt') return '📃';
    if (fileType.includes('zip') || ['zip', 'rar', '7z'].includes(extension)) return '🗜️';
    if (fileType.includes('javascript') || extension === 'js') return '📜';
    if (fileType.includes('json') || extension === 'json') return '📋';
    if (['html', 'css', 'php', 'py', 'java', 'cpp', 'c'].includes(extension)) return '💻';

    return '📎';
}

// Show browser notification
function showNotification(title, body) {
    // Request permission if not granted
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body: body,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: 'chat-message', // Prevents multiple notifications
                requireInteraction: true // Keeps notification until user interacts
            });

            // Auto-close after 5 seconds
            setTimeout(() => notification.close(), 5000);

        } else if (Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    showNotification(title, body); // Retry
                }
            });
        }
    }
}

// Request notification permission on page load
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Handle marking messages as read when user returns to the page ie maximise the window
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // User has returned to the page, mark messages as read
        socket.emit('markMessagesAsRead', {
            senderId: chatUser._id,
            receiverId: currentUser._id
        });
    }
});

socket.on('messageError', (error) => {
    console.error('Message error:', error);
    alert('Failed to send message. Please try again.');
    // Re-enable send button if it was disabled
    sendBtn.disabled = false;
    sendBtn.innerHTML = 'Send';

    // Hide any progress indicators
    const progressElements = document.querySelectorAll('[id^="progress-"]');
    progressElements.forEach(el => el.remove());
});

// Event listeners
sendBtn.addEventListener('click', sendMessage);

textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();

        const text = textInput.value.trim();
        const file = fileInput.files[0];

        // Send if there's ANYTHING to send
        if (text || file) {
            sendMessage();
        }
    }
});

// Handle drag and drop file upload - Fix the event handling
messagesEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    messagesEl.style.backgroundColor = 'rgba(13, 110, 253, 0.1)';
});

messagesEl.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

messagesEl.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only remove highlight if we're actually leaving the messages area
    if (!messagesEl.contains(e.relatedTarget)) {
        messagesEl.style.backgroundColor = '';
    }
});

messagesEl.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    messagesEl.style.backgroundColor = '';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];

        // Check file size
        if (file.size > 1024 * 1024 * 1024) {
            alert('File too large. Maximum size is 1GB.');
            return;
        }

        // Set the file to the file input
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;

        // Trigger the change event to show preview
        const changeEvent = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(changeEvent);

        // Focus on text input for optional message
        textInput.focus();
    }
});

// Add drag and drop to input area too
const inputArea = document.querySelector('.input-area');
if (inputArea) {
    inputArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        inputArea.style.backgroundColor = 'rgba(13, 110, 253, 0.1)';
        inputArea.style.border = '2px dashed #0d6efd';
    });

    inputArea.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    inputArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!inputArea.contains(e.relatedTarget)) {
            inputArea.style.backgroundColor = '';
            inputArea.style.border = '';
        }
    });

    inputArea.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        inputArea.style.backgroundColor = '';
        inputArea.style.border = '';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];

            // Check file size
            if (file.size > 1024 * 1024 * 1024) {
                alert('File too large. Maximum size is 1GB.');
                return;
            }

            // Set the file to the file input
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;

            // Trigger the change event to show preview
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));

            // Focus on text input for optional message
            textInput.focus();
        }
    });
}

// Handle paste events for files
textInput.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    const files = e.clipboardData.files; // Add this line to also check files array

    // First check clipboardData.files (for copied files from file explorer)
    if (files && files.length > 0) {
        e.preventDefault();

        const file = files[0];
        if (file.size > 1024 * 1024 * 1024) {
            alert('File too large. Maximum size is 1GB.');
            return;
        }

        // Set the file to the file input
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;

        // Trigger the change event to show preview
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        return;
    }

    // Fallback to checking items (for other paste scenarios)
    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.kind === 'file') {
            e.preventDefault();

            const file = item.getAsFile();
            if (file) {
                // Check file size
                if (file.size > 1024 * 1024 * 1024) {
                    alert('File too large. Maximum size is 1GB.');
                    return;
                }

                // Set the file to the file input
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;

                // Trigger the change event to show preview
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            break;
        }
    }
});

// Auto-resize text input
textInput.addEventListener('input', () => {
    textInput.style.height = 'auto';
    textInput.style.height = Math.min(textInput.scrollHeight, 120) + 'px';
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    socket.disconnect();
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to send message
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
});

// Prevent default drag behaviors on the entire document
document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.addEventListener('drop', (e) => {
    // Only prevent default if the drop is not on our messages area
    if (!messagesEl.contains(e.target)) {
        e.preventDefault();
    }
});
