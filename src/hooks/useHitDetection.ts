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
}

export interface UseHitDetectionOptions {
  energyThreshold?: number;
  minHitInterval?: number;
  decayRate?: number;
  minFrequency?: number;
  maxFrequency?: number;
}

export interface UseHitDetectionReturn {
  result: HitDetectionResult;
  isDetecting: boolean;
  currentEnergy: number;
  startDetection: () => void;
  stopDetection: () => void;
  resetStats: () => void;
  setThreshold: (value: number) => void;
  setFrequencyRange: (min: number, max: number) => void;
  getAudioData: () => AudioAnalyzerData;
}

export function useHitDetection(
  getAudioData: () => AudioAnalyzerData,
  isListening: boolean,
  options: UseHitDetectionOptions = {}
): UseHitDetectionReturn {
  const {
    energyThreshold = 80,
    minHitInterval = 300,
    decayRate = 0.95,
    minFrequency = 20,
    maxFrequency = 500
  } = options;

  const [result, setResult] = useState<HitDetectionResult>({
    hitCount: 0,
    hitsPerMinute: 0,
    duration: 0,
    lastHitTime: null,
    peakFrequency: 0,
    averageEnergy: 0,
    lastHitFrequency: 0,
    frequencyHistory: []
  });

  const [currentEnergy, setCurrentEnergy] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);

  const animationFrameRef = useRef<number | null>(null);
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
      frequencyHistory: []
    });
    hitCountRef.current = 0;
    lastHitTimeRef.current = null;
    startTimeRef.current = null;
    energyHistoryRef.current = [];
    peakFrequencyRef.current = 0;
    lastHitFrequencyRef.current = 0;
    frequencyHistoryRef.current = [];
    minHitIntervalRef.current = minHitInterval;
  }, [minHitInterval]);

  const detectHits = useCallback(() => {
    if (!isListening) return;

    const audioData = getAudioData();
    const { energy, frequencyData, timeDomainData } = audioData;

    setCurrentEnergy(energy);

    const currentTime = Date.now();
    const dominantFrequency = calculateDominantFrequency(frequencyData, minFrequencyRef.current, maxFrequencyRef.current);
    
    if (dominantFrequency > peakFrequencyRef.current) {
      peakFrequencyRef.current = dominantFrequency;
    }

    energyHistoryRef.current.push(energy);
    if (energyHistoryRef.current.length > 100) {
      energyHistoryRef.current.shift();
    }

    const averageEnergy = energyHistoryRef.current.reduce((a, b) => a + b, 0) / energyHistoryRef.current.length;

    if (startTimeRef.current === null) {
      startTimeRef.current = currentTime;
    }

    const duration = currentTime - startTimeRef.current;
    const minutes = duration / 60000;

    const isAboveThreshold = energy > thresholdRef.current;
    const canDetectHit = lastHitTimeRef.current === null || 
                          (currentTime - lastHitTimeRef.current) > minHitIntervalRef.current;

    if (isAboveThreshold && canDetectHit) {
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

    const hitsPerMinute = minutes > 0 ? hitCountRef.current / minutes : 0;

    setResult({
      hitCount: hitCountRef.current,
      hitsPerMinute: Math.round(hitsPerMinute * 10) / 10,
      duration,
      lastHitTime: lastHitTimeRef.current,
      peakFrequency: peakFrequencyRef.current,
      averageEnergy: Math.round(averageEnergy * 10) / 10,
      lastHitFrequency: lastHitFrequencyRef.current,
      frequencyHistory: [...frequencyHistoryRef.current]
    });

    animationFrameRef.current = requestAnimationFrame(detectHits);
  }, [getAudioData, isListening]);

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

  const startDetection = useCallback(() => {
    if (!isListening) return;
    
    resetStats();
    setIsDetecting(true);
    startTimeRef.current = Date.now();
    minHitIntervalRef.current = minHitInterval;
    animationFrameRef.current = requestAnimationFrame(detectHits);
  }, [isListening, resetStats, detectHits, minHitInterval]);

  const stopDetection = useCallback(() => {
    setIsDetecting(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isListening) {
      stopDetection();
    }
  }, [isListening, stopDetection]);

  return {
    result,
    isDetecting,
    currentEnergy,
    startDetection,
    stopDetection,
    resetStats,
    setThreshold,
    setFrequencyRange,
    getAudioData
  };
}
