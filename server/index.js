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

app.use(
  cors({
    origin: ["http://localhost:3000","https://video-encoder-chi.vercel.app"],
    methods: ["POST", "GET"],
    allowedHeaders: ["Content-Type"],
  })
);

const upload = multer({
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit cause we have limited computing power
  },
});

const tempDir = path.join(os.tmpdir(), "video-transcoder");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

const RESOLUTIONS = {
  "360p": { width: 640, height: 360, bitrate: "800k" },
  "720p": { width: 1280, height: 720, bitrate: "2500k" },
  "1080p": { width: 1920, height: 1080, bitrate: "5000k" },
};

async function saveBufferToTemp(buffer) {
  const tempFilePath = path.join(tempDir, `input-${Date.now()}.mp4`);
  await writeFileAsync(tempFilePath, buffer);
  return tempFilePath;
}

function transcodeVideo(inputPath, resolution) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(
      tempDir,
      `output-${Date.now()}-${resolution}.mp4`
    );
    const { width, height, bitrate } = RESOLUTIONS[resolution];

    ffmpeg(inputPath)
      .size(`${width}x${height}`)
      .videoBitrate(bitrate)
      .format("mp4")
      .outputOptions([
        "-movflags frag_keyframe+empty_moov",
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        "-c:a aac",
        "-b:a 128k",
        "-profile:v high",
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

// Multi-resolution transcoding endpoint
app.post("/transcode-multi", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No video file provided" });
  }

  // Get requested resolutions from query params or use all
  const requestedResolutions = req.query.resolutions
    ? req.query.resolutions.split(",")
    : Object.keys(RESOLUTIONS);

  let inputPath = null;
  const outputPaths = [];
  const results = {};

  try {
    // Save uploaded file
    inputPath = await saveBufferToTemp(req.file.buffer);
    console.log("Saved input file to:", inputPath);

    // Transcode to all requested resolutions
    const transcodingPromises = requestedResolutions.map(async (resolution) => {
      if (!RESOLUTIONS[resolution]) {
        return { resolution, error: "Invalid resolution" };
      }

      try {
        const outputPath = await transcodeVideo(inputPath, resolution);
        outputPaths.push(outputPath);

        // Read file stats
        const stats = await fs.promises.stat(outputPath);
        const fileSize = stats.size;

        // Create blob URL for frontend
        return {
          resolution,
          path: outputPath,
          size: fileSize,
          status: "success",
        };
      } catch (error) {
        return {
          resolution,
          error: error.message,
          status: "error",
        };
      }
    });

    // Wait for all transcoding to complete
    const transcodingResults = await Promise.all(transcodingPromises);

    // Stream results back as response
    for (const result of transcodingResults) {
      if (result.status === "success") {
        // Read the file and convert to base64
        const videoBuffer = await fs.promises.readFile(result.path);
        results[result.resolution] = {
          data: videoBuffer.toString("base64"),
          size: result.size,
          type: "video/mp4",
        };
      } else {
        results[result.resolution] = {
          error: result.error,
        };
      }
    }

    res.json(results);
  } catch (error) {
    console.error("Error during transcoding:", error);
    res
      .status(500)
      .json({ error: "Transcoding failed", details: error.message });
  } finally {
    // Cleanup
    try {
      if (inputPath) await unlinkAsync(inputPath);
      for (const path of outputPaths) {
        await unlinkAsync(path);
      }
    } catch (cleanupError) {
      console.error("Error cleaning up files:", cleanupError);
    }
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large (max 500MB)" });
    }
  }
  console.error("Server error:", error);
  res
    .status(500)
    .json({ error: "Internal server error", details: error.message });
});

// Cleanup old temporary files
setInterval(async () => {
  try {
    const files = await fs.promises.readdir(tempDir);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.promises.stat(filePath);
      if (now - stats.mtime.getTime() > 60 * 60 * 1000) {
        await unlinkAsync(filePath);
        console.log("Cleaned up old file:", file);
      }
    }
  } catch (err) {
    console.error("Error during cleanup:", err);
  }
}, 30 * 60 * 1000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
