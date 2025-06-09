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
    const fileContents = document.querySelectorAll('.file-content');
    fileContents.forEach(container => {
        const encodedData = container.dataset.file;
        if (encodedData) {
            try {
                const fileData = JSON.parse(decodeURIComponent(encodedData));
                renderFileContent(container, fileData);
            } catch (error) {
                console.error('Error parsing file data:', error);
            }
        }
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

// Enhanced file sending with progress tracking
function sendMessage() {
    const text = textInput.value.trim();
    const file = fileInput.files[0];

    if (!text && !file) return;

    if (file) {
        sendFileWithProgress(file, text);
    } else {
        // Send text message only
        socket.emit('sendMessage', {
            senderId: currentUser._id,
            receiverId: chatUser._id,
            message: text,
            fileData: null
        });
    }
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
        progressDiv.remove();
    }
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
    }
});

// Add handler for upload failures
socket.on('fileUploadFailed', (data) => {
    if (data.sender._id === chatUser._id) {
        hideUploadProgress(data.fileId);
    }
});

// Enhanced message confirmation handler
socket.on('messageConfirmed', (messageData) => {
    // Clean up ALL progress indicators that might be related to this message
    if (messageData.fileData) {
        const fileName = messageData.fileData.originalName || messageData.fileData.name;
        if (fileName) {
            // Remove progress indicators by filename match
            const progressElements = document.querySelectorAll('[id^="progress-"]');
            progressElements.forEach(el => {
                if (el.textContent.includes(fileName)) {
                    el.remove();
                }
            });
        }
    }

    // Reset UI state of the sender frontend
    sendBtn.disabled = false;
    sendBtn.innerHTML = 'Send';
    textInput.value = '';
    fileInput.value = '';
    filePreview.previewContainer.style.display = 'none';

    appendMessage(messageData);
});

// Add cleanup function
function cleanupUpload(fileId) {
    hideUploadProgress(fileId);
    sendBtn.disabled = false;
    sendBtn.innerHTML = 'Send';

    // Notify receiver that upload failed
    socket.emit('fileUploadFailed', { fileId: fileId });
}

// Add CSS for spinner animation
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Create modal for media viewing 
function createMediaModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        padding: 20px;
    `;

    const mediaContainer = document.createElement('div');
    mediaContainer.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 15px;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 30px;
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        font-size: 24px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease;
    `;

    const downloadBtn = document.createElement('button');
    downloadBtn.innerHTML = '⬇️ Download';
    downloadBtn.style.cssText = `
        background: #0d6efd;
        border: none;
        color: white;
        padding: 10px 20px;
        border-radius: 25px;
        cursor: pointer;
        font-weight: bold;
        font-size: 14px;
        transition: background 0.2s ease;
    `;

    modal.appendChild(mediaContainer);
    modal.appendChild(closeBtn);
    mediaContainer.appendChild(downloadBtn);
    document.body.appendChild(modal);

    let currentMediaType = null;

    const closeModal = () => {
        modal.style.display = 'none';
        mediaContainer.innerHTML = '';
        mediaContainer.appendChild(downloadBtn);
        currentMediaType = null;
    };

    modal.addEventListener('click', (e) => {
        if (e.target === modal && currentMediaType === 'image') {
            closeModal();
        }
    });

    closeBtn.addEventListener('click', closeModal);

    return {
        modal,
        mediaContainer,
        downloadBtn,
        closeModal,
        setMediaType: (type) => { currentMediaType = type; }
    };
}

const mediaModal = createMediaModal();

