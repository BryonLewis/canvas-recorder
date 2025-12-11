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
let fallbackCanvas: HTMLCanvasElement | null = null;
let animationFrameId: number | null = null;
let animationStartTime: number = 0;
let totalSeconds: number = 0;
function initMap(): void {
  // Try to load MapLibre with demo tiles, but handle errors gracefully
  try {
    map = new maplibregl.Map({
      canvasContextAttributes: { preserveDrawingBuffer: true },
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
      center: [-74.1847, 43.1339],
      zoom: 9,
      bearing: 0,
      pitch: 0
    });

    map.on('load', () => {
      console.log('Map loaded successfully');
      addGeoJSONLayer();
      updateStatus('Map loaded. Ready to record.');
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
    if (!ctx) return;
    
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
  
  // Store reference to fallback canvas
  fallbackCanvas = canvas;
}

// Sample GeoJSON data - animated points and a route
function getGeoJSONData(): any {
  // Center coordinates: [-74.1847, 43.1339]
  const centerLon = -74.1847;
  const centerLat = 43.1339;
  
  return {
    type: 'FeatureCollection',
    features: [
      // Animated route line
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [centerLon - 0.1, centerLat + 0.05],
            [centerLon - 0.05, centerLat + 0.08],
            [centerLon, centerLat + 0.1],
            [centerLon + 0.05, centerLat + 0.08],
            [centerLon + 0.1, centerLat + 0.05],
            [centerLon + 0.15, centerLat]
          ]
        }
      },
      // Animated points
      {
        type: 'Feature',
        properties: { id: 'point1', baseLon: centerLon - 0.05, baseLat: centerLat - 0.05 },
        geometry: {
          type: 'Point',
          coordinates: [centerLon - 0.05, centerLat - 0.05]
        }
      },
      {
        type: 'Feature',
        properties: { id: 'point2', baseLon: centerLon + 0.05, baseLat: centerLat - 0.03 },
        geometry: {
          type: 'Point',
          coordinates: [centerLon + 0.05, centerLat - 0.03]
        }
      },
      {
        type: 'Feature',
        properties: { id: 'point3', baseLon: centerLon - 0.08, baseLat: centerLat + 0.05 },
        geometry: {
          type: 'Point',
          coordinates: [centerLon - 0.08, centerLat + 0.05]
        }
      },
      {
        type: 'Feature',
        properties: { id: 'point4', baseLon: centerLon + 0.08, baseLat: centerLat + 0.08 },
        geometry: {
          type: 'Point',
          coordinates: [centerLon + 0.08, centerLat + 0.08]
        }
      }
    ]
  };
}

function addGeoJSONLayer(): void {
  if (!map) return;

  // Add GeoJSON source
  map.addSource('geojson-data', {
    type: 'geojson',
    data: getGeoJSONData()
  });

  // Add circle layer for points
  map.addLayer({
    id: 'geojson-points',
    type: 'circle',
    source: 'geojson-data',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['get', 'animation-phase'],
        0, 8,
        1, 20
      ],
      'circle-color': [
        'interpolate',
        ['linear'],
        ['get', 'animation-phase'],
        0, '#ff0000',
        0.5, '#00ff00',
        1, '#0000ff'
      ],
      'circle-opacity': 0.8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff'
    }
  });

  // Add line layer for route
  map.addLayer({
    id: 'geojson-line',
    type: 'line',
    source: 'geojson-data',
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: {
      'line-color': '#4a9eff',
      'line-width': 4,
      'line-opacity': [
        'interpolate',
        ['linear'],
        ['get', 'animation-phase'],
        0, 0.3,
        1, 1
      ]
    }
  });

  // Start animation
  startGeoJSONAnimation();
}

