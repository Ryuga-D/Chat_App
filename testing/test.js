const messagesEl = document.getElementById('messages');
const textInput = document.getElementById('textInput');
const fileInput = document.getElementById('fileInput');
const sendBtn = document.getElementById('sendBtn');

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

    // Insert preview container before input area
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
                <div style="opacity: 0.7; font-size: 0.8em;">${Math.round(file.size / 1024)} KB</div>
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
                <div style="opacity: 0.7; font-size: 0.8em;">${Math.round(file.size / 1024)} KB</div>
            `;

            filePreview.previewContent.appendChild(video);
            filePreview.previewContent.appendChild(fileInfo);
        };
        reader.readAsDataURL(file);

    } else if (file.type.startsWith('audio/')) {
        const fileInfo = document.createElement('div');
        fileInfo.style.cssText = `
            color: white;
            font-size: 0.9em;
            display: flex;
            align-items: center;
            gap: 10px;
        `;

        const audioIcon = document.createElement('div');
        audioIcon.style.cssText = `
            width: 40px;
            height: 40px;
            background: #0d6efd;
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        `;
        audioIcon.innerHTML = '🎵';

        const audioInfo = document.createElement('div');
        audioInfo.innerHTML = `
            <div style="font-weight: bold;">${file.name}</div>
            <div style="opacity: 0.7; font-size: 0.8em;">${Math.round(file.size / 1024)} KB</div>
        `;

        fileInfo.appendChild(audioIcon);
        fileInfo.appendChild(audioInfo);
        filePreview.previewContent.appendChild(fileInfo);

    } else {
        // Other file types
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
            <div style="opacity: 0.7; font-size: 0.8em;">${Math.round(file.size / 1024)} KB</div>
        `;

        fileInfo.appendChild(iconDiv);
        fileInfo.appendChild(fileInfoText);
        filePreview.previewContent.appendChild(fileInfo);
    }

    filePreview.previewContainer.style.display = 'flex';
});

// Create modal for media viewing (images, videos, audio)
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

    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'rgba(255,255,255,0.3)';
    });

    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'rgba(255,255,255,0.2)';
    });

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

    downloadBtn.addEventListener('mouseenter', () => {
        downloadBtn.style.background = '#0b5ed7';
    });

    downloadBtn.addEventListener('mouseleave', () => {
        downloadBtn.style.background = '#0d6efd';
    });

    modal.appendChild(mediaContainer);
    modal.appendChild(closeBtn);
    mediaContainer.appendChild(downloadBtn);
    document.body.appendChild(modal);

    let currentMediaType = null;
    let originalAudioElement = null;
    let originalVideoElement = null;

    const closeModal = () => {
        modal.style.display = 'none';
        mediaContainer.innerHTML = '';
        mediaContainer.appendChild(downloadBtn);
        currentMediaType = null;
        originalAudioElement = null;
        originalVideoElement = null;
    };

    // Only close on outside click for images, not for audio/video
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
        setMediaType: (type) => { currentMediaType = type; },
        setOriginalAudio: (audioEl) => { originalAudioElement = audioEl; },
        getOriginalAudio: () => originalAudioElement,
        setOriginalVideo: (videoEl) => { originalVideoElement = videoEl; },
        getOriginalVideo: () => originalVideoElement
    };
}

const mediaModal = createMediaModal();

