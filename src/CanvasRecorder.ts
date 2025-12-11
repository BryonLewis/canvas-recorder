/**
 * Canvas Recorder class for recording canvas elements with optional watermark support
 */

export type WatermarkPosition = 
  | 'top-left' 
  | 'top-right' 
  | 'bottom-left' 
  | 'bottom-right'
  | { x: number; y: number }; // Pixel positioning

export type ThicknessUnit = 'px' | '%';

export interface WatermarkBar {
  position: 'top' | 'bottom';
  thickness: number; // Thickness value
  thicknessUnit: ThicknessUnit; // 'px' or '%'
  color: string; // Bar background color
  text?: string; // Optional text inside the bar
  textColor?: string; // Text color
  textAlign?: 'left' | 'right' | 'center'; // Text alignment
  textSize?: number; // Text font size
  textPadding?: number; // Padding around text
}

export interface WatermarkOptions {
  // Text watermark
  text?: string;
  position?: WatermarkPosition;
  fontSize?: number;
  color?: string;
  
  // Image watermark
  image?: string | HTMLImageElement | HTMLCanvasElement; // Image URL, Image element, or Canvas element
  imagePosition?: WatermarkPosition;
  imageWidth?: number; // Optional: scale image width (maintains aspect ratio if height not specified)
  imageHeight?: number; // Optional: scale image height
  imageOpacity?: number; // 0-1, default 1
  
  // Watermark bars
  bars?: WatermarkBar[];
}

export interface RecorderOptions {
  canvas?: HTMLCanvasElement; // Optional: can use external canvas instead
  externalCanvas?: HTMLCanvasElement; // Alternative: external canvas as input source
  watermark?: WatermarkOptions;
  fps?: number;
  videoBitsPerSecond?: number;
}

export interface RecordingData {
  blob: Blob;
  url: string;
  duration: number;
}

export class CanvasRecorder {
  private canvas: HTMLCanvasElement | null = null;
  private externalCanvas: HTMLCanvasElement | null = null;
  private watermarkCanvas: HTMLCanvasElement | null = null;
  private watermarkCtx: CanvasRenderingContext2D | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private startTime: number = 0;
  private options: RecorderOptions;
  private animationFrameId: number | null = null;
  private watermarkImage: HTMLImageElement | null = null;
  private watermarkImageLoaded: boolean = false;

  constructor(options: RecorderOptions) {
    this.options = {
      fps: 30,
      videoBitsPerSecond: 5000000, // Increased default bitrate for better quality (5 Mbps)
      ...options
    };
    
    // Support both canvas and externalCanvas
    if (options.externalCanvas) {
      this.externalCanvas = options.externalCanvas;
    } else if (options.canvas) {
      this.canvas = options.canvas;
    } else {
      throw new Error('Either canvas or externalCanvas must be provided');
    }

    if (options.watermark) {
      this.setupWatermark();
    }
  }

  private getSourceCanvas(): HTMLCanvasElement {
    return this.externalCanvas || this.canvas!;
  }

  private async setupWatermark(): Promise<void> {
    if (!this.options.watermark) return;

    const sourceCanvas = this.getSourceCanvas();

    // Create a hidden canvas for watermark overlay
    // This canvas will copy the main canvas content and draw the watermark on top
    // The recording will capture from this hidden canvas instead of the original
    this.watermarkCanvas = document.createElement('canvas');
    // Ensure watermark canvas matches the source canvas resolution exactly
    this.watermarkCanvas.width = sourceCanvas.width;
    this.watermarkCanvas.height = sourceCanvas.height;
    this.watermarkCtx = this.watermarkCanvas.getContext('2d', {
      alpha: false, // Disable alpha for better performance and quality
      desynchronized: false // Ensure synchronized rendering
    });

    // Load watermark image if provided
    if (this.options.watermark.image) {
      await this.loadWatermarkImage(this.options.watermark.image);
    }
  }

