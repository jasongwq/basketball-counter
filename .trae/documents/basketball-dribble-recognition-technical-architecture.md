# Basketball Dribble Sound Recognition - Technical Architecture

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Frontend Application                      │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │    UI Layer    │  │  Business Logic │  │  ML/Audio Core  │   │
│  │  React + Vite  │  │    Zustand      │  │  TensorFlow.js  │   │
│  │  Tailwind CSS  │  │   State Mgmt    │  │ Web Audio API   │   │
│  └────────────────┘  └─────────────────┘  └─────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│                        Web APIs & Technologies                   │
│  MediaDevices API │ Web Audio API │ Web Audio Worklet │ Canvas  │
│  WebGL / Three.js │ TensorFlow.js │ AudioWorkletProcessor        │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Technology Stack

### Core Technologies
- **Frontend Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Audio Processing**: Web Audio API + Web Audio Worklet
- **Machine Learning**: TensorFlow.js with pre-trained audio classification model
- **Visualization**: Canvas 2D + WebGL (optional for 3D effects)

### Advanced Features
- **Web Audio Worklet**: High-performance audio processing in separate thread
- **TensorFlow.js**: Real-time audio feature extraction and classification
- **Audio Sprite**: Efficient audio asset management
- **Offline Audio Context**: Processing without playback

## 3. Route Definitions

Single Page Application (SPA) - no routing required.

| Route | Purpose |
|-------|---------|
| / | Main page - audio capture, ML detection, visualization |

## 4. Core Modules Design

### 4.1 Audio Processing Module (AudioWorkletProcessor)

**Purpose**: High-performance audio processing in dedicated audio rendering thread

**Implementation**:
```typescript
// audio-processor.worklet.ts
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    // Process audio in real-time without blocking main thread
    const input = inputs[0];
    // Extract features: amplitude, frequency, etc.
    // Pass to ML model for classification
    return true;
  }
}
```

**Key Features**:
- Runs in separate audio rendering thread
- Low-latency audio analysis
- No main thread blocking
- SharedArrayBuffer for data transfer (if available)

### 4.2 ML Detection Module (DribbleClassifier)

**Purpose**: TensorFlow.js based audio classification for accurate dribble detection

**Implementation**:
```typescript
interface DribbleClassifier {
  model: tf.LayersModel;
  labels: string[]; // ['dribble', 'background', 'other']
  
  async loadModel(): Promise<void>;
  predict(audioFeatures: Float32Array): Promise<ClassificationResult>;
  extractFeatures(audioBuffer: AudioBuffer): Float32Array;
}
```

**Model Architecture**:
- Input: Mel-spectrogram (64x64) or MFCC features
- Layers: Conv2D → MaxPooling → Conv2D → Dense → Softmax
- Output: Probability distribution over sound classes

**Feature Extraction Pipeline**:
1. Audio buffer → Resample to 16kHz
2. Extract Mel-spectrogram (64 mel bins, 64 time frames)
3. Normalize to [0, 1] range
4. Reshape to 4D tensor [1, 64, 64, 1]
5. Feed to TensorFlow.js model

### 4.3 Real-time Visualizer (AudioVisualizer)

**Purpose**: GPU-accelerated audio visualization with stunning effects

**Components**:
1. **Waveform Display**: Real-time audio waveform with glow effects
2. **Spectrum Analyzer**: Frequency spectrum with 3D bar chart
3. **Dribble Event Visualizer**: Ripple effects on detected dribbles
4. **Particle System**: Celebration particles on milestones

**Implementation**:
```typescript
interface AudioVisualizer {
  waveformCtx: CanvasRenderingContext2D;
  spectrumCtx: WebGLRenderingContext;
  
  drawWaveform(data: Float32Array): void;
  drawSpectrum(frequencies: Uint8Array): void;
  emitDribbleParticles(x: number, y: number): void;
  render(): void;
}
```

**Visual Effects**:
- Glow and bloom effects on peaks
- Particle explosions on dribble detection
- Smooth interpolation between frames
- 60fps animation target with adaptive quality

### 4.4 Statistics Module (TrainingStats)

**Purpose**: Comprehensive training statistics and analytics

**Features**:
- Real-time dribble count with animations
- Frequency calculation (dribbles/minute)
- Session duration tracking
- Peak performance detection
- Session history storage (IndexedDB)

