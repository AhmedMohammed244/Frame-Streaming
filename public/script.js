// Trigger the file input when clicking on the drag area
document.getElementById('drag-area').addEventListener('click', function() {
    document.getElementById('video-input').click();
});

// Handle video file selection and drag-and-drop
document.getElementById('video-input').addEventListener('change', function(event) {
    const files = event.target.files;
    if (files.length > 0) {
        const videoFile = files[0];
        if (videoFile.type.includes('video')) {
            document.getElementById('drag-area').querySelector('p').textContent = `Video: ${videoFile.name} selected`;
        } else {
            alert('Please select a valid video file');
        }
    }
});

// Handle the extract button click
document.getElementById('extract-btn').addEventListener('click', async function() {
    const videoFile = document.getElementById('video-input').files[0];
    if (!videoFile) {
        alert('Please upload a video file first');
        return;
    }

    const formData = new FormData();
    formData.append('video', videoFile);

    try {
        const response = await fetch('http://127.0.0.1:5000/extract-frames', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            window.framesData = data.frames;  // Store the frames data
            alert(`Frames extracted: ${data.frames.length}`);
        } else {
            alert('Frame extraction failed');
        }
    } catch (error) {
        console.error('Error extracting frames:', error);
    }
});

// Handle the collect button click to generate video
document.getElementById('collect-btn').addEventListener('click', async function() {
    const frameCount = parseInt(document.getElementById('frame-count').value);
    const frameTime = parseInt(document.getElementById('frame-time').value);

    // Validate user inputs
    if (!frameCount || !frameTime) {
        alert('Please enter both frame count and time');
        return;
    }

    const totalFrames = window.framesData.length;
    const framesPerSecond = frameCount;
    const durationInSeconds = frameTime;

    const totalFramesNeeded = framesPerSecond * durationInSeconds;

    if (totalFramesNeeded > totalFrames) {
        alert('The total number of frames exceeds available frames. Please reduce the time or frame count.');
        return;
    }

    // Calculate the frames to be used
    const framesToUse = [];
    for (let i = 0; i < durationInSeconds; i++) {
        const startFrame = i * framesPerSecond;
        const endFrame = startFrame + framesPerSecond;
        framesToUse.push(...window.framesData.slice(startFrame, endFrame));
    }

    // Send the request to generate the video stream
    try {
        const response = await fetch('http://127.0.0.1:5000/generate-video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                frames: framesToUse,
                frameRate: framesPerSecond,
                duration: durationInSeconds
            })
        });

        const data = await response.json();
        if (data.success) {
            const videoElement = document.getElementById('video-screen');
            videoElement.src = data.videoUrl;  // Display video URL
            videoElement.play();
        } else {
            alert('Failed to create video');
        }
    } catch (error) {
        console.error('Error generating video:', error);
    }
});