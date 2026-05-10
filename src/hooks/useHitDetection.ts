import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioAnalyzerData } from './useAudioAnalyzer';

export interface HitRecord {
  id: number;
  timestamp: Date;
  absoluteTime: string;
  relativeTime: string;
  frequency: number;
  energy: number;
  timeDomainEnergy: number;
  stability: number;
  confidence: number;
  peakFrequency: number;
  riseTime: number;
  spectralCentroid: number;
  zeroCrossingRate: number;
  isShortBurst: boolean;
}

export interface HitDetectionResult {
  hitCount: number;
  hitsPerMinute: number;
  duration: number;
  lastHitTime: number | null;
  peakFrequency: number;
  averageEnergy: number;
  lastHitFrequency: number;
  frequencyHistory: HitRecord[];
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
  confidenceThreshold?: number;
  peakWindowSize?: number;
  energyWeight?: number;
  timeDomainWeight?: number;
  stabilityWeight?: number;
  rangeWeight?: number;
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
  setMinHitInterval: (value: number) => void;
  setConfidenceThreshold: (value: number) => void;
  setPeakWindowSize: (value: number) => void;
  setWeights: (weights: { energy?: number; timeDomain?: number; stability?: number; range?: number }) => void;
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
    minFrequency = 50,
    maxFrequency = 300,
    useAdaptiveThreshold = true,
    useMultiFeature = true,
    calibrationDuration = 2000,
    confidenceThreshold = 0.5,
    peakWindowSize = 5,
    energyWeight = 0.4,
    timeDomainWeight = 0.25,
    stabilityWeight = 0.15,
    rangeWeight = 0.2
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
  const frequencyHistoryRef = useRef<HitRecord[]>([]);
  const hitIdCounterRef = useRef(0);
  const minFrequencyRef = useRef(minFrequency);
  const maxFrequencyRef = useRef(maxFrequency);
  const minHitIntervalRef = useRef(minHitInterval);
  const noiseLevelRef = useRef(0);
  const adaptiveThresholdRef = useRef(energyThreshold);
  const useAdaptiveThresholdRef = useRef(useAdaptiveThreshold);
  const useMultiFeatureRef = useRef(useMultiFeature);
  const noiseSamplesRef = useRef<number[]>([]);
  const peakHistoryRef = useRef<number[]>([]);
  const confidenceThresholdRef = useRef(confidenceThreshold);
  const peakWindowSizeRef = useRef(peakWindowSize);
  const energyWeightRef = useRef(energyWeight);
  const timeDomainWeightRef = useRef(timeDomainWeight);
  const stabilityWeightRef = useRef(stabilityWeight);
  const rangeWeightRef = useRef(rangeWeight);
  const recentHitsRef = useRef<{ time: number; energy: number; confidence: number }[]>([]);
  const envelopeHistoryRef = useRef<{ energy: number; timestamp: number }[]>([]);
  const zeroCrossingHistoryRef = useRef<number[]>([]);

  const setThreshold = useCallback((value: number) => {
    thresholdRef.current = value;
  }, []);

  const setFrequencyRange = useCallback((min: number, max: number) => {
    minFrequencyRef.current = min;
    maxFrequencyRef.current = max;
  }, []);

  const setMinHitInterval = useCallback((value: number) => {
    minHitIntervalRef.current = value;
  }, []);

  const setConfidenceThreshold = useCallback((value: number) => {
    confidenceThresholdRef.current = value;
  }, []);

  const setPeakWindowSize = useCallback((value: number) => {
    peakWindowSizeRef.current = value;
  }, []);

