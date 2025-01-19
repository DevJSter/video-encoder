const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { promisify } = require("util");
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

const app = express();

// Enable CORS
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["POST", "GET"],
    allowedHeaders: ["Content-Type"],
  })
);

// Configure multer to store files in memory
const upload = multer({
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

// Create temp directory if it doesn't exist
const tempDir = path.join(os.tmpdir(), "video-transcoder");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Define resolutions
const RESOLUTIONS = {
  "360p": { width: 640, height: 360 },
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
};

// Helper function to save buffer to temp file
async function saveBufferToTemp(buffer) {
  const tempFilePath = path.join(tempDir, `input-${Date.now()}.mp4`);
  await writeFileAsync(tempFilePath, buffer);
  return tempFilePath;
}

// Helper function to transcode video
function transcodeVideo(inputPath, resolution) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(
      tempDir,
      `output-${Date.now()}-${resolution}.mp4`
    );
    const { width, height } = RESOLUTIONS[resolution];

    ffmpeg(inputPath)
      .size(`${width}x${height}`)
      .format("mp4")
      .outputOptions([
        "-movflags frag_keyframe+empty_moov",
        "-c:v libx264",
        "-preset fast",
        "-crf 22",
        "-c:a aac",
        "-b:a 128k",
      ])
      .on("start", (commandLine) => {
        console.log(`Starting transcoding for ${resolution}: ${commandLine}`);
      })
      .on("progress", (progress) => {
        console.log(`Progress for ${resolution}: ${progress.percent}%`);
      })
      .on("error", (err) => {
        console.error(`Transcoding error for ${resolution}:`, err);
        reject(err);
      })
      .on("end", () => {
        console.log(`Transcoding finished for ${resolution}`);
        resolve(outputPath);
      })
      .save(outputPath);
  });
}

// Single resolution transcoding endpoint
app.post("/transcode", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No video file provided" });
  }

  const resolution = req.query.resolution || "720p";
  let inputPath = null;
  let outputPath = null;

  try {
    // Save uploaded file to temp location
    inputPath = await saveBufferToTemp(req.file.buffer);
    console.log("Saved input file to:", inputPath);

    // Transcode the video
    outputPath = await transcodeVideo(inputPath, resolution);
    console.log("Transcoding completed, output at:", outputPath);

    // Stream the result back to client
    res.setHeader("Content-Type", "video/mp4");
    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);

    // Clean up files after streaming
    fileStream.on("end", async () => {
      try {
        await unlinkAsync(inputPath);
        await unlinkAsync(outputPath);
        console.log("Cleaned up temporary files");
      } catch (err) {
        console.error("Error cleaning up files:", err);
      }
    });
  } catch (error) {
    console.error("Error during transcoding:", error);

    // Clean up files in case of error
    try {
      if (inputPath) await unlinkAsync(inputPath);
      if (outputPath) await unlinkAsync(outputPath);
    } catch (cleanupError) {
      console.error("Error cleaning up files:", cleanupError);
    }

    res
      .status(500)
      .json({ error: "Transcoding failed", details: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large (max 100MB)" });
    }
  }
  console.error("Server error:", error);
  res
    .status(500)
    .json({ error: "Internal server error", details: error.message });
});

// Cleanup old temporary files periodically
setInterval(async () => {
  try {
    const files = await fs.promises.readdir(tempDir);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.promises.stat(filePath);
      // Remove files older than 1 hour
      if (now - stats.mtime.getTime() > 60 * 60 * 1000) {
        await unlinkAsync(filePath);
        console.log("Cleaned up old file:", file);
      }
    }
  } catch (err) {
    console.error("Error during cleanup:", err);
  }
}, 30 * 60 * 1000); // Run every 30 minutes

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
