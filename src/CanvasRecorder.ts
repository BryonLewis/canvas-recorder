/**
 * Canvas Recorder class for recording canvas elements with optional watermark support
 */
export interface RecorderOptions {
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

export interface RecordingData {
  blob: Blob;
  url: string;
  duration: number;
}

export class CanvasRecorder {
  private canvas: HTMLCanvasElement;
  private watermarkCanvas: HTMLCanvasElement | null = null;
  private watermarkCtx: CanvasRenderingContext2D | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private startTime: number = 0;
  private options: RecorderOptions;
  private animationFrameId: number | null = null;

  constructor(options: RecorderOptions) {
    this.options = {
      fps: 30,
      videoBitsPerSecond: 2500000,
      ...options
    };
    this.canvas = options.canvas;

    if (options.watermark) {
      this.setupWatermark();
    }
  }

  private setupWatermark(): void {
    if (!this.options.watermark) return;

    // Create a new canvas for watermark overlay
    this.watermarkCanvas = document.createElement('canvas');
    this.watermarkCanvas.width = this.canvas.width;
    this.watermarkCanvas.height = this.canvas.height;
    this.watermarkCtx = this.watermarkCanvas.getContext('2d');
  }

  private drawWatermark(): void {
    if (!this.watermarkCanvas || !this.watermarkCtx || !this.options.watermark) return;

    const { text, position = 'bottom-right', fontSize = 16, color = 'rgba(255, 255, 255, 0.7)' } = this.options.watermark;

    // Copy the original canvas content
    this.watermarkCtx.drawImage(this.canvas, 0, 0);

    // Draw watermark
    this.watermarkCtx.font = `${fontSize}px Arial`;
    this.watermarkCtx.fillStyle = color;
    
    const metrics = this.watermarkCtx.measureText(text);
    const padding = 10;
    let x = padding;
    let y = padding + fontSize;

    switch (position) {
      case 'top-left':
        x = padding;
        y = padding + fontSize;
        break;
      case 'top-right':
        x = this.watermarkCanvas.width - metrics.width - padding;
        y = padding + fontSize;
        break;
      case 'bottom-left':
        x = padding;
        y = this.watermarkCanvas.height - padding;
        break;
      case 'bottom-right':
        x = this.watermarkCanvas.width - metrics.width - padding;
        y = this.watermarkCanvas.height - padding;
        break;
    }

    this.watermarkCtx.fillText(text, x, y);
  }

  async start(): Promise<void> {
    this.recordedChunks = [];
    this.startTime = Date.now();

    // Get the canvas to record (with or without watermark)
    const canvasToRecord = this.watermarkCanvas || this.canvas;

    // Capture the canvas stream
    const stream = canvasToRecord.captureStream(this.options.fps);

    // Create MediaRecorder
    const mimeType = this.getSupportedMimeType();
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: this.options.videoBitsPerSecond
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(100); // Collect data every 100ms

    // If we have a watermark, continuously update it
    if (this.watermarkCanvas) {
      this.updateWatermarkLoop();
    }
  }

  private updateWatermarkLoop(): void {
    this.drawWatermark();
    this.animationFrameId = requestAnimationFrame(() => this.updateWatermarkLoop());
  }

  private getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm';
  }

  stop(): Promise<RecordingData> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'));
        return;
      }

      // Stop the animation loop if running
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      this.mediaRecorder.onstop = () => {
        const duration = Date.now() - this.startTime;
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);

        resolve({
          blob,
          url,
          duration
        });
      };

      this.mediaRecorder.stop();

      // Stop all tracks
      const stream = this.mediaRecorder.stream;
      stream.getTracks().forEach(track => track.stop());
    });
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  updateCanvasSize(width: number, height: number): void {
    if (this.watermarkCanvas) {
      this.watermarkCanvas.width = width;
      this.watermarkCanvas.height = height;
    }
  }
}
