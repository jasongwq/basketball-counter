import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioAnalyzerData } from './useAudioAnalyzer';

export interface HitDetectionResult {
  hitCount: number;
  hitsPerMinute: number;
  duration: number;
  lastHitTime: number | null;
  peakFrequency: number;
  averageEnergy: number;
  lastHitFrequency: number;
  frequencyHistory: { time: number; frequency: number }[];
  noiseLevel: number;
  adaptiveThreshold: number;
  confidence: number;
}

export interface UseHitDetectionOptions {
  energyThreshold?: number;
  minHitInterval?: number;
  decayRate?: number;
  minFrequency?: number;
  maxFrequency?: number;
  useAdaptiveThreshold?: boolean;
  useMultiFeature?: boolean;
  calibrationDuration?: number;
}

export interface UseHitDetectionReturn {
  result: HitDetectionResult;
  isDetecting: boolean;
  isCalibrating: boolean;
  currentEnergy: number;
  currentConfidence: number;
  calibrationProgress: number;
  startDetection: () => void;
  stopDetection: () => void;
  resetStats: () => void;
  setThreshold: (value: number) => void;
  setFrequencyRange: (min: number, max: number) => void;
  startCalibration: () => Promise<void>;
  getAudioData: () => AudioAnalyzerData;
}

