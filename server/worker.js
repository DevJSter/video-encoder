const { workerData, parentPort } = require("worker_threads");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");

const { inputFile, resolution, width, height, outputDir } = workerData;

// Output file path
const outputFileName = `output_${resolution}_${path.basename(inputFile)}`;
const outputPath = path.join(outputDir, outputFileName);

// Configure FFmpeg
ffmpeg(inputFile)
  .outputOptions([
    "-c:v libx264", // Video codec
    "-preset medium", // Encoding speed preset
    "-crf 23", // Constant Rate Factor (quality)
    "-c:a aac", // Audio codec
    "-b:a 128k", // Audio bitrate
    "-movflags +faststart", // Enable streaming
    "-y", // Overwrite output files
  ])
  .size(`${width}x${height}`)
  .output(outputPath)
  .on("start", (commandLine) => {
    parentPort.postMessage({
      type: "progress",
      data: {
        status: "start",
        resolution,
        command: commandLine,
      },
    });
  })
  .on("progress", (progress) => {
    parentPort.postMessage({
      type: "progress",
      data: {
        status: "processing",
        resolution,
        percent: progress.percent,
      },
    });
  })
  .on("end", () => {
    parentPort.postMessage({
      type: "progress",
      data: {
        status: "complete",
        resolution,
        outputPath,
      },
    });
  })
  .on("error", (err) => {
    parentPort.postMessage({
      type: "error",
      data: {
        resolution,
        error: err.message,
      },
    });
  })
  .run();
