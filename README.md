# Canvas Recorder

A client-side TypeScript tool for recording HTML canvas elements (including MapLibre GL and WebGL) with support for watermarks and MP4 conversion via FFmpeg WASM.

## Features

- 🎥 **Canvas Recording**: Record any HTML canvas element using MediaRecorder API
- 🗺️ **MapLibre GL Support**: Full support for MapLibre GL and WebGL canvases
- 💧 **Advanced Watermarking**: Comprehensive watermark system with:
  - Text watermarks with customizable position, size, color, and opacity
  - Image watermarks (URL, Image element, or Canvas element)
  - Pixel-accurate positioning (x, y coordinates) or corner positioning
  - Watermark bars (top and bottom) with configurable thickness, colors, and text
  - Text alignment in bars (left, center, right)
- 🎬 **MP4 Conversion**: Convert WebM recordings to MP4 using FFmpeg WASM in a Web Worker
- ⚡ **Efficient Processing**: Web Worker-based conversion for non-blocking UI
- 📦 **TypeScript**: Fully typed with TypeScript
- 🎨 **External Canvas Support**: Use an external canvas as the input source

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

#### Basic Usage

```typescript
import { CanvasRecorder, VideoConverter } from './src/index';

// Create recorder with basic watermark
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

#### Advanced Watermarking

```typescript
// Text watermark with pixel positioning
const recorder = new CanvasRecorder({
  canvas: myCanvasElement,
  fps: 30,
  watermark: {
    text: 'Custom Position',
    position: { x: 100, y: 50 }, // Pixel coordinates
    fontSize: 24,
    color: 'rgba(255, 0, 0, 0.9)'
  }
});

// Image watermark
const recorder = new CanvasRecorder({
  canvas: myCanvasElement,
  watermark: {
    image: 'https://example.com/logo.png', // or HTMLImageElement or HTMLCanvasElement
    imagePosition: 'top-left',
    imageWidth: 200, // Optional: scale image
    imageOpacity: 0.8
  }
});

// Watermark bars with text
const recorder = new CanvasRecorder({
  canvas: myCanvasElement,
  watermark: {
    bars: [
      {
        position: 'top',
        thickness: 50,
        thicknessUnit: 'px', // or '%'
        color: '#000000',
        text: 'Top Bar Text',
        textAlign: 'center',
        textColor: '#ffffff',
        textSize: 18
      },
      {
        position: 'bottom',
        thickness: 5,
        thicknessUnit: '%', // Percentage of canvas height
        color: 'rgba(0, 0, 0, 0.7)',
        text: 'Bottom Bar',
        textAlign: 'right',
        textColor: '#ffff00',
        textSize: 16
      }
    ]
  }
});

// Combined: text, image, and bars
const recorder = new CanvasRecorder({
  canvas: myCanvasElement,
  watermark: {
    text: 'Recording',
    position: 'bottom-right',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    image: logoImage,
    imagePosition: { x: 10, y: 10 },
    imageWidth: 100,
    bars: [
      {
        position: 'top',
        thickness: 40,
        thicknessUnit: 'px',
        color: '#1a1a1a',
        text: 'My Application',
        textAlign: 'left',
        textColor: '#ffffff',
        textSize: 16
      }
    ]
  }
});

// Using external canvas
const externalCanvas = document.createElement('canvas');
// ... draw to external canvas ...
const recorder = new CanvasRecorder({
  externalCanvas: externalCanvas, // Use external canvas instead of main canvas
  fps: 30,
  watermark: { /* ... */ }
});
```

## API

### CanvasRecorder

#### Constructor Options

```typescript
type WatermarkPosition = 
  | 'top-left' 
  | 'top-right' 
  | 'bottom-left' 
  | 'bottom-right'
  | { x: number; y: number }; // Pixel positioning

type ThicknessUnit = 'px' | '%';

interface WatermarkBar {
  position: 'top' | 'bottom';
  thickness: number; // Thickness value
  thicknessUnit: ThicknessUnit; // 'px' or '%'
  color: string; // Bar background color
  text?: string; // Optional text inside the bar
  textColor?: string; // Text color (default: '#ffffff')
  textAlign?: 'left' | 'right' | 'center'; // Text alignment (default: 'center')
  textSize?: number; // Text font size (default: 16)
  textPadding?: number; // Padding around text (default: 10)
}

