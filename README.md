# **Video Transcoder**

**You can see how it works --->>>>>> Youtube Link [here](https://youtu.be/m0MDTZ67X1c)**

### **Why I Built This**

The goal of this project was to create a **full-stack application** that demonstrates how large media files can be processed efficiently, transcoded into multiple resolutions, and delivered back to users—all while ensuring performance, scalability, and usability. This project is perfect for scenarios like video streaming platforms, video editing tools, or any use case where adaptable video delivery is required.

At its core, this application showcases how backend utilities like **FFmpeg** and **Multer** can integrate seamlessly with a React-based frontend to solve real-world video processing challenges.

---

### **How It Works**

This project has two main components: a **backend server** and a **frontend interface**.

---

## **Backend: Video Transcoding Engine**

### **Overview**
The backend is responsible for:
1. Accepting video uploads from the user.
2. Processing the video into multiple resolutions.
3. Cleaning up temporary files after processing.
4. Sending the results back to the user as Base64-encoded video data.

### **Key Tools and Their Roles**
1. **Multer**:  
   - Handles file uploads from the frontend.  
   - Accepts video files in `multipart/form-data` format and temporarily holds them in memory as buffers.
   
2. **File System Utilities (`fs`, `os`)**:  
   - Converts in-memory buffers into temporary files saved on disk.  
   - Manages the creation and deletion of these temporary files during the processing lifecycle.  

3. **FFmpeg (via `fluent-ffmpeg`)**:  
   - The core transcoding engine.  
   - Converts the input video into different resolutions (`360p`, `720p`, `1080p`) using customizable encoding parameters like bitrate, codecs, and frame dimensions.  
   - Ensures that the transcoded videos are optimized for streaming with proper codecs (`H.264` for video, `AAC` for audio).  
   - Implements multi-resolution processing with separate output files for each resolution.

4. **Base64 Encoding**:  
   - Once transcoding is complete, the video files are read back into memory and encoded as Base64 strings.  
   - These strings are included in the JSON response, making it easy for the frontend to preview or download the videos without requiring additional API calls.

5. **Automatic Cleanup**:  
   - Temporary files created during the upload and transcoding process are deleted immediately after use.  
   - Additionally, a periodic cleanup mechanism ensures no old files accumulate in case of unexpected errors or interruptions.

---

## **Frontend: User Interaction Layer**

### **Overview**
The frontend provides a simple and intuitive interface for users to upload videos, select target resolutions, and receive processed videos.

### **How It Works**
1. **File Upload**:  
   - The user uploads a video file via a drag-and-drop or file input field.  
   - The selected resolutions (360p, 720p, 1080p) are sent to the backend as query parameters.  

2. **Progress Monitoring**:  
   - While the video is being processed, the frontend monitors the status through API responses or real-time updates.  

3. **Video Delivery**:  
   - Once transcoding is complete, the frontend receives the Base64-encoded videos from the backend.  
   - The videos are either displayed as previews or provided as downloadable links.

4. **Integration with Backend**:  
   - The React app communicates with the Node.js backend using `Axios` for API requests.  
   - The backend URL is dynamically configured, allowing the app to work in both development and production environments.

---

## **Technical Highlights**

1. **Multi-Resolution Transcoding**:
   - The backend supports transcoding to multiple resolutions simultaneously.
   - Each resolution is processed independently, allowing for flexibility in adapting to different user needs (e.g., mobile vs. desktop).

2. **Streamable Video Files**:
   - The output files are optimized for streaming using `-movflags frag_keyframe+empty_moov`, ensuring smooth playback even before the full file is downloaded.

3. **Scalable Design**:
   - The application processes video files asynchronously, allowing it to handle multiple uploads without blocking.
   - Temporary file storage ensures low memory usage, even with large files.

4. **Automatic Cleanup**:
   - The application deletes temporary files after they are processed to prevent disk space from being wasted.
   - A periodic cleanup mechanism removes any files older than 1 hour, ensuring long-term stability.

5. **Error Handling**:
   - Handles errors at every stage (upload, transcoding, cleanup) and provides meaningful feedback to the frontend.
   - Examples include handling invalid file formats, unsupported resolutions, or FFmpeg processing failures.

---

### **Why This Matters**
- **Video Streaming Applications**: Platforms like YouTube, Vimeo, or Netflix often transcode videos into multiple resolutions to optimize playback on different devices and networks. This project demonstrates the backend mechanics of such systems.
- **Edge Cases**: The app handles real-world challenges like large file uploads, resource constraints, and temporary file management.
- **Scalability**: By separating frontend and backend concerns, the application is scalable and easy to deploy in distributed environments.

---

### **Future Improvements**
- **Cloud Storage**: Replace temporary files with cloud storage (e.g., S3) for better scalability.
- **Streaming Support**: Enable real-time streaming of transcoded videos instead of sending Base64-encoded files.
- **Queue Management**: Introduce a job queue (e.g., Bull.js, RabbitMQ) to handle multiple transcoding requests efficiently in production environments.