// Append message to chat
function appendMessage({ sender, text, file }) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);

    if (text) {
        const p = document.createElement('p');
        p.textContent = text;
        msgDiv.appendChild(p);
    }

    if (file) {
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = file.data;
            img.style.cursor = 'pointer';
            img.title = 'Click to view full size';

            // Add click event to view image in modal
            img.addEventListener('click', () => {
                const modalImg = document.createElement('img');
                modalImg.src = file.data;
                modalImg.style.cssText = `
                    max-width: 100%;
                    max-height: 80vh;
                    object-fit: contain;
                    border-radius: 10px;
                `;

                mediaModal.setMediaType('image');
                mediaModal.mediaContainer.insertBefore(modalImg, mediaModal.downloadBtn);
                mediaModal.downloadBtn.onclick = () => downloadFile(file.data, file.name);
                mediaModal.modal.style.display = 'flex';
            });

            msgDiv.appendChild(img);

        } else if (file.type.startsWith('video/')) {
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
    video.src = file.data;
    video.style.width = '100%';
    
    const videoInfo = document.createElement('div');
    videoInfo.style.cssText = `
        font-size: 0.85em;
        margin-bottom: 8px;
        opacity: 0.8;
    `;
    videoInfo.innerHTML = `🎬 ${file.name}`;
    
    videoContainer.appendChild(videoInfo);
    videoContainer.appendChild(video);
    
    // Hover effects
    videoContainer.addEventListener('mouseenter', () => {
        videoContainer.style.background = '#444';
        videoContainer.style.borderColor = '#0d6efd';
    });
    
    videoContainer.addEventListener('mouseleave', () => {
        videoContainer.style.background = '#333';
        videoContainer.style.borderColor = 'transparent';
    });
    
    // Add click event to view video in modal with enhanced player
    videoContainer.addEventListener('click', (e) => {
        // Don't trigger if clicking on video controls
        if (e.target === video || video.contains(e.target)) return;
        
        // Pause the original video before opening modal
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
        modalVideoTitle.textContent = file.name;
        modalVideoTitle.style.cssText = `
            color: white;
            margin: 0 0 20px 0;
            font-size: 1.2em;
        `;
        
        const modalVideo = document.createElement('video');
        modalVideo.src = file.data;
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
        mediaModal.setOriginalVideo(video);
        mediaModal.mediaContainer.insertBefore(modalVideoContainer, mediaModal.downloadBtn);
        mediaModal.downloadBtn.onclick = () => downloadFile(file.data, file.name);
        mediaModal.modal.style.display = 'flex';
    });
    
    msgDiv.appendChild(videoContainer);

        } else if (file.type.startsWith('audio/')) {
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
            audio.src = file.data;
            audio.style.width = '100%';

            const audioInfo = document.createElement('div');
            audioInfo.style.cssText = `
                font-size: 0.85em;
                margin-bottom: 8px;
                opacity: 0.8;
            `;
            audioInfo.innerHTML = `🎵 ${file.name}`;

            audioContainer.appendChild(audioInfo);
            audioContainer.appendChild(audio);

            // Hover effects
            audioContainer.addEventListener('mouseenter', () => {
                audioContainer.style.background = '#444';
                audioContainer.style.borderColor = '#0d6efd';
            });

            audioContainer.addEventListener('mouseleave', () => {
                audioContainer.style.background = '#333';
                audioContainer.style.borderColor = 'transparent';
            });

            // Add click event to view audio in modal with enhanced player
            audioContainer.addEventListener('click', (e) => {
                // Don't trigger if clicking on audio controls
                if (e.target === audio || audio.contains(e.target)) return;

                // Pause the original audio before opening modal
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
                modalAudioTitle.textContent = file.name;
                modalAudioTitle.style.cssText = `
                    color: white;
                    margin: 0 0 20px 0;
                    font-size: 1.2em;
                `;

                const modalAudio = document.createElement('audio');
                modalAudio.src = file.data;
                modalAudio.controls = true;
                modalAudio.autoplay = true;
                modalAudio.style.cssText = `
                    width: 100%;
                    margin: 20px 0;
                `;

                modalAudioContainer.appendChild(modalAudioTitle);
                modalAudioContainer.appendChild(modalAudio);

                mediaModal.setMediaType('audio');
                mediaModal.setOriginalAudio(audio);
                mediaModal.mediaContainer.insertBefore(modalAudioContainer, mediaModal.downloadBtn);
                mediaModal.downloadBtn.onclick = () => downloadFile(file.data, file.name);
                mediaModal.modal.style.display = 'flex';
            });

            msgDiv.appendChild(audioContainer);

        } else {
            // Create downloadable file link
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            fileInfo.style.cursor = 'pointer';
            fileInfo.title = 'Click to download';

            const fileIcon = getFileIcon(file.type, file.name);
            fileInfo.innerHTML = `
                <span style="margin-right: 8px;">${fileIcon}</span>
                <span>${file.name}</span>
                <br>
                <small style="opacity: 0.7;">${Math.round(file.size / 1024)} KB - Click to download</small>
            `;

            // Add click event to download file
            fileInfo.addEventListener('click', () => {
                downloadFile(file.data, file.name);
            });

            msgDiv.appendChild(fileInfo);
        }
    }

    const timeSpan = document.createElement('div');
    timeSpan.className = 'timestamp';
    timeSpan.textContent = new Date().toLocaleTimeString();
    msgDiv.appendChild(timeSpan);

    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Download file function
function downloadFile(fileData, fileName) {
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Get appropriate file icon based on file type
function getFileIcon(fileType, fileName) {
    const extension = fileName.split('.').pop().toLowerCase();

    if (fileType.includes('pdf') || extension === 'pdf') return '📄';
    if (fileType.includes('word') || ['doc', 'docx'].includes(extension)) return '📝';
    if (fileType.includes('excel') || ['xls', 'xlsx'].includes(extension)) return '📊';
    if (fileType.includes('powerpoint') || ['ppt', 'pptx'].includes(extension)) return '📋';
    if (fileType.includes('text') || extension === 'txt') return '📃';
    if (fileType.includes('zip') || ['zip', 'rar', '7z'].includes(extension)) return '🗜️';

    return '📎'; // Default file icon
}

// Handle sending message
function sendMessage() {
    const text = textInput.value.trim();
    if (!text && !fileInput.files.length) return;

    if (fileInput.files.length) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            appendMessage({
                sender: 'user',
                text,
                file: {
                    data: reader.result,
                    type: file.type,
                    name: file.name,
                    size: file.size
                }
            });
            textInput.value = '';
            fileInput.value = '';
            // Hide file preview after sending
            filePreview.previewContainer.style.display = 'none';
            simulateBotReply();
        };
        reader.readAsDataURL(file);
    } else {
        appendMessage({ sender: 'user', text });
        textInput.value = '';
        simulateBotReply();
    }
}

// Simulate a bot reply after 1.5s
function simulateBotReply() {
    setTimeout(() => {
        appendMessage({ sender: 'bot', text: 'This is a reply from the bot.' });
    }, 1500);
}

sendBtn.addEventListener('click', sendMessage);
textInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendMessage();
});