  private async loadWatermarkImage(imageSource: string | HTMLImageElement | HTMLCanvasElement): Promise<void> {
    if (imageSource instanceof HTMLImageElement) {
      if (imageSource.complete && imageSource.naturalWidth > 0) {
        this.watermarkImage = imageSource;
        this.watermarkImageLoaded = true;
      } else {
        return new Promise((resolve) => {
          imageSource.onload = () => {
            this.watermarkImage = imageSource;
            this.watermarkImageLoaded = true;
            resolve();
          };
          imageSource.onerror = () => {
            console.warn('Failed to load watermark image');
            resolve();
          };
        });
      }
    } else if (imageSource instanceof HTMLCanvasElement) {
      // Convert canvas to image
      const img = new Image();
      img.src = imageSource.toDataURL();
      img.onload = () => {
        this.watermarkImage = img;
        this.watermarkImageLoaded = true;
      };
    } else if (typeof imageSource === 'string') {
      // URL string
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Handle CORS if needed
      return new Promise((resolve) => {
        img.onload = () => {
          this.watermarkImage = img;
          this.watermarkImageLoaded = true;
          resolve();
        };
        img.onerror = () => {
          console.warn('Failed to load watermark image from URL:', imageSource);
          resolve();
        };
        img.src = imageSource;
      });
    }
  }

  private drawWatermark(): void {
    if (!this.watermarkCanvas || !this.watermarkCtx || !this.options.watermark) return;

    const sourceCanvas = this.getSourceCanvas();
    const watermark = this.options.watermark;

    // Every frame: copy the source canvas content to the hidden watermark canvas
    this.watermarkCtx.drawImage(sourceCanvas, 0, 0);

    // Draw watermark bars first (so text/image watermarks can appear on top)
    if (watermark.bars && watermark.bars.length > 0) {
      this.drawWatermarkBars(watermark.bars);
    }

    // Draw text watermark
    if (watermark.text) {
      this.drawTextWatermark(watermark);
    }

    // Draw image watermark
    if (watermark.image && this.watermarkImageLoaded && this.watermarkImage) {
      this.drawImageWatermark(watermark);
    }
  }

  private drawWatermarkBars(bars: WatermarkBar[]): void {
    if (!this.watermarkCanvas || !this.watermarkCtx) return;

    for (const bar of bars) {
      const {
        position,
        thickness,
        thicknessUnit,
        color,
        text,
        textColor = '#ffffff',
        textAlign = 'center',
        textSize = 16,
        textPadding = 10
      } = bar;

      // Calculate bar thickness
      let barThickness: number;
      if (thicknessUnit === '%') {
        if (position === 'top' || position === 'bottom') {
          barThickness = (this.watermarkCanvas.height * thickness) / 100;
        } else {
          barThickness = (this.watermarkCanvas.width * thickness) / 100;
        }
      } else {
        barThickness = thickness;
      }

      // Draw the bar
      this.watermarkCtx.fillStyle = color;
      if (position === 'top') {
        this.watermarkCtx.fillRect(0, 0, this.watermarkCanvas.width, barThickness);
      } else if (position === 'bottom') {
        this.watermarkCtx.fillRect(0, this.watermarkCanvas.height - barThickness, this.watermarkCanvas.width, barThickness);
      }

      // Draw text inside the bar if provided
      if (text) {
        this.watermarkCtx.fillStyle = textColor;
        this.watermarkCtx.font = `${textSize}px Arial`;
        this.watermarkCtx.textBaseline = 'middle';

        let textX: number;
        const textY = position === 'top' 
          ? barThickness / 2 
          : this.watermarkCanvas.height - barThickness / 2;

        const metrics = this.watermarkCtx.measureText(text);

        switch (textAlign) {
          case 'left':
            textX = textPadding;
            break;
          case 'right':
            textX = this.watermarkCanvas.width - metrics.width - textPadding;
            break;
          case 'center':
          default:
            textX = (this.watermarkCanvas.width - metrics.width) / 2;
            break;
        }

        this.watermarkCtx.fillText(text, textX, textY);
      }
    }
  }

  private drawTextWatermark(watermark: WatermarkOptions): void {
    if (!this.watermarkCanvas || !this.watermarkCtx || !watermark.text) return;

    const {
      text,
      position = 'bottom-right',
      fontSize = 16,
      color = 'rgba(255, 255, 255, 0.7)'
    } = watermark;

    this.watermarkCtx.font = `${fontSize}px Arial`;
    this.watermarkCtx.fillStyle = color;
    
    const metrics = this.watermarkCtx.measureText(text);
    const padding = 10;
    let x: number;
    let y: number;

    if (typeof position === 'object' && 'x' in position && 'y' in position) {
      // Pixel positioning
      x = position.x;
      y = position.y;
    } else {
      // Corner positioning
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
        default:
          x = this.watermarkCanvas.width - metrics.width - padding;
          y = this.watermarkCanvas.height - padding;
          break;
      }
    }