function startGeoJSONAnimation(): void {
  if (!map) return;
  
  const source = map.getSource('geojson-data') as maplibregl.GeoJSONSource;
  if (!source) return;

  animationStartTime = Date.now();
  
  function animate() {
    if (!map || !source) return;

    const geojsonCheckbox = document.getElementById('geojsonEnabled') as HTMLInputElement;
    if (!geojsonCheckbox || !geojsonCheckbox.checked) {
      animationFrameId = null;
      return;
    }

    const elapsed = (Date.now() - animationStartTime) / 1000;
    const phase = (Math.sin(elapsed * 2) + 1) / 2; // 0 to 1 oscillation

    // Get original data
    const originalData = getGeoJSONData();
    
    // Update point positions with animation
    const animatedFeatures = originalData.features.map((feature: any) => {
      if (feature.geometry.type === 'Point' && feature.properties) {
        const props = feature.properties as any;
        const radius = 0.01 * Math.sin(elapsed * 2 + parseInt(props.id.replace('point', '')));
        const newLon = props.baseLon + radius * Math.cos(elapsed * 1.5);
        const newLat = props.baseLat + radius * Math.sin(elapsed * 1.5);
        
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: [newLon, newLat]
          },
          properties: {
            ...props,
            'animation-phase': phase
          }
        };
      } else if (feature.geometry.type === 'LineString') {
        return {
          ...feature,
          properties: {
            'animation-phase': phase
          }
        };
      }
      return feature;
    });

    // Update source with animated data
    source.setData({
      type: 'FeatureCollection',
      features: animatedFeatures
    });

    animationFrameId = requestAnimationFrame(animate);
  }

  animate();
}

function toggleGeoJSONLayer(enabled: boolean): void {
  if (!map) return;

  const pointsLayer = map.getLayer('geojson-points');
  const lineLayer = map.getLayer('geojson-line');

  if (enabled) {
    if (pointsLayer) {
      map.setLayoutProperty('geojson-points', 'visibility', 'visible');
    }
    if (lineLayer) {
      map.setLayoutProperty('geojson-line', 'visibility', 'visible');
    }
    // Restart animation if not already running
    if (!animationFrameId) {
      startGeoJSONAnimation();
    }
  } else {
    if (pointsLayer) {
      map.setLayoutProperty('geojson-points', 'visibility', 'none');
    }
    if (lineLayer) {
      map.setLayoutProperty('geojson-line', 'visibility', 'none');
    }
    // Stop animation
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }
}