  const setWeights = useCallback((weights: { energy?: number; timeDomain?: number; stability?: number; range?: number }) => {
    if (weights.energy !== undefined) energyWeightRef.current = weights.energy;
    if (weights.timeDomain !== undefined) timeDomainWeightRef.current = weights.timeDomain;
    if (weights.stability !== undefined) stabilityWeightRef.current = weights.stability;
    if (weights.range !== undefined) rangeWeightRef.current = weights.range;
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
    hitIdCounterRef.current = 0;
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

  function calculateZeroCrossingRate(timeDomainData: Uint8Array): number {
    let crossings = 0;
    for (let i = 1; i < timeDomainData.length; i++) {
      const prev = timeDomainData[i - 1] - 128;
      const curr = timeDomainData[i] - 128;
      if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
        crossings++;
      }
    }
    return crossings / timeDomainData.length;
  }

  function calculateSpectralCentroid(frequencyData: Uint8Array): number {
    let weightedSum = 0;
    let sum = 0;
    const nyquist = 22050;
    for (let i = 0; i < frequencyData.length; i++) {
      const frequency = (i * nyquist) / frequencyData.length;
      const magnitude = frequencyData[i];
      weightedSum += frequency * magnitude;
      sum += magnitude;
    }
    return sum > 0 ? weightedSum / sum : 0;
  }

  function calculateRiseTime(envelopeHistory: { energy: number; timestamp: number }[]): number {
    if (envelopeHistory.length < 3) return 0;
    const recent = envelopeHistory.slice(-5);
    const minEnergy = Math.min(...recent.map(e => e.energy));
    const maxEnergy = Math.max(...recent.map(e => e.energy));
    if (maxEnergy <= minEnergy) return 0;
    const rise = maxEnergy - minEnergy;
    const risePercent = rise / maxEnergy;
    return risePercent;
  }

  function analyzeSoundType(
    zeroCrossingRate: number,
    spectralCentroid: number,
    riseTime: number,
    timeDomainEnergy: number
  ): { isShortBurst: boolean; score: number } {
    const zcrNorm = Math.min(zeroCrossingRate * 50, 1);
    const centroidNorm = Math.min(spectralCentroid / 500, 1);
    const riseNorm = Math.min(riseTime * 2, 1);
    const energyNorm = Math.min(timeDomainEnergy * 10, 1);
    
    const burstScore = (1 - zcrNorm) * 0.3 + riseNorm * 0.3 + (1 - centroidNorm) * 0.2 + energyNorm * 0.2;
    
    const isShortBurst = burstScore > 0.5 && zcrNorm < 0.5 && riseNorm > 0.3;
    
    return {
      isShortBurst,
      score: burstScore
    };
  }

  function formatAbsoluteTime(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  }

  function formatRelativeTime(timestamp: number): string {
    const start = startTimeRef.current || timestamp;
    const elapsed = timestamp - start;
    const totalSeconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((elapsed % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  function calculateConfidence(
    energy: number,
    timeDomainEnergy: number,
    stability: number,
    inRange: boolean,
    zeroCrossingRate?: number,
    spectralCentroid?: number,
    riseTime?: number,
    burstScore?: number
  ): number {
    if (!useMultiFeatureRef.current) {
      return inRange ? 1 : 0;
    }

    const energyScore = Math.min(energy / 200, 1);
    const timeDomainScore = Math.min(timeDomainEnergy * 10, 1);
    const stabilityScore = stability;
    const rangeScore = inRange ? 1 : 0;
    
    let burstBonus = 0;
    if (burstScore !== undefined) {
      burstBonus = burstScore * 0.15;
    }
    
    let lowZcrBonus = 0;
    if (zeroCrossingRate !== undefined) {
      const zcrNorm = Math.min(zeroCrossingRate * 50, 1);
      lowZcrBonus = (1 - zcrNorm) * 0.1;
    }
    
    let lowCentroidBonus = 0;
    if (spectralCentroid !== undefined) {
      const centroidNorm = Math.min(spectralCentroid / 500, 1);
      lowCentroidBonus = (1 - centroidNorm) * 0.1;
    }

    const baseConfidence = (
      energyScore * 0.3 +
      timeDomainScore * 0.2 +
      stabilityScore * 0.1 +
      rangeScore * 0.15
    );
    
    const bonusConfidence = burstBonus + lowZcrBonus + lowCentroidBonus;
    const confidence = Math.min(baseConfidence + bonusConfidence, 1);

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
    const zeroCrossingRate = calculateZeroCrossingRate(timeDomainData);
    const spectralCentroid = calculateSpectralCentroid(frequencyData);
    
    envelopeHistoryRef.current.push({ energy: rangeEnergy, timestamp: Date.now() });
    if (envelopeHistoryRef.current.length > 10) {
      envelopeHistoryRef.current.shift();
    }
    const riseTime = calculateRiseTime(envelopeHistoryRef.current);
    
    zeroCrossingHistoryRef.current.push(zeroCrossingRate);
    if (zeroCrossingHistoryRef.current.length > 5) {
      zeroCrossingHistoryRef.current.shift();
    }
    
    const { isShortBurst, score: burstScore } = analyzeSoundType(
      zeroCrossingRate,
      spectralCentroid,
      riseTime,
      timeDomainEnergy
    );
    
    const isInFrequencyRange = dominantFrequency >= minFrequencyRef.current && 
                                dominantFrequency <= maxFrequencyRef.current;
    
    const confidence = calculateConfidence(
      rangeEnergy,
      timeDomainEnergy,
      stability,
      isInFrequencyRange,
      zeroCrossingRate,
      spectralCentroid,
      riseTime,
      burstScore
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

    const adjustedConfidenceThreshold = confidenceThresholdRef.current * (isShortBurst ? 0.7 : 1.3);

    if (useMultiFeatureRef.current && confidence > adjustedConfidenceThreshold && isPeak && canDetectHit && isShortBurst) {
      recentHitsRef.current.push({ time: currentTime, energy: rangeEnergy, confidence });
      if (recentHitsRef.current.length > 20) {
        recentHitsRef.current.shift();
      }
      
      hitCountRef.current += 1;
      lastHitTimeRef.current = currentTime;
      lastHitFrequencyRef.current = dominantFrequency;
      
      hitIdCounterRef.current += 1;
      frequencyHistoryRef.current.push({
        id: hitIdCounterRef.current,
        timestamp: new Date(currentTime),
        absoluteTime: formatAbsoluteTime(currentTime),
        relativeTime: formatRelativeTime(currentTime),
        frequency: dominantFrequency,
        energy: Math.round(rangeEnergy * 10) / 10,
        timeDomainEnergy: Math.round(timeDomainEnergy * 1000) / 1000,
        stability: Math.round(stability * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        peakFrequency: peakFrequencyRef.current,
        riseTime: Math.round(riseTime * 100) / 100,
        spectralCentroid: Math.round(spectralCentroid),
        zeroCrossingRate: Math.round(zeroCrossingRate * 1000) / 1000,
        isShortBurst
      });
      if (frequencyHistoryRef.current.length > 50) {
        frequencyHistoryRef.current.shift();
      }
    } else if (!useMultiFeatureRef.current && isAboveThreshold && isPeak && canDetectHit) {
      if (isInFrequencyRange) {
        hitCountRef.current += 1;
        lastHitTimeRef.current = currentTime;
        lastHitFrequencyRef.current = dominantFrequency;
        
        hitIdCounterRef.current += 1;
        frequencyHistoryRef.current.push({
          id: hitIdCounterRef.current,
          timestamp: new Date(currentTime),
          absoluteTime: formatAbsoluteTime(currentTime),
          relativeTime: formatRelativeTime(currentTime),
          frequency: dominantFrequency,
          energy: Math.round(rangeEnergy * 10) / 10,
          timeDomainEnergy: Math.round(timeDomainEnergy * 1000) / 1000,
          stability: Math.round(stability * 100) / 100,
          confidence: Math.round(confidence * 100) / 100,
          peakFrequency: peakFrequencyRef.current,
          riseTime: Math.round(riseTime * 100) / 100,
          spectralCentroid: Math.round(spectralCentroid),
          zeroCrossingRate: Math.round(zeroCrossingRate * 1000) / 1000,
          isShortBurst
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
    setMinHitInterval,
    setConfidenceThreshold,
    setPeakWindowSize,
    setWeights,
    startCalibration: calibrate,
    getAudioData
  };
}
