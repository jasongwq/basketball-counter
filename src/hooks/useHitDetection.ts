import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioAnalyzerData } from './useAudioAnalyzer';

export interface HitDetectionResult {
  hitCount: number;
  hitsPerMinute: number;
  duration: number;
  lastHitTime: number | null;
  peakFrequency: number;
  averageEnergy: number;
}

export interface UseHitDetectionOptions {
  energyThreshold?: number;
  minHitInterval?: number;
  decayRate?: number;
}

export interface UseHitDetectionReturn {
  result: HitDetectionResult;
  isDetecting: boolean;
  currentEnergy: number;
  startDetection: () => void;
  stopDetection: () => void;
  resetStats: () => void;
  setThreshold: (value: number) => void;
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
    decayRate = 0.95
  } = options;

  const [result, setResult] = useState<HitDetectionResult>({
    hitCount: 0,
    hitsPerMinute: 0,
    duration: 0,
    lastHitTime: null,
    peakFrequency: 0,
    averageEnergy: 0
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

  const setThreshold = useCallback((value: number) => {
    thresholdRef.current = value;
  }, []);

  const resetStats = useCallback(() => {
    setResult({
      hitCount: 0,
      hitsPerMinute: 0,
      duration: 0,
      lastHitTime: null,
      peakFrequency: 0,
      averageEnergy: 0
    });
    hitCountRef.current = 0;
    lastHitTimeRef.current = null;
    startTimeRef.current = null;
    energyHistoryRef.current = [];
    peakFrequencyRef.current = 0;
  }, []);

  const detectHits = useCallback(() => {
    if (!isListening) return;

    const audioData = getAudioData();
    const { energy, frequencyData, timeDomainData } = audioData;

    setCurrentEnergy(energy);

    const currentTime = Date.now();
    const frequency = calculateDominantFrequency(frequencyData);
    
    if (frequency > peakFrequencyRef.current) {
      peakFrequencyRef.current = frequency;
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
                          (currentTime - lastHitTimeRef.current) > minHitInterval;

    if (isAboveThreshold && canDetectHit) {
      hitCountRef.current += 1;
      lastHitTimeRef.current = currentTime;
    }

    const hitsPerMinute = minutes > 0 ? hitCountRef.current / minutes : 0;

    setResult({
      hitCount: hitCountRef.current,
      hitsPerMinute: Math.round(hitsPerMinute * 10) / 10,
      duration,
      lastHitTime: lastHitTimeRef.current,
      peakFrequency: peakFrequencyRef.current,
      averageEnergy: Math.round(averageEnergy * 10) / 10
    });

    animationFrameRef.current = requestAnimationFrame(detectHits);
  }, [getAudioData, isListening, minHitInterval]);

  function calculateDominantFrequency(frequencyData: Uint8Array): number {
    let maxIndex = 0;
    let maxValue = 0;
    
    for (let i = 0; i < frequencyData.length; i++) {
      if (frequencyData[i] > maxValue) {
        maxValue = frequencyData[i];
        maxIndex = i;
      }
    }
    
    const nyquist = 22050;
    const frequency = (maxIndex * nyquist) / frequencyData.length;
    return frequency;
  }

  const startDetection = useCallback(() => {
    if (!isListening) return;
    
    resetStats();
    setIsDetecting(true);
    startTimeRef.current = Date.now();
    animationFrameRef.current = requestAnimationFrame(detectHits);
  }, [isListening, resetStats, detectHits]);

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
    getAudioData
  };
}
