"use client";
import { useState } from "react";
import { Upload, Video, Settings, Loader2, Check } from "lucide-react";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [videos, setVideos] = useState({});
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [selectedQualities, setSelectedQualities] = useState({
    "360p": false,
    "720p": true,
    "1080p": false,
  });

  const resolutionLabels = {
    "360p": "SD (640x360)",
    "720p": "HD (1280x720)",
    "1080p": "Full HD (1920x1080)",
  };

  const handleFileChange = (file) => {
    if (file && file.type.startsWith("video/")) {
      setSelectedFile(file);
      setError(null);
      setVideos({});
    } else {
      setError("Please select a valid video file");
      setSelectedFile(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleQualityChange = (quality) => {
    setSelectedQualities((prev) => ({
      ...prev,
      [quality]: !prev[quality],
    }));
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a video file.");
      return;
    }

    const selectedResolutions = Object.entries(selectedQualities)
      .filter(([_, selected]) => selected)
      .map(([quality]) => quality);

    if (selectedResolutions.length === 0) {
      setError("Please select at least one quality.");
      return;
    }

    setProcessing(true);
    setError(null);
    setProgress(0);
    setVideos({});

    const formData = new FormData();
    formData.append("video", selectedFile);

    try {
      const response = await fetch(
        `http://localhost:5000/transcode-multi?resolutions=${selectedResolutions.join(
          ","
        )}`,
        {
          method: "POST",
          body: formData,
        }
      );
      console.log(response)

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Transcoding failed");
      }

      const results = await response.json();

      // Convert base64 data to video URLs
      const videoUrls = {};
      for (const [resolution, data] of Object.entries(results)) {
        console.log(data)
        if (data.error) {
          console.error(`Error for ${resolution}:`, data.error);
          continue;
        }

        const blob = await fetch(`data:video/mp4;base64,${data.data}`).then(
          (r) => r.blob()
        );
        videoUrls[resolution] = {
          url: URL.createObjectURL(blob),
          size: data.size,
        };
      }

      setVideos(videoUrls);
      setProgress(100);
    } catch (error) {
      console.error("Error during transcoding:", error);
      setError(
        error.message ||
          "An error occurred during transcoding. Please try again."
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Video Transcoder Pro
          </h1>
          <p className="text-gray-600 text-xl">
            Convert your videos to multiple qualities
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}

          {/* Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            className={`
              border-3 rounded-xl p-8 mb-6 transition-all duration-300
              ${
                dragging
                  ? "border-blue-500 bg-blue-50 border-solid"
                  : "border-dashed border-gray-300"
              }
            `}
          >
            <div className="flex flex-col items-center gap-4">
              <Upload
                size={48}
                className={`${dragging ? "text-blue-500" : "text-gray-400"}`}
              />
              <div className="text-center">
                {selectedFile ? (
                  <div>
                    <p className="font-medium text-gray-700">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-gray-700">
                      {dragging
                        ? "Drop your video here"
                        : "Drag & drop your video here"}
                    </p>
                    <p className="text-sm text-gray-500">
                      or click below to browse
                    </p>
                    <p className="text-sm text-gray-500">
                      500 MB max size LIMIT for now!!!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quality Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-700 mb-3">
              Select Output Qualities:
            </h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(resolutionLabels).map(([quality, label]) => (
                <button
                  key={quality}
                  onClick={() => handleQualityChange(quality)}
                  className={`
                    px-4 py-2 rounded-lg flex items-center gap-2 transition-all
                    ${
                      selectedQualities[quality]
                        ? "bg-blue-100 text-blue-700 border border-blue-300"
                        : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                    }
                  `}
                >
                  {selectedQualities[quality] && <Check size={16} />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <input
              type="file"
              accept="video/*"
              onChange={(e) => handleFileChange(e.target.files[0])}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="btn flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <Upload size={20} />
              Browse Files
            </label>
            <button
              onClick={handleUpload}
              disabled={processing || !selectedFile}
              className={`
                btn flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium
                ${
                  processing || !selectedFile
                    ? "bg-gray-200 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }
              `}
            >
              {processing ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Settings size={20} />
                  Start Transcoding
                </>
              )}
            </button>
          </div>

          {/* Progress Bar */}
          {processing && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Video Previews */}
          {Object.keys(videos).length > 0 && (
            <div className="space-y-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">
                Transcoded Videos
              </h2>
              {Object.entries(videos).map(([resolution, data]) => (
                <div key={resolution} className="bg-gray-50 p-6 rounded-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-700">
                      {resolutionLabels[resolution]}
                    </h3>
                    <span className="text-sm text-gray-500">
                      Size: {(data.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                  <video
                    controls
                    className="w-full rounded-lg shadow-lg"
                    src={data.url}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