    this.watermarkCtx.fillText(text, x, y);
  }

  private drawImageWatermark(watermark: WatermarkOptions): void {
    if (!this.watermarkCanvas || !this.watermarkCtx || !this.watermarkImage || !watermark.image) return;

    const {
      imagePosition = 'bottom-right',
      imageWidth,
      imageHeight,
      imageOpacity = 1
    } = watermark;

    // Calculate image dimensions
    let drawWidth = this.watermarkImage.width;
    let drawHeight = this.watermarkImage.height;

    if (imageWidth && imageHeight) {
      drawWidth = imageWidth;
      drawHeight = imageHeight;
    } else if (imageWidth) {
      const aspectRatio = this.watermarkImage.height / this.watermarkImage.width;
      drawWidth = imageWidth;
      drawHeight = imageWidth * aspectRatio;
    } else if (imageHeight) {
      const aspectRatio = this.watermarkImage.width / this.watermarkImage.height;
      drawHeight = imageHeight;
      drawWidth = imageHeight * aspectRatio;
    }

    // Calculate position
    let x: number;
    let y: number;
    const padding = 10;

    if (typeof imagePosition === 'object' && 'x' in imagePosition && 'y' in imagePosition) {
      // Pixel positioning
      x = imagePosition.x;
      y = imagePosition.y;
    } else {
      // Corner positioning
      switch (imagePosition) {
        case 'top-left':
          x = padding;
          y = padding;
          break;
        case 'top-right':
          x = this.watermarkCanvas.width - drawWidth - padding;
          y = padding;
          break;
        case 'bottom-left':
          x = padding;
          y = this.watermarkCanvas.height - drawHeight - padding;
          break;
        case 'bottom-right':
        default:
          x = this.watermarkCanvas.width - drawWidth - padding;
          y = this.watermarkCanvas.height - drawHeight - padding;
          break;
      }
    }

    // Draw image with opacity
    if (imageOpacity < 1) {
      this.watermarkCtx.save();
      this.watermarkCtx.globalAlpha = imageOpacity;
    }
    this.watermarkCtx.drawImage(this.watermarkImage, x, y, drawWidth, drawHeight);
    if (imageOpacity < 1) {
      this.watermarkCtx.restore();
    }
  }

  async start(): Promise<void> {
    this.recordedChunks = [];
    this.startTime = Date.now();

    // Ensure watermark is set up (including image loading)
    if (this.options.watermark && !this.watermarkCanvas) {
      await this.setupWatermark();
    }

    // Get the canvas to record (with or without watermark)
    // When watermark is enabled, we record from the hidden watermark canvas
    // Otherwise, we record directly from the original canvas
    const sourceCanvas = this.getSourceCanvas();
    const canvasToRecord = this.watermarkCanvas || sourceCanvas;

    // If we have a watermark, draw it immediately before capturing the stream
    // This ensures the watermark canvas has content when the stream starts
    if (this.watermarkCanvas) {
      this.drawWatermark();
    }

    // Capture the canvas stream from the selected canvas (watermark canvas or original)
    const stream = canvasToRecord.captureStream(this.options.fps);

    // Create MediaRecorder with quality settings
    const mimeType = this.getSupportedMimeType();
    const recorderOptions: MediaRecorderOptions = {
      mimeType,
      videoBitsPerSecond: this.options.videoBitsPerSecond
    };

    // Add codec-specific quality settings if VP9 is supported
    if (mimeType.includes('vp9')) {
      // VP9 supports quality settings - use high quality
      recorderOptions.videoBitsPerSecond = this.options.videoBitsPerSecond;
    }

    this.mediaRecorder = new MediaRecorder(stream, recorderOptions);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(100); // Collect data every 100ms

    // If we have a watermark, start the animation loop to continuously update the hidden canvas
    // This uses requestAnimationFrame to draw the source canvas into the watermark canvas every frame
    // while recording, then draws the watermark on top
    if (this.watermarkCanvas) {
      this.updateWatermarkLoop();
    }
  }

  private updateWatermarkLoop(): void {
    // Only continue if we're still recording
    if (!this.isRecording()) {
      this.animationFrameId = null;
      return;
    }

    // Every frame: copy the source canvas to the watermark canvas, then draw watermark on top
    this.drawWatermark();
    
    // Schedule the next frame update
    this.animationFrameId = requestAnimationFrame(() => this.updateWatermarkLoop());
  }

  private getSupportedMimeType(): string {
    // Prioritize VP9 for better quality, then VP8, then fallback
    const types = [
      'video/webm;codecs=vp9', // Best quality codec
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
    // Also update source canvas if it's the main canvas
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    // Note: externalCanvas size should be managed externally
  }
}