interface WatermarkOptions {
  // Text watermark
  text?: string;
  position?: WatermarkPosition; // Default: 'bottom-right'
  fontSize?: number; // Default: 16
  color?: string; // Default: 'rgba(255, 255, 255, 0.7)'
  
  // Image watermark
  image?: string | HTMLImageElement | HTMLCanvasElement; // Image URL, Image element, or Canvas element
  imagePosition?: WatermarkPosition; // Default: 'bottom-right'
  imageWidth?: number; // Optional: scale image width (maintains aspect ratio if height not specified)
  imageHeight?: number; // Optional: scale image height
  imageOpacity?: number; // 0-1, default: 1
  
  // Watermark bars
  bars?: WatermarkBar[];
}

interface RecorderOptions {
  canvas?: HTMLCanvasElement; // Optional: can use externalCanvas instead
  externalCanvas?: HTMLCanvasElement; // Alternative: external canvas as input source
  watermark?: WatermarkOptions;
  fps?: number; // Default: 30
  videoBitsPerSecond?: number; // Default: 5000000 (5 Mbps)
}
```

#### Methods

- `start()`: Start recording (async, loads watermark images if needed)
- `stop()`: Stop recording and return RecordingData (Promise)
- `isRecording()`: Check if currently recording (boolean)
- `updateCanvasSize(width, height)`: Update canvas size if needed (void)

### VideoConverter

#### Methods

- `loadFFmpeg(onProgress?)`: Load FFmpeg WASM library (async)
- `convertToMP4(webmBlob, onProgress?)`: Convert WebM to MP4 (async, returns Promise<Blob>)
- `terminate()`: Terminate the worker (void)

## Watermark Examples

### Text Watermark with Corner Position

```typescript
watermark: {
  text: 'My Watermark',
  position: 'top-left',
  fontSize: 20,
  color: 'rgba(255, 255, 255, 0.9)'
}
```

### Text Watermark with Pixel Position

```typescript
watermark: {
  text: 'Custom Position',
  position: { x: 150, y: 75 },
  fontSize: 18,
  color: '#ff0000'
}
```

### Image Watermark

```typescript
// From URL
watermark: {
  image: 'https://example.com/logo.png',
  imagePosition: 'bottom-right',
  imageWidth: 150,
  imageOpacity: 0.8
}

// From Image element
const img = new Image();
img.src = 'logo.png';
await new Promise((resolve) => { img.onload = resolve; });
watermark: {
  image: img,
  imagePosition: { x: 10, y: 10 }
}

// From Canvas element
const logoCanvas = document.createElement('canvas');
// ... draw logo to canvas ...
watermark: {
  image: logoCanvas,
  imagePosition: 'top-left'
}
```

### Watermark Bars

```typescript
watermark: {
  bars: [
    {
      position: 'top',
      thickness: 50,
      thicknessUnit: 'px',
      color: '#000000',
      text: 'Application Name',
      textAlign: 'left',
      textColor: '#ffffff',
      textSize: 20
    },
    {
      position: 'bottom',
      thickness: 5,
      thicknessUnit: '%', // 5% of canvas height
      color: 'rgba(0, 0, 0, 0.8)',
      text: '© 2024 My Company',
      textAlign: 'center',
      textColor: '#ffff00',
      textSize: 14
    }
  ]
}
```

### Complete Example with All Features

```typescript
const recorder = new CanvasRecorder({
  canvas: myCanvas,
  fps: 30,
  videoBitsPerSecond: 5000000,
  watermark: {
    // Text watermark
    text: 'Recording',
    position: 'bottom-right',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    
    // Image watermark
    image: logoImage,
    imagePosition: { x: 10, y: 10 },
    imageWidth: 100,
    imageOpacity: 0.9,
    
    // Watermark bars
    bars: [
      {
        position: 'top',
        thickness: 40,
        thicknessUnit: 'px',
        color: '#1a1a1a',
        text: 'My Application',
        textAlign: 'left',
        textColor: '#ffffff',
        textSize: 16
      },
      {
        position: 'bottom',
        thickness: 3,
        thicknessUnit: '%',
        color: 'rgba(0, 0, 0, 0.7)',
        text: '© 2024',
        textAlign: 'right',
        textColor: '#cccccc',
        textSize: 12
      }
    ]
  }
});
```

## Requirements

- Modern browser with MediaRecorder API support
- SharedArrayBuffer support for FFmpeg WASM (requires CORS headers)

## License

ISC
