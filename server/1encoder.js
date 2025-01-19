const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} = require("worker_threads");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");


const ffmpegBinPath = path.join(
  process.env.USERPROFILE,
  "AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-7.1-full_build/bin"
);
process.env.PATH = `${ffmpegBinPath};${process.env.PATH}`;
// Maximum threads to use
const MAX_THREADS = 4;

// Main thread logic to start transcoding
if (isMainThread) {
  const inputFile = "input.mp4";

  // Define the resolutions and their corresponding sizes
  const resolutions = [
    { resolution: "360p", width: 640, height: 360 },
    { resolution: "720p", width: 1280, height: 720 },
    { resolution: "1080p", width: 1920, height: 1080 },
  ];

  console.clear();
  console.log(`Using a maximum of ${MAX_THREADS} threads`);

  let activeThreads = 0;
  const taskQueue = [];

  // Function to start a worker for transcoding
  const startWorker = (task) => {
    activeThreads++;
    const worker = new Worker(__filename, { workerData: task });

    worker.on("message", (message) => {
      console.log(`Worker finished: ${message}`);
    });

    worker.on("error", (error) => {
      console.error(`Worker encountered an error:`, error);
    });

    worker.on("exit", (exitCode) => {
      if (exitCode !== 0) {
        console.error(`Worker exited with code ${exitCode}`);
      }

      activeThreads--;

      // Start the next task in the queue if available
      if (taskQueue.length > 0) {
        const nextTask = taskQueue.shift();
        startWorker(nextTask);
      }
    });
  };

  // Add tasks to the queue for each resolution
  resolutions.forEach((res) => {
    const task = {
      inputFile,
      resolution: res.resolution,
      width: res.width,
      height: res.height,
    };

    if (activeThreads < MAX_THREADS) {
      startWorker(task);
    } else {
      taskQueue.push(task);
    }
  });
} else {
  // Worker thread logic to handle video transcoding
  const { inputFile, resolution, width, height } = workerData;
  const outputFilePath = path.join(__dirname, `./output/output_${resolution}.mp4`);

  console.log(`Starting transcoding for ${resolution}`);

  ffmpeg(inputFile)
    .output(outputFilePath)
    .size(`${width}x${height}`)
    .on("start", (commandLine) => {
      console.log(`FFmpeg command for ${resolution}: ${commandLine}`);
    })
    .on("progress", (progress) => {
      console.log(`Progress for ${resolution}: ${progress.percent}% complete`);
    })
    .on("end", () => {
      console.log(`Transcoding finished for ${resolution}`);
      parentPort.postMessage(`Transcoding completed for ${resolution}`);
    })
    .on("error", (err, stdout, stderr) => {
      console.error(`Error transcoding ${resolution}:`, err);
      console.error(stderr);
      parentPort.postMessage(
        `Error occurred for ${resolution}: ${err.message}`
      );
    })
    .run();
}
