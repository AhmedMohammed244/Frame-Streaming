const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs-extra");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

const app = express();
const PORT = 5000;

// Enable CORS
app.use(cors());
app.use(express.static("public"));
app.use(express.json());

// Define storage for uploaded files
const upload = multer({ dest: "uploads/" });

// Path to store extracted frames and the final video
const FRAMES_FOLDER = path.join(__dirname, "public", "frames");
const VIDEO_FOLDER = path.join(__dirname, "public", "videos");

// Ensure directories exist
fs.ensureDirSync(FRAMES_FOLDER);
fs.ensureDirSync(VIDEO_FOLDER);

// Allowed video file extensions
const ALLOWED_EXTENSIONS = new Set(["mp4", "mov", "avi", "mkv", "flv"]);

const isValidFile = (filename) => {
    return ALLOWED_EXTENSIONS.has(path.extname(filename).toLowerCase().substring(1));
};

// Serve the main HTML page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "main.html"));
});

// Serve extracted frames and videos
app.use("/frames", express.static(FRAMES_FOLDER));
app.use("/videos", express.static(VIDEO_FOLDER));

// Function to get the video's FPS dynamically
const getVideoFPS = (videoPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) return reject(err);
            const fps = metadata.streams.find(s => s.codec_type === "video")?.r_frame_rate;
            if (!fps) return reject("FPS not found");
            
            const fpsValue = eval(fps); 
            resolve(fpsValue);
        });
    });
};

// Handle video upload and frame extraction
app.post("/extract-frames", upload.single("video"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const videoFilePath = req.file.path;
    const videoFilename = req.file.originalname;

    if (!isValidFile(videoFilename)) {
        return res.status(400).json({ success: false, message: "Invalid file type" });
    }

    try {
        // Clear old frames before extracting new ones
        fs.emptyDirSync(FRAMES_FOLDER);

        // Get actual FPS dynamically
        const fps = await getVideoFPS(videoFilePath);

        // Extract frames using FFmpeg with dynamic FPS
        const outputPattern = path.join(FRAMES_FOLDER, "frame_%04d.jpg");

        await new Promise((resolve, reject) => {
            ffmpeg(videoFilePath)
                .output(outputPattern)
                .outputOptions([`-vf`, `fps=${fps}`]) // Use detected FPS
                .on("end", resolve)
                .on("error", reject)
                .run();
        });

        // Get extracted frame filenames
        const frames = fs.readdirSync(FRAMES_FOLDER).map(file => `/frames/${file}`);

        // Cleanup uploaded video
        fs.unlinkSync(videoFilePath);

        res.json({ success: true, frames });
    } catch (error) {
        console.error("Error extracting frames:", error);
        res.status(500).json({ success: false, message: "Frame extraction failed" });
    }
});

// Generate video from selected frames
app.post("/generate-video", async (req, res) => {
    const { frames, frameRate, duration } = req.body;
    
    const outputVideoPath = path.join(VIDEO_FOLDER, `generated_video_${Date.now()}.mp4`);

    // Create a temporary file with frame paths for ffmpeg
    const framePaths = frames.map(frame => path.join(__dirname, 'public', frame));
    
    try {
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(`concat:${framePaths.join('|')}`)
                .inputOptions('-f image2pipe')
                .output(outputVideoPath)
                .outputOptions('-r', frameRate)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        res.json({ success: true, videoUrl: `/videos/${path.basename(outputVideoPath)}` });
    } catch (error) {
        console.error("Error generating video:", error);
        res.status(500).json({ success: false, message: "Video generation failed" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});