// Enhanced file content rendering 
function renderFileContent(container, fileData) {
    // Add safety check for fileData
    if (!fileData) {
        console.error('Invalid fileData:', fileData);
        return;
    }

    // Determine file source - prioritize file path over base64 data
    const fileSrc = fileData.path || fileData.data;
    const fileName = fileData.originalName || fileData.name || 'Unknown file';
    const fileType = fileData.type;
    const fileSize = fileData.size;

    if (!fileSrc || !fileType) {
        console.error('Missing file source or type:', fileData);
        return;
    }
    if (fileType.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = fileSrc;
        img.style.cssText = `
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.2s ease;
        `;
        img.title = 'Click to view full size';

        img.addEventListener('mouseenter', () => {
            img.style.transform = 'scale(1.02)';
        });

        img.addEventListener('mouseleave', () => {
            img.style.transform = 'scale(1)';
        });

        img.addEventListener('click', () => {
            const modalImg = document.createElement('img');
            modalImg.src = fileSrc;
            modalImg.style.cssText = `
                max-width: 100%;
                max-height: 80vh;
                object-fit: contain;
                border-radius: 10px;
            `;

            mediaModal.setMediaType('image');
            mediaModal.mediaContainer.insertBefore(modalImg, mediaModal.downloadBtn);
            mediaModal.downloadBtn.onclick = () => downloadFile(fileSrc, fileName);
            mediaModal.modal.style.display = 'flex';
        });

        container.appendChild(img);

    } else if (fileData.type.startsWith('video/')) {
        const videoContainer = document.createElement('div');
        videoContainer.style.cssText = `
            background: #333;
            padding: 15px;
            border-radius: 10px;
            margin-top: 8px;
            cursor: pointer;
            transition: background 0.2s ease;
            border: 2px solid transparent;
        `;
        videoContainer.title = 'Click for enhanced video player';

        const video = document.createElement('video');
        video.controls = true;
        video.src = fileSrc;
        video.style.cssText = `
            width: 100%;
            max-height: 300px;
            border-radius: 8px;
        `;

        const videoInfo = document.createElement('div');
        videoInfo.style.cssText = `
            font-size: 0.85em;
            margin-bottom: 8px;
            opacity: 0.8;
            color: white;
        `;
        videoInfo.innerHTML = `🎬 ${fileName} (${formatFileSize(fileSize)})`;

        videoContainer.appendChild(videoInfo);
        videoContainer.appendChild(video);

        // Add hover effects
        videoContainer.addEventListener('mouseenter', () => {
            videoContainer.style.background = '#444';
            videoContainer.style.borderColor = '#0d6efd';
        });

        videoContainer.addEventListener('mouseleave', () => {
            videoContainer.style.background = '#333';
            videoContainer.style.borderColor = 'transparent';
        });

        // Add click event to open in modal
        videoContainer.addEventListener('click', (e) => {
            if (e.target === video || video.contains(e.target)) return;

            video.pause();

            const modalVideoContainer = document.createElement('div');
            modalVideoContainer.style.cssText = `
                background: #222;
                padding: 30px;
                border-radius: 15px;
                text-align: center;
                min-width: 600px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            `;

            const modalVideoTitle = document.createElement('h3');
            modalVideoTitle.textContent = fileName;
            modalVideoTitle.style.cssText = `
                color: white;
                margin: 0 0 20px 0;
                font-size: 1.2em;
            `;

            const modalVideo = document.createElement('video');
            modalVideo.src = fileSrc;
            modalVideo.controls = true;
            modalVideo.autoplay = true;
            modalVideo.style.cssText = `
                width: 100%;
                max-height: 70vh;
                margin: 20px 0;
                border-radius: 10px;
            `;

            modalVideoContainer.appendChild(modalVideoTitle);
            modalVideoContainer.appendChild(modalVideo);

            mediaModal.setMediaType('video');
            mediaModal.mediaContainer.insertBefore(modalVideoContainer, mediaModal.downloadBtn);
            mediaModal.downloadBtn.onclick = () => downloadFile(fileSrc, fileName);
            mediaModal.modal.style.display = 'flex';
        });

        container.appendChild(videoContainer);

    } else if (fileData.type.startsWith('audio/')) {
        const audioContainer = document.createElement('div');
        audioContainer.style.cssText = `
            background: #333;
            padding: 15px;
            border-radius: 10px;
            margin-top: 8px;
            cursor: pointer;
            transition: background 0.2s ease;
            border: 2px solid transparent;
        `;
        audioContainer.title = 'Click for enhanced audio player';

        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = fileSrc;
        audio.style.width = '100%';

        const audioInfo = document.createElement('div');
        audioInfo.style.cssText = `
            font-size: 0.85em;
            margin-bottom: 8px;
            opacity: 0.8;
            color: white;
        `;
        audioInfo.innerHTML = `🎵 ${fileName} (${formatFileSize(fileSize)})`;

        audioContainer.appendChild(audioInfo);
        audioContainer.appendChild(audio);

        audioContainer.addEventListener('mouseenter', () => {
            audioContainer.style.background = '#444';
            audioContainer.style.borderColor = '#0d6efd';
        });

        audioContainer.addEventListener('mouseleave', () => {
            audioContainer.style.background = '#333';
            audioContainer.style.borderColor = 'transparent';
        });

        audioContainer.addEventListener('click', (e) => {
            if (e.target === audio || audio.contains(e.target)) return;

            audio.pause();

            const modalAudioContainer = document.createElement('div');
            modalAudioContainer.style.cssText = `
                background: #222;
                padding: 30px;
                border-radius: 15px;
                text-align: center;
                min-width: 400px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            `;

            const modalAudioTitle = document.createElement('h3');
            modalAudioTitle.textContent = fileName;
            modalAudioTitle.style.cssText = `
                color: white;
                margin: 0 0 20px 0;
                font-size: 1.2em;
            `;

            const modalAudio = document.createElement('audio');
            modalAudio.src = fileSrc;
            modalAudio.controls = true;
            modalAudio.autoplay = true;
            modalAudio.style.cssText = `
                width: 100%;
                margin: 20px 0;
            `;

            modalAudioContainer.appendChild(modalAudioTitle);
            modalAudioContainer.appendChild(modalAudio);

            mediaModal.setMediaType('audio');
            mediaModal.mediaContainer.insertBefore(modalAudioContainer, mediaModal.downloadBtn);
            mediaModal.downloadBtn.onclick = () => downloadFile(fileSrc, fileName);
            mediaModal.modal.style.display = 'flex';
        });

        container.appendChild(audioContainer);

    } else {
        // Other file types
        const fileIcon = getFileIcon(fileData.type, fileName);
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.style.cssText = `
            background: #333;
            padding: 15px;
            border-radius: 10px;
            margin-top: 8px;
            cursor: pointer;
            transition: background 0.2s ease;
            border: 2px solid transparent;
        `;
        fileInfo.title = 'Click to download';

        fileInfo.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">${fileIcon}</span>
                <div style="color: white;">
                    <div style="font-weight: bold;">${fileName}</div>
                    <div style="opacity: 0.7; font-size: 0.8em;">${formatFileSize(fileSize)}</div>
                </div>
            </div>
        `;

        fileInfo.addEventListener('click', () => {
            downloadFile(fileSrc, fileName);
        });

        fileInfo.addEventListener('mouseenter', () => {
            fileInfo.style.background = '#444';
            fileInfo.style.borderColor = '#0d6efd';
        });

        fileInfo.addEventListener('mouseleave', () => {
            fileInfo.style.background = '#333';
            fileInfo.style.borderColor = 'transparent';
        });

        container.appendChild(fileInfo);
    }
}

// Download file function
function downloadFile(fileData, fileName) {
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

// Append message to chat
function appendMessage(messageData) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    msgDiv.classList.add(messageData.sender._id === currentUser._id ? 'user' : 'bot');
    msgDiv.setAttribute('data-message-id', messageData._id);

    if (messageData.message) {
        const p = document.createElement('p');
        p.textContent = messageData.message;
        msgDiv.appendChild(p);
    }

    if (messageData.fileData) {
        const fileContainer = document.createElement('div');
        fileContainer.className = 'file-content';
        renderFileContent(fileContainer, messageData.fileData);
        msgDiv.appendChild(fileContainer);
    }

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


socket.on('receiveMessage', (messageData) => {
    // Check if message is from the chat user (not from current user)
    if (messageData.sender._id === chatUser._id) {
        // Clean up progress indicators for received files
        if (messageData.fileData) {
            const fileName = messageData.fileData.originalName || messageData.fileData.name;
            if (fileName) {
                const progressElements = document.querySelectorAll('[id^="progress-"]');
                progressElements.forEach(el => {
                    if (el.textContent.includes(fileName)) {
                        el.remove();
                    }
                });
            }
        }

        if (!document.hidden) {
            appendMessage(messageData);
            socket.emit('markMessagesAsRead', {
                senderId: messageData.sender._id,
                receiverId: currentUser._id
            });
        } else {
            appendMessage(messageData);
            showNotification('New Message', `You have a new message from ${messageData.sender.username} ie ${messageData.sender.name}`);
        }
    } else {
        // This is a message from someone else (not the current chat user)
        showNotification('New Message', `You have a new message from ${messageData.sender.username} ie ${messageData.sender.name}`);
    }
});
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

    // Escape to close modal
    if (e.key === 'Escape') {
        if (mediaModal.modal.style.display === 'flex') {
            mediaModal.closeModal();
        }
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
