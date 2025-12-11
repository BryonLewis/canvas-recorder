# Canvas Recorder

A client-side TypeScript tool for recording HTML canvas elements (including MapLibre GL and WebGL) with support for watermarks and MP4 conversion via FFmpeg WASM.

## Features

- 🎥 **Canvas Recording**: Record any HTML canvas element using MediaRecorder API
- 🗺️ **MapLibre GL Support**: Full support for MapLibre GL and WebGL canvases
- 💧 **Watermark Overlay**: Optional customizable watermark on recordings
- 🎬 **MP4 Conversion**: Convert WebM recordings to MP4 using FFmpeg WASM in a Web Worker
- ⚡ **Efficient Processing**: Web Worker-based conversion for non-blocking UI
- 📦 **TypeScript**: Fully typed with TypeScript

## Demo

A live demo application is included showing MapLibre GL canvas recording with rotating camera animation.

## Installation

```bash
npm install
```

## Usage

### Running the Demo

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Important: MapLibre GL Configuration

When using MapLibre GL, you **must** set `canvasContextAttributes` with `preserveDrawingBuffer: true` when creating the map. This is required for the canvas to be recordable:

```typescript
import maplibregl from 'maplibre-gl';

const map = new maplibregl.Map({
  canvasContextAttributes: { preserveDrawingBuffer: true }, // Required for recording!
  container: 'map',
  // ... other options
});
```

Without this setting, the canvas content may not be captured correctly during recording.

### Using as a Library

```typescript
import { CanvasRecorder, VideoConverter } from './src/index';

// Create recorder with options
const recorder = new CanvasRecorder({
  canvas: myCanvasElement,
  fps: 30,
  videoBitsPerSecond: 2500000, // Optional: bitrate in bits per second
  watermark: {
    text: 'My Watermark',
    position: 'bottom-right',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)'
  }
});

// Start recording
await recorder.start();

// Stop recording
const { blob, url, duration } = await recorder.stop();

// Optional: Convert to MP4
const converter = new VideoConverter();
await converter.loadFFmpeg();
const mp4Blob = await converter.convertToMP4(blob, (progress) => {
  console.log(`Progress: ${progress.progress}%`);
});
```

## API

### CanvasRecorder

#### Constructor Options

```typescript
interface RecorderOptions {
  canvas: HTMLCanvasElement;
  watermark?: {
    text: string;
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    fontSize?: number;
    color?: string;
  };
  fps?: number;
  videoBitsPerSecond?: number;
}
```

#### Methods

- `start()`: Start recording
- `stop()`: Stop recording and return RecordingData
- `isRecording()`: Check if currently recording
- `updateCanvasSize(width, height)`: Update canvas size if needed

### VideoConverter

#### Methods

- `loadFFmpeg(onProgress?)`: Load FFmpeg WASM library
- `convertToMP4(webmBlob, onProgress?)`: Convert WebM to MP4
- `terminate()`: Terminate the worker

## Requirements

- Modern browser with MediaRecorder API support
- SharedArrayBuffer support for FFmpeg WASM (requires CORS headers)

## License

ISC
