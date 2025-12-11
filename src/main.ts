/**
 * Main demo application for Canvas Recorder
 */
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CanvasRecorder, RecordingData } from './CanvasRecorder';
import { VideoConverter } from './VideoConverter';

// Initialize the map
let map: maplibregl.Map;
let recorder: CanvasRecorder;
let converter: VideoConverter;
let isRecording = false;

function initMap(): void {
  // Try to load MapLibre with demo tiles, but handle errors gracefully
  try {
    map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{
          id: 'osm',
          type: 'raster',
          source: 'osm',
          minzoom: 0,
          maxzoom: 19
        }],
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
      },
      center: [-74.5, 40],
      zoom: 9
    });

    map.on('load', () => {
      console.log('Map loaded successfully');
      updateStatus('Map loaded. Ready to record.');

      // Add some animation to the map
      startMapAnimation();
    });

    map.on('error', (e) => {
      console.error('Map error:', e);
      updateStatus('Map loaded with limited features. Ready to record.');
    });
  } catch (error) {
    console.error('Failed to initialize map:', error);
    updateStatus('Map initialization failed. Using fallback canvas.');
    initFallbackCanvas();
  }
}

function initFallbackCanvas(): void {
  // Create a simple animated canvas as fallback
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;
  
  mapContainer.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = mapContainer.clientWidth;
  canvas.height = mapContainer.clientHeight;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  mapContainer.appendChild(canvas);
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  let hue = 0;
  function animate() {
    ctx.fillStyle = `hsl(${hue}, 50%, 20%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw some animated shapes
    const time = Date.now() / 1000;
    for (let i = 0; i < 5; i++) {
      const x = canvas.width / 2 + Math.cos(time + i) * 200;
      const y = canvas.height / 2 + Math.sin(time + i) * 200;
      const radius = 50 + Math.sin(time * 2 + i) * 20;
      
      ctx.fillStyle = `hsl(${(hue + i * 60) % 360}, 70%, 50%)`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    hue = (hue + 0.5) % 360;
    requestAnimationFrame(animate);
  }
  
  animate();
  updateStatus('Fallback canvas ready. Ready to record.');
  
  // Override recorder initialization to use fallback canvas
  (window as any).fallbackCanvas = canvas;
}

function startMapAnimation(): void {
  let rotation = 0;
  
  function rotateCamera() {
    if (!map) return;
    
    rotation = (rotation + 0.5) % 360;
    map.rotateTo(rotation, { duration: 0 });
    
    if (isRecording) {
      requestAnimationFrame(rotateCamera);
    }
  }

  // Start rotation when recording starts
  const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
  startBtn?.addEventListener('click', () => {
    if (isRecording) {
      rotateCamera();
    }
  });
}

function initRecorder(): void {
  const fallbackCanvas = (window as any).fallbackCanvas;
  const mapCanvas = fallbackCanvas || (map ? map.getCanvas() : null);
  
  if (!mapCanvas) {
    throw new Error('No canvas available for recording');
  }
  
  const watermarkCheckbox = document.getElementById('watermarkEnabled') as HTMLInputElement;
  const watermarkText = document.getElementById('watermarkText') as HTMLInputElement;

  const options: any = {
    canvas: mapCanvas,
    fps: 30,
    videoBitsPerSecond: 2500000
  };

  if (watermarkCheckbox.checked) {
    options.watermark = {
      text: watermarkText.value || 'Canvas Recording',
      position: 'bottom-right',
      fontSize: 16,
      color: 'rgba(255, 255, 255, 0.8)'
    };
  }

  recorder = new CanvasRecorder(options);
}

async function startRecording(): Promise<void> {
  try {
    initRecorder();
    await recorder.start();
    isRecording = true;
    
    updateUI(true);
    updateStatus('Recording started...');
    
    // Update timer
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      if (!isRecording) {
        clearInterval(timerInterval);
        return;
      }
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      updateTimer(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
    
  } catch (error) {
    console.error('Failed to start recording:', error);
    updateStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function stopRecording(): Promise<void> {
  try {
    updateStatus('Stopping recording...');
    const recordingData: RecordingData = await recorder.stop();
    isRecording = false;
    
    updateUI(false);
    updateStatus('Recording stopped. Duration: ' + (recordingData.duration / 1000).toFixed(2) + 's');
    
    // Create download link for WebM
    createDownloadLink('webm-download', recordingData.url, 'recording.webm', 'Download WebM');
    
    // Ask if user wants to convert to MP4
    const convertBtn = document.getElementById('convertBtn') as HTMLButtonElement;
    convertBtn.style.display = 'block';
    convertBtn.onclick = () => convertToMP4(recordingData.blob);
    
  } catch (error) {
    console.error('Failed to stop recording:', error);
    updateStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function convertToMP4(webmBlob: Blob): Promise<void> {
  try {
    const progressBar = document.getElementById('progressBar') as HTMLDivElement;
    const progressText = document.getElementById('progressText') as HTMLDivElement;
    const progressContainer = document.getElementById('progressContainer') as HTMLDivElement;
    
    progressContainer.style.display = 'block';
    updateStatus('Converting to MP4...');
    
    if (!converter) {
      converter = new VideoConverter();
      updateStatus('Loading FFmpeg...');
      await converter.loadFFmpeg((message) => {
        console.log('FFmpeg:', message);
      });
    }
    
    const mp4Blob = await converter.convertToMP4(webmBlob, (progress) => {
      progressBar.style.width = progress.progress + '%';
      progressText.textContent = progress.message;
    });
    
    const mp4Url = URL.createObjectURL(mp4Blob);
    createDownloadLink('mp4-download', mp4Url, 'recording.mp4', 'Download MP4');
    
    updateStatus('Conversion complete!');
    progressContainer.style.display = 'none';
    
  } catch (error) {
    console.error('Failed to convert video:', error);
    updateStatus(`Conversion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function createDownloadLink(containerId: string, url: string, filename: string, text: string): void {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.textContent = text;
  link.className = 'download-link';
  
  container.appendChild(link);
}

function updateUI(recording: boolean): void {
  const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
  const watermarkCheckbox = document.getElementById('watermarkEnabled') as HTMLInputElement;
  const watermarkText = document.getElementById('watermarkText') as HTMLInputElement;
  
  startBtn.disabled = recording;
  stopBtn.disabled = !recording;
  watermarkCheckbox.disabled = recording;
  watermarkText.disabled = recording;
  
  if (recording) {
    startBtn.classList.add('disabled');
    stopBtn.classList.remove('disabled');
  } else {
    startBtn.classList.remove('disabled');
    stopBtn.classList.add('disabled');
  }
}

function updateStatus(message: string): void {
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function updateTimer(time: string): void {
  const timerElement = document.getElementById('timer');
  if (timerElement) {
    timerElement.textContent = time;
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  startBtn?.addEventListener('click', startRecording);
  stopBtn?.addEventListener('click', stopRecording);
  
  updateUI(false);
});