function initRecorder(): void {
  const mapCanvas = fallbackCanvas || (map ? map.getCanvas() : null);
  
  if (!mapCanvas) {
    throw new Error('No canvas available for recording');
  }
  
  const watermarkCheckbox = document.getElementById('watermarkEnabled') as HTMLInputElement;
  const watermarkText = document.getElementById('watermarkText') as HTMLInputElement;
  const fpsInput = document.getElementById('fps') as HTMLInputElement;
  const bitrateInput = document.getElementById('bitrate') as HTMLInputElement;

  // Get FPS and bitrate from UI controls
  const fps = parseInt(fpsInput.value, 10) || 30;
  const bitrateMbps = parseFloat(bitrateInput.value) || 5.0; // Increased default to 5 Mbps for better quality
  const videoBitsPerSecond = Math.round(bitrateMbps * 1000000); // Convert Mbps to bps

  const options: any = {
    canvas: mapCanvas,
    fps: fps,
    videoBitsPerSecond: videoBitsPerSecond
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
    // Clear previous download links
    const webmDownload = document.getElementById('webm-download');
    const mp4Download = document.getElementById('mp4-download');
    if (webmDownload) webmDownload.innerHTML = '';
    if (mp4Download) mp4Download.innerHTML = '';
    
    // Hide convert buttons when starting new recording
    const convertBtn = document.getElementById('convertBtn') as HTMLButtonElement;
    const convertAndDownloadBtn = document.getElementById('convertAndDownloadBtn') as HTMLButtonElement;
    if (convertBtn) convertBtn.style.display = 'none';
    if (convertAndDownloadBtn) convertAndDownloadBtn.style.display = 'none';
    
    // Reset timer
    updateTimer('00:00', 0);
    
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
      updateTimer(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`, elapsed);
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
    const durationSeconds = Math.floor(recordingData.duration / 1000);
    updateStatus('Recording stopped. Duration: ' + (recordingData.duration / 1000).toFixed(2) + 's');
    
    // Update totalSeconds with the recording duration
    totalSeconds = durationSeconds;
    
    // Create download link for WebM
    createDownloadLink('webm-download', recordingData.url, 'recording.webm', 'Download WebM');
    
    // Show conversion buttons
    const convertBtn = document.getElementById('convertBtn') as HTMLButtonElement;
    const convertAndDownloadBtn = document.getElementById('convertAndDownloadBtn') as HTMLButtonElement;
    convertBtn.style.display = 'block';
    convertAndDownloadBtn.style.display = 'block';
    convertBtn.onclick = () => convertToMP4(recordingData.blob, false);
    convertAndDownloadBtn.onclick = () => convertToMP4(recordingData.blob, true);
    
  } catch (error) {
    console.error('Failed to stop recording:', error);
    updateStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Clear data and reset timer
    updateTimer('00:00', 0);
    
    // Clear progress container
    const progressContainer = document.getElementById('progressContainer') as HTMLDivElement;
    progressContainer.style.display = 'none';
    
    // Restart GeoJSON animation if enabled
    const geojsonCheckbox = document.getElementById('geojsonEnabled') as HTMLInputElement;
    if (geojsonCheckbox && geojsonCheckbox.checked && map) {
      startGeoJSONAnimation();
    }
  }
}

async function convertToMP4(webmBlob: Blob, autoDownload: boolean = false): Promise<void> {
  try {
    const progressBar = document.getElementById('progressBar') as HTMLDivElement;
    const progressText = document.getElementById('progressText') as HTMLDivElement;
    const progressContainer = document.getElementById('progressContainer') as HTMLDivElement;
    
    // Reset progress bar
    progressBar.style.width = '0%';
    progressText.textContent = 'Initializing...';
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
      // Calculate progress percentage based on time elapsed vs total recording duration
      // progress.time is in seconds (as a string from the worker, need to parse)
      const elapsedTime = typeof progress.time === 'string' ? parseFloat(progress.time) : progress.time;
      let progressValue = 0;
      
      if (totalSeconds > 0) {
        // Progress is based on how much of the video has been processed
        // FFmpeg processes the video, so progress = elapsed time / total duration
        progressValue = Math.min(100, Math.max(0, (elapsedTime / totalSeconds) * 100));
      } else {
        // Fallback: if totalSeconds not set, use a simple time-based estimate
        // Assume conversion takes roughly the same time as the video duration
        progressValue = Math.min(95, elapsedTime * 10); // Rough estimate
      }
      
      progressBar.style.width = progressValue + '%';
      progressText.textContent = `${progress.message} (${Math.round(progressValue)}%)`;
    });
    
    const mp4Url = URL.createObjectURL(mp4Blob);
    
    if (autoDownload) {
      // Automatically trigger download
      const link = document.createElement('a');
      link.href = mp4Url;
      link.download = 'recording.mp4';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      updateStatus('Conversion complete! MP4 downloaded.');
    } else {
      // Create download link
      createDownloadLink('mp4-download', mp4Url, 'recording.mp4', 'Download MP4');
      updateStatus('Conversion complete!');
    }
    
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
  const fpsInput = document.getElementById('fps') as HTMLInputElement;
  const bitrateInput = document.getElementById('bitrate') as HTMLInputElement;
  const geojsonCheckbox = document.getElementById('geojsonEnabled') as HTMLInputElement;
  
  startBtn.disabled = recording;
  stopBtn.disabled = !recording;
  watermarkCheckbox.disabled = recording;
  watermarkText.disabled = recording;
  fpsInput.disabled = recording;
  bitrateInput.disabled = recording;
  geojsonCheckbox.disabled = recording;
  
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

function updateTimer(time: string, seconds?: number): void {
  const timerElement = document.getElementById('timer');
  if (timerElement) {
    timerElement.textContent = time;
  }
  // Update totalSeconds if provided
  if (seconds !== undefined) {
    totalSeconds = seconds;
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const geojsonCheckbox = document.getElementById('geojsonEnabled') as HTMLInputElement;
  
  startBtn?.addEventListener('click', startRecording);
  stopBtn?.addEventListener('click', stopRecording);
  
  // Handle GeoJSON layer toggle
  geojsonCheckbox?.addEventListener('change', (e) => {
    const enabled = (e.target as HTMLInputElement).checked;
    toggleGeoJSONLayer(enabled);
  });
  
  // Initialize GeoJSON layer state
  if (geojsonCheckbox) {
    toggleGeoJSONLayer(geojsonCheckbox.checked);
  }
  
  updateUI(false);
});