```typescript
interface TrainingSession {
  id: string;
  startTime: Date;
  endTime: Date | null;
  dribbleCount: number;
  peakFrequency: number;
  averageFrequency: number;
}
```

## 5. Advanced Features

### 5.1 Sound Recognition Pipeline

```
Microphone → MediaStream → AudioWorklet → Feature Extraction →
    ↓
TensorFlow.js Model → Classification → Dribble Detection →
    ↓
UI Update + Particle Effects + Statistics Update
```

### 5.2 Model Training Pipeline

**Training Data**:
- Collect basketball dribble sounds (positive samples)
- Collect background noises (negative samples)
- Data augmentation: pitch shift, time stretch, noise injection

**Model Training**:
```python
# Training script (Python/TensorFlow)
model = Sequential([
  Conv2D(32, (3,3), activation='relu', input_shape=(64, 64, 1)),
  MaxPooling2D((2,2)),
  Conv2D(64, (3,3), activation='relu'),
  MaxPooling2D((2,2)),
  Flatten(),
  Dense(128, activation='relu'),
  Dense(3, activation='softmax')  # dribble, background, other
])

model.compile(optimizer='adam', loss='categorical_crossentropy')
```

**Conversion for Web**:
```bash
# Convert to TensorFlow.js format
tensorflowjs_converter --input_format=tf_saved_model \
  --output_format=tfjs_graph_model \
  --signature=default \
  ./models/dribble_detector \
  ./public/models/dribble_detector
```

### 5.3 Performance Optimization

1. **Web Audio Worklet**: Process audio in dedicated thread
2. **TensorFlow.js Optimization**:
   - Use WebGL backend for GPU acceleration
   - Enable Web Workers for inference
   - Quantize model for faster inference
3. **Canvas Rendering**:
   - Use requestAnimationFrame for smooth animations
   - Implement canvas double buffering
   - Use CSS transforms for layout animations
4. **Memory Management**:
   - Release AudioContext on component unmount
   - Clear TensorFlow tensors after use
   - Limit particle system size

### 5.4 Fallback Strategy

If TensorFlow.js is not fully supported:
- Use Web Audio API AnalyserNode for basic detection
- Implement energy-based detection algorithm
- Graceful degradation to simpler UI

## 6. Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Audio Pipeline                            │
├─────────────────────────────────────────────────────────────────┤
│  MediaStream → AudioContext → MediaStreamSource                 │
│      ↓                                                          │
│  ScriptProcessorNode/AudioWorklet (Feature Extraction)          │
│      ↓                                                          │
│  AudioBuffer → MFCC/Mel-Spectrogram → TensorFlow.js Model        │
│      ↓                                                          │
│  Classification Result → Dribble Detection → Statistics         │
└─────────────────────────────────────────────────────────────────┘
```

## 7. Browser Compatibility

- **Modern Browsers**: Chrome 66+, Firefox 76+, Safari 14.1+, Edge 79+
- **Required APIs**:
  - MediaDevices.getUserMedia
  - AudioContext
  - AudioWorklet
  - Canvas 2D
  - TensorFlow.js (WebGL backend)

## 8. File Structure

```
src/
├── components/
│   ├── AudioVisualizer/
│   │   ├── Waveform.tsx
│   │   ├── Spectrum.tsx
│   │   └── ParticleSystem.tsx
│   ├── ControlPanel/
│   │   ├── MicPermission.tsx
│   │   └── StartStopButton.tsx
│   └── StatsPanel/
│       ├── DribbleCounter.tsx
│       └── FrequencyChart.tsx
├── hooks/
│   ├── useAudioContext.ts
│   ├── useAudioWorklet.ts
│   ├── useTensorFlow.ts
│   └── useDribbleDetection.ts
├── utils/
│   ├── audioProcessor.ts
│   ├── featureExtractor.ts
│   └── modelLoader.ts
├── stores/
│   └── trainingStore.ts
├── App.tsx
└── main.tsx
```

This architecture provides:
- **High Performance**: Web Audio Worklet for non-blocking audio processing
- **AI-Powered Detection**: TensorFlow.js for accurate sound classification
- **Stunning Visuals**: Canvas/WebGL for real-time audio visualization
- **Scalability**: Modular design for easy feature additions
