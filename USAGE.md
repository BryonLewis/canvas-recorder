# Canvas Recorder - Usage Guide

## Quick Start

### Running the Demo

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

4. Click **START** to begin recording
5. Click **STOP** to end recording
6. Click **Download WebM** to save the recording
7. (Optional) Click **Convert to MP4** to convert using FFmpeg WASM

### Building for Production

```bash
npm run build
npm run preview
```

## Features

### 1. Canvas Recording
The tool can record any HTML canvas element, including:
- Standard 2D canvas
- WebGL canvases
- MapLibre GL maps
- Three.js scenes
- Any canvas-based visualization

### 2. Watermark Support
Add customizable watermarks to your recordings:
- Position: top-left, top-right, bottom-left, bottom-right
- Custom text
- Adjustable font size and color
- Rendered in real-time during recording

### 3. MP4 Conversion
Convert WebM recordings to MP4 format:
- Uses FFmpeg WASM for client-side conversion
- Runs in a Web Worker for non-blocking UI
- Progress tracking
- No server required

## Library Usage

### Basic Recording

```typescript
import { CanvasRecorder } from './src/CanvasRecorder';

// Get your canvas element
const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;

// Create recorder
const recorder = new CanvasRecorder({
  canvas: canvas,
  fps: 30,
  videoBitsPerSecond: 2500000
});

// Start recording
await recorder.start();

// Stop recording and get result
const { blob, url, duration } = await recorder.stop();

// Create download link
const link = document.createElement('a');
link.href = url;
link.download = 'recording.webm';
link.click();
```

### Recording with Watermark

```typescript
const recorder = new CanvasRecorder({
  canvas: canvas,
  fps: 30,
  watermark: {
    text: 'My Company © 2024',
    position: 'bottom-right',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)'
  }
});
```

### Converting to MP4

```typescript
import { VideoConverter } from './src/VideoConverter';

// Create converter
const converter = new VideoConverter();

// Load FFmpeg (do this once)
await converter.loadFFmpeg((message) => {
  console.log('Loading FFmpeg:', message);
});

// Convert WebM to MP4
const mp4Blob = await converter.convertToMP4(webmBlob, (progress) => {
  console.log(`Progress: ${progress.progress}%`);
  console.log(`Status: ${progress.message}`);
});

// Create download link
const mp4Url = URL.createObjectURL(mp4Blob);
const link = document.createElement('a');
link.href = mp4Url;
link.download = 'recording.mp4';
link.click();

// Clean up
converter.terminate();
```

## Advanced Configuration

### Custom Frame Rate

```typescript
const recorder = new CanvasRecorder({
  canvas: canvas,
  fps: 60, // Higher frame rate for smoother video
  videoBitsPerSecond: 5000000 // Higher bitrate for better quality
});
```

### Dynamic Canvas Size

```typescript
// Update recorder when canvas size changes
window.addEventListener('resize', () => {
  recorder.updateCanvasSize(
    canvas.width,
    canvas.height
  );
});
```

## Browser Compatibility

### MediaRecorder API
- Chrome 47+
- Firefox 25+
- Safari 14.1+
- Edge 79+

### FFmpeg WASM (MP4 Conversion)
Requires SharedArrayBuffer support:
- Chrome 92+
- Firefox 79+
- Safari 15.2+
- Edge 92+

Note: SharedArrayBuffer requires cross-origin isolation headers:
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

These headers are configured in the Vite development server but must be set on your production server as well.

## Troubleshooting

### Recording Not Starting
- Ensure the canvas is visible and has content
- Check browser console for errors
- Verify MediaRecorder API is supported

### MP4 Conversion Fails
- Ensure CORS headers are set correctly
- Check if SharedArrayBuffer is available: `typeof SharedArrayBuffer !== 'undefined'`
- Verify FFmpeg WASM files are accessible

### Poor Video Quality
- Increase `videoBitsPerSecond` (e.g., 5000000 or higher)
- Increase `fps` for smoother motion
- Ensure canvas resolution is appropriate

### Large File Sizes
- Decrease `videoBitsPerSecond`
- Decrease `fps`
- Reduce canvas dimensions

## Performance Tips

1. **Recording Performance**
   - Keep canvas size reasonable (1920x1080 or smaller)
   - Use 30 FPS for most use cases (60 FPS only if needed)
   - Avoid heavy processing during recording

2. **Conversion Performance**
   - FFmpeg WASM is CPU-intensive
   - Keep recordings under 5 minutes for reasonable conversion times
   - Consider providing WebM downloads as primary option

3. **Memory Management**
   - Revoke blob URLs when done: `URL.revokeObjectURL(url)`
   - Terminate converter worker when finished: `converter.terminate()`
   - Clear recorded chunks after saving

## License

ISC
