/**
 * Video Converter class that uses Web Worker for FFmpeg conversion
 */
export interface ConversionProgress {
  progress: number;
  message: string;
}

export class VideoConverter {
  private worker: Worker | null = null;

  constructor() {
    // Worker will be initialized when needed
  }

  private initWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('./workers/ffmpeg-worker.ts', import.meta.url),
        { type: 'module' }
      );
    }
    return this.worker;
  }

  async loadFFmpeg(onProgress?: (message: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = this.initWorker();

      const handleMessage = (event: MessageEvent) => {
        const { type, message, error } = event.data;

        if (type === 'loaded') {
          worker.removeEventListener('message', handleMessage);
          resolve();
        } else if (type === 'error') {
          worker.removeEventListener('message', handleMessage);
          reject(new Error(error));
        } else if (type === 'log' && onProgress) {
          onProgress(message);
        }
      };

      worker.addEventListener('message', handleMessage);
      worker.postMessage({ type: 'load' });
    });
  }

  async convertToMP4(
    webmBlob: Blob,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const worker = this.initWorker();

      const handleMessage = (event: MessageEvent) => {
        const { type, mp4Blob, progress, message, error } = event.data;

        if (type === 'complete') {
          worker.removeEventListener('message', handleMessage);
          resolve(mp4Blob);
        } else if (type === 'error') {
          worker.removeEventListener('message', handleMessage);
          reject(new Error(error));
        } else if (type === 'progress' && onProgress) {
          onProgress({ progress, message });
        }
      };

      worker.addEventListener('message', handleMessage);
      worker.postMessage({ type: 'convert', webmBlob });
    });
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