export function useHitDetection(
  getAudioData: () => AudioAnalyzerData,
  isListening: boolean,
  options: UseHitDetectionOptions = {}
): UseHitDetectionReturn {
  const {
    energyThreshold = 80,
    minHitInterval = 250,
    decayRate = 0.95,
    minFrequency = 20,
    maxFrequency = 500,
    useAdaptiveThreshold = true,
    useMultiFeature = true,
    calibrationDuration = 2000
  } = options;

  const [result, setResult] = useState<HitDetectionResult>({
    hitCount: 0,
    hitsPerMinute: 0,
    duration: 0,
    lastHitTime: null,
    peakFrequency: 0,
    averageEnergy: 0,
    lastHitFrequency: 0,
    frequencyHistory: [],
    noiseLevel: 0,
    adaptiveThreshold: energyThreshold,
    confidence: 0
  });

  const [currentEnergy, setCurrentEnergy] = useState(0);
  const [currentConfidence, setCurrentConfidence] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  const animationFrameRef = useRef<number | null>(null);
  const calibrationFrameRef = useRef<number | null>(null);
  const lastHitTimeRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hitCountRef = useRef(0);
  const energyHistoryRef = useRef<number[]>([]);
  const thresholdRef = useRef(energyThreshold);
  const peakFrequencyRef = useRef(0);
  const lastHitFrequencyRef = useRef(0);
  const frequencyHistoryRef = useRef<{ time: number; frequency: number }[]>([]);
  const minFrequencyRef = useRef(minFrequency);
  const maxFrequencyRef = useRef(maxFrequency);
  const minHitIntervalRef = useRef(minHitInterval);
  const noiseLevelRef = useRef(0);
  const adaptiveThresholdRef = useRef(energyThreshold);
  const useAdaptiveThresholdRef = useRef(useAdaptiveThreshold);
  const useMultiFeatureRef = useRef(useMultiFeature);
  const noiseSamplesRef = useRef<number[]>([]);
  const peakHistoryRef = useRef<number[]>([]);
  const recentHitsRef = useRef<{ time: number; energy: number; confidence: number }[]>([]);

  const setThreshold = useCallback((value: number) => {
    thresholdRef.current = value;
  }, []);

  const setFrequencyRange = useCallback((min: number, max: number) => {
    minFrequencyRef.current = min;
    maxFrequencyRef.current = max;
  }, []);

  const resetStats = useCallback(() => {
    setResult({
      hitCount: 0,
      hitsPerMinute: 0,
      duration: 0,
      lastHitTime: null,
      peakFrequency: 0,
      averageEnergy: 0,
      lastHitFrequency: 0,
      frequencyHistory: [],
      noiseLevel: 0,
      adaptiveThreshold: adaptiveThresholdRef.current,
      confidence: 0
    });
    hitCountRef.current = 0;
    lastHitTimeRef.current = null;
    startTimeRef.current = null;
    energyHistoryRef.current = [];
    peakFrequencyRef.current = 0;
    lastHitFrequencyRef.current = 0;
    frequencyHistoryRef.current = [];
    peakHistoryRef.current = [];
    recentHitsRef.current = [];
  }, []);

  function calculateEnergyInRange(frequencyData: Uint8Array, minFreq: number, maxFreq: number): number {
    const nyquist = 22050;
    const binSize = nyquist / frequencyData.length;
    const minIndex = Math.floor(minFreq / binSize);
    const maxIndex = Math.min(Math.ceil(maxFreq / binSize), frequencyData.length - 1);
    
    let sum = 0;
    let count = 0;
    for (let i = minIndex; i <= maxIndex; i++) {
      sum += frequencyData[i] * frequencyData[i];
      count++;
    }
    
    return count > 0 ? Math.sqrt(sum / count) : 0;
  }

  function calculateDominantFrequency(frequencyData: Uint8Array, minFreq: number, maxFreq: number): number {
    const nyquist = 22050;
    const binSize = nyquist / frequencyData.length;
    const minIndex = Math.floor(minFreq / binSize);
    const maxIndex = Math.min(Math.ceil(maxFreq / binSize), frequencyData.length - 1);
    
    let maxValue = 0;
    let dominantIndex = 0;
    
    for (let i = minIndex; i <= maxIndex; i++) {
      if (frequencyData[i] > maxValue) {
        maxValue = frequencyData[i];
        dominantIndex = i;
      }
    }
    
    const frequency = (dominantIndex * nyquist) / frequencyData.length;
    return Math.round(frequency);
  }

  function calculateTimeDomainEnergy(timeDomainData: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
      const val = (timeDomainData[i] - 128) / 128;
      sum += val * val;
    }
    return Math.sqrt(sum / timeDomainData.length);
  }

  function calculateSignalStability(timeDomainData: Uint8Array): number {
    const firstHalf = Array.from(timeDomainData.slice(0, timeDomainData.length / 2));
    const secondHalf = Array.from(timeDomainData.slice(timeDomainData.length / 2));
    
    const mean1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const mean2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const diff = Math.abs(mean1 - mean2) / 128;
    return Math.min(diff * 5, 1);
  }

  function calculateConfidence(
    energy: number,
    timeDomainEnergy: number,
    stability: number,
    inRange: boolean
  ): number {
    if (!useMultiFeatureRef.current) {
      return inRange ? 1 : 0;
    }

    const energyScore = Math.min(energy / 200, 1);
    const timeDomainScore = Math.min(timeDomainEnergy * 10, 1);
    const stabilityScore = stability;
    const rangeScore = inRange ? 1 : 0;

    const confidence = (
      energyScore * 0.4 +
      timeDomainScore * 0.25 +
      stabilityScore * 0.15 +
      rangeScore * 0.2
    );

    return Math.min(Math.max(confidence, 0), 1);
  }

  const calibrate = useCallback(async () => {
    if (!isListening) return;

    setIsCalibrating(true);
    setCalibrationProgress(0);
    noiseSamplesRef.current = [];
    
    const startTime = Date.now();
    
    const collectSample = () => {
      const audioData = getAudioData();
      const rangeEnergy = calculateEnergyInRange(
        audioData.frequencyData,
        minFrequencyRef.current,
        maxFrequencyRef.current
      );
      noiseSamplesRef.current.push(rangeEnergy);
      
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / calibrationDuration, 1);
      setCalibrationProgress(progress);
      
      if (elapsed < calibrationDuration) {
        calibrationFrameRef.current = requestAnimationFrame(collectSample);
      } else {
        const samples = noiseSamplesRef.current;
        const avgNoise = samples.reduce((a, b) => a + b, 0) / samples.length;
        const stdDev = Math.sqrt(
          samples.reduce((sum, val) => sum + Math.pow(val - avgNoise, 2), 0) / samples.length
        );
        noiseLevelRef.current = avgNoise;
        const newThreshold = avgNoise + stdDev * 3 + 15;
        adaptiveThresholdRef.current = Math.max(newThreshold, 30);
        thresholdRef.current = adaptiveThresholdRef.current;
        
        setResult(prev => ({
          ...prev,
          noiseLevel: Math.round(avgNoise),
          adaptiveThreshold: Math.round(adaptiveThresholdRef.current)
        }));
        
        setIsCalibrating(false);
        setCalibrationProgress(1);
      }
    };
    
    calibrationFrameRef.current = requestAnimationFrame(collectSample);
  }, [isListening, getAudioData, calibrationDuration]);

  const detectHits = useCallback(() => {
    if (!isListening) return;

    const audioData = getAudioData();
    const { frequencyData, timeDomainData } = audioData;

    const rangeEnergy = calculateEnergyInRange(
      frequencyData,
      minFrequencyRef.current,
      maxFrequencyRef.current
    );
    const timeDomainEnergy = calculateTimeDomainEnergy(timeDomainData);
    const stability = calculateSignalStability(timeDomainData);
    const dominantFrequency = calculateDominantFrequency(
      frequencyData,
      minFrequencyRef.current,
      maxFrequencyRef.current
    );
    
    const isInFrequencyRange = dominantFrequency >= minFrequencyRef.current && 
                                dominantFrequency <= maxFrequencyRef.current;
    
    const confidence = calculateConfidence(
      rangeEnergy,
      timeDomainEnergy,
      stability,
      isInFrequencyRange
    );
    
    setCurrentEnergy(rangeEnergy);
    setCurrentConfidence(confidence);

    const currentTime = Date.now();
    
    if (dominantFrequency > peakFrequencyRef.current) {
      peakFrequencyRef.current = dominantFrequency;
    }

    energyHistoryRef.current.push(rangeEnergy);
    if (energyHistoryRef.current.length > 100) {
      energyHistoryRef.current.shift();
    }

    const averageEnergy = energyHistoryRef.current.reduce((a, b) => a + b, 0) / 
                         (energyHistoryRef.current.length || 1);

    if (startTimeRef.current === null) {
      startTimeRef.current = currentTime;
    }

    const duration = currentTime - startTimeRef.current;
    const minutes = duration / 60000;

    const effectiveThreshold = useAdaptiveThresholdRef.current 
      ? adaptiveThresholdRef.current 
      : thresholdRef.current;
    
    const isAboveThreshold = rangeEnergy > effectiveThreshold;
    const canDetectHit = lastHitTimeRef.current === null || 
                          (currentTime - lastHitTimeRef.current) > minHitIntervalRef.current;
    
    peakHistoryRef.current.push(rangeEnergy);
    if (peakHistoryRef.current.length > 5) {
      peakHistoryRef.current.shift();
    }
    const recentPeak = Math.max(...peakHistoryRef.current);
    const isPeak = rangeEnergy >= recentPeak && rangeEnergy > effectiveThreshold;

    if (useMultiFeatureRef.current && confidence > 0.5 && isPeak && canDetectHit) {
      recentHitsRef.current.push({ time: currentTime, energy: rangeEnergy, confidence });
      if (recentHitsRef.current.length > 20) {
        recentHitsRef.current.shift();
      }
      
      hitCountRef.current += 1;
      lastHitTimeRef.current = currentTime;
      lastHitFrequencyRef.current = dominantFrequency;
      frequencyHistoryRef.current.push({
        time: currentTime,
        frequency: dominantFrequency
      });
      if (frequencyHistoryRef.current.length > 50) {
        frequencyHistoryRef.current.shift();
      }
    } else if (!useMultiFeatureRef.current && isAboveThreshold && isPeak && canDetectHit) {
      if (isInFrequencyRange) {
        hitCountRef.current += 1;
        lastHitTimeRef.current = currentTime;
        lastHitFrequencyRef.current = dominantFrequency;
        frequencyHistoryRef.current.push({
          time: currentTime,
          frequency: dominantFrequency
        });
        if (frequencyHistoryRef.current.length > 50) {
          frequencyHistoryRef.current.shift();
        }
      }
    }

    const hitsPerMinute = minutes > 0 ? hitCountRef.current / minutes : 0;

    setResult({
      hitCount: hitCountRef.current,
      hitsPerMinute: Math.round(hitsPerMinute * 10) / 10,
      duration,
      lastHitTime: lastHitTimeRef.current,
      peakFrequency: peakFrequencyRef.current,
      averageEnergy: Math.round(averageEnergy * 10) / 10,
      lastHitFrequency: lastHitFrequencyRef.current,
      frequencyHistory: [...frequencyHistoryRef.current],
      noiseLevel: Math.round(noiseLevelRef.current),
      adaptiveThreshold: Math.round(adaptiveThresholdRef.current),
      confidence: Math.round(confidence * 100) / 100
    });

    animationFrameRef.current = requestAnimationFrame(detectHits);
  }, [getAudioData, isListening]);

  const startDetection = useCallback(async () => {
    if (!isListening) return;
    
    if (useAdaptiveThresholdRef.current && noiseLevelRef.current === 0) {
      await calibrate();
    }
    
    resetStats();
    setIsDetecting(true);
    startTimeRef.current = Date.now();
    minHitIntervalRef.current = minHitInterval;
    useAdaptiveThresholdRef.current = useAdaptiveThreshold;
    useMultiFeatureRef.current = useMultiFeature;
    peakHistoryRef.current = [];
    animationFrameRef.current = requestAnimationFrame(detectHits);
  }, [isListening, resetStats, detectHits, calibrate, minHitInterval, useAdaptiveThreshold, useMultiFeature]);

  const stopDetection = useCallback(() => {
    setIsDetecting(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (calibrationFrameRef.current) {
      cancelAnimationFrame(calibrationFrameRef.current);
      calibrationFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (calibrationFrameRef.current) {
        cancelAnimationFrame(calibrationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isListening) {
      stopDetection();
      setIsCalibrating(false);
    }
  }, [isListening, stopDetection]);

  return {
    result,
    isDetecting,
    isCalibrating,
    currentEnergy,
    currentConfidence,
    calibrationProgress,
    startDetection,
    stopDetection,
    resetStats,
    setThreshold,
    setFrequencyRange,
    startCalibration: calibrate,
    getAudioData
  };
}
