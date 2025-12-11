/**
 * FFmpeg Web Worker for converting WebM to MP4
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

interface ConvertMessage {
  type: 'convert';
  webmBlob: Blob;
}

interface LoadMessage {
  type: 'load';
}

type WorkerMessage = ConvertMessage | LoadMessage;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  try {
    if (type === 'load') {
      await loadFFmpeg();
      self.postMessage({ type: 'loaded' });
    } else if (type === 'convert') {
      const { webmBlob } = event.data as ConvertMessage;
      
      if (!ffmpeg) {
        await loadFFmpeg();
      }

      self.postMessage({ type: 'progress', progress: 0, message: 'Starting conversion...' });

      // Write the WebM file to FFmpeg's virtual file system
      await ffmpeg!.writeFile('input.webm', await fetchFile(webmBlob));

      self.postMessage({ type: 'progress', progress: 5, message: 'Converting to MP4...' });

      // Convert WebM to MP4
      // The progress event will fire during this operation and update progress automatically
      await ffmpeg!.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '22',
        '-c:a', 'aac',
        '-b:a', '128k',
        'output.mp4'
      ]);

      self.postMessage({ type: 'progress', progress: 90, message: 'Reading output...' });

      // Read the output file
      const data = await ffmpeg!.readFile('output.mp4') as Uint8Array;
      const mp4Blob = new Blob([new Uint8Array(data)], { type: 'video/mp4' });

      self.postMessage({ type: 'progress', progress: 100, message: 'Conversion complete!' });

      // Clean up
      await ffmpeg!.deleteFile('input.webm');
      await ffmpeg!.deleteFile('output.mp4');

      self.postMessage({
        type: 'complete',
        mp4Blob
      });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};

async function loadFFmpeg(): Promise<void> {
  if (ffmpeg) return;

  ffmpeg = new FFmpeg();

  // Set up logging
  ffmpeg.on('log', ({ message }) => {
    self.postMessage({ type: 'log', message });
  });

  ffmpeg.on('progress', ({  time }) => {
    // Convert microseconds to seconds for display
    const timeInSeconds = (time / 1000000).toFixed(2);
    self.postMessage({
      type: 'progress',
      time: timeInSeconds,
      message: `Processing... (${timeInSeconds}s)`
    });
  });

  // Load FFmpeg from CDN
  // Note: This uses an external CDN. For production use, consider:
  // 1. Hosting the FFmpeg WASM files locally in the public/ directory
  // 2. Making the baseURL configurable via environment variables
  // 3. Implementing fallback URLs for reliability
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
}
