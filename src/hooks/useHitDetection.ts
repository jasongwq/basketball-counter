import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioAnalyzerData } from './useAudioAnalyzer';
import { LearnedSoundProfile, SoundFeatures } from './useSoundLearning';

export interface HitRecord {
  id: number;
  timestamp: Date;
  absoluteTime: string;
  relativeTime: string;
  confidence: number;
  features: Partial<SoundFeatures>;
}

export interface HitDetectionResult {
  hitCount: number;
  hitsPerMinute: number;
  duration: number;
  lastHitTime: number | null;
  averageConfidence: number;
  frequencyHistory: HitRecord[];
  learnedProfile: LearnedSoundProfile | null;
}

export interface UseHitDetectionOptions {
  learnedProfile?: LearnedSoundProfile | null;
  minHitInterval?: number;
  confidenceThreshold?: number;
}

export interface UseHitDetectionReturn {
  result: HitDetectionResult;
  isDetecting: boolean;
  isCalibrating: boolean;
  currentConfidence: number;
  calibrationProgress: number;
  startDetection: () => void;
  stopDetection: () => void;
  resetStats: () => void;
  startCalibration: () => Promise<void>;
  getAudioData: () => AudioAnalyzerData;
}

const NYQUIST = 22050;

function calculateSimilarity(
  features: SoundFeatures,
  profile: LearnedSoundProfile,
  noiseFloor: number
): number {
  const scores: number[] = [];
  
  const td = features.timeDomain;
  const tdProfile = profile.timeDomain;
  
  scores.push(gaussianScore(td.rms, tdProfile.rms.avg, Math.max(tdProfile.rms.stdDev, 0.01)));
  scores.push(gaussianScore(td.zeroCrossingRate, tdProfile.zcr.avg, Math.max(tdProfile.zcr.stdDev, 0.001)));
  scores.push(gaussianScore(td.riseTime, tdProfile.riseTime.avg, Math.max(tdProfile.riseTime.stdDev, 0.05)));
  scores.push(gaussianScore(td.crestFactor, tdProfile.crestFactor.avg, Math.max(tdProfile.crestFactor.stdDev, 0.1)));
  scores.push(gaussianScore(td.waveformEntropy, tdProfile.waveformEntropy.avg, Math.max(tdProfile.waveformEntropy.stdDev, 0.05)));
  scores.push(gaussianScore(td.skewness, tdProfile.skewness.avg, Math.max(tdProfile.skewness.stdDev, 0.1)));
  scores.push(gaussianScore(td.kurtosis, tdProfile.kurtosis.avg, Math.max(tdProfile.kurtosis.stdDev, 0.1)));
  
  const fd = features.frequency;
  const fdProfile = profile.frequency;
  
  scores.push(gaussianScore(fd.centroid, fdProfile.centroid.avg, Math.max(fdProfile.centroid.stdDev, 50)));
  scores.push(gaussianScore(fd.rolloff, fdProfile.rolloff.avg, Math.max(fdProfile.rolloff.stdDev, 100)));
  scores.push(gaussianScore(fd.flatness, fdProfile.flatness.avg, Math.max(fdProfile.flatness.stdDev, 0.01)));
  scores.push(gaussianScore(fd.bandwidth, fdProfile.bandwidth.avg, Math.max(fdProfile.bandwidth.stdDev, 50)));
  scores.push(gaussianScore(fd.bandEnergy.low, fdProfile.bandEnergy.low.avg, Math.max(fdProfile.bandEnergy.low.stdDev, 1)));
  scores.push(gaussianScore(fd.bandEnergy.mid, fdProfile.bandEnergy.mid.avg, Math.max(fdProfile.bandEnergy.mid.stdDev, 1)));
  scores.push(gaussianScore(fd.bandEnergy.high, fdProfile.bandEnergy.high.avg, Math.max(fdProfile.bandEnergy.high.stdDev, 1)));
  
  const mfccScore = calculateMfccSimilarity(features.cepstral.mfcc, profile.cepstral.mfcc);
  scores.push(mfccScore);
  scores.push(gaussianScore(features.cepstral.cepstralPeak, profile.cepstral.cepstralPeak.avg, Math.max(profile.cepstral.cepstralPeak.stdDev, 0.1)));
  
  scores.push(gaussianScore(features.derived.dominantFrequency, profile.derived.dominantFrequency.avg, Math.max(profile.derived.dominantFrequency.stdDev, 20)));
  scores.push(gaussianScore(features.derived.energy, profile.derived.energy.avg, Math.max(profile.derived.energy.stdDev, 5)));
  
  const validScores = scores.filter(s => !isNaN(s) && isFinite(s));
  if (validScores.length === 0) return 0;
  
  return validScores.reduce((a, b) => a + b, 0) / validScores.length;
}

function gaussianScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return value === mean ? 1 : 0;
  const diff = Math.abs(value - mean);
  const score = Math.exp(-(diff * diff) / (2 * stdDev * stdDev));
  return Math.min(Math.max(score, 0), 1);
}

function calculateMfccSimilarity(mfcc1: number[], mfcc2: { avg: number[]; stdDev: number[] }): number {
  if (mfcc1.length !== mfcc2.avg.length) return 0;
  
  let totalScore = 0;
  for (let i = 0; i < mfcc1.length; i++) {
    totalScore += gaussianScore(mfcc1[i], mfcc2.avg[i], Math.max(mfcc2.stdDev[i], 0.1));
  }
  
  return totalScore / mfcc1.length;
}

function extractFeatures(
  audioData: AudioAnalyzerData,
  envelopeHistory: { energy: number; timestamp: number }[]
): SoundFeatures {
  const { frequencyData, timeDomainData } = audioData;
  const binSize = NYQUIST / frequencyData.length;
  
  const rms = calculateRMS(timeDomainData);
  const zcr = calculateZCR(timeDomainData);
  const { skewness, kurtosis } = calculateHOS(timeDomainData);
  const crestFactor = calculateCrestFactor(timeDomainData);
  const waveformEntropy = calculateWaveformEntropy(timeDomainData);
  
  const centroid = calculateSpectralCentroid(frequencyData);
  const rolloff = calculateSpectralRolloff(frequencyData);
  const flatness = calculateSpectralFlatness(frequencyData);
  const bandwidth = calculateSpectralBandwidth(frequencyData);
  const bandEnergy = calculateBandEnergy(frequencyData, binSize);
  
  const mfcc = calculateMFCC(frequencyData);
  const cepstralPeak = calculateCepstralPeak(frequencyData);
  
  const minIndex = Math.floor(50 / binSize);
  const maxIndex = Math.min(Math.ceil(300 / binSize), frequencyData.length - 1);
  
  let maxValue = 0;
  let dominantIndex = 0;
  for (let i = minIndex; i <= maxIndex; i++) {
    if (frequencyData[i] > maxValue) {
      maxValue = frequencyData[i];
      dominantIndex = i;
    }
  }
  const dominantFrequency = (dominantIndex * NYQUIST) / frequencyData.length;
  
  let energySum = 0;
  for (let i = minIndex; i <= maxIndex; i++) {
    energySum += frequencyData[i] * frequencyData[i];
  }
  const energy = Math.sqrt(energySum / (maxIndex - minIndex + 1));
  
  let riseTime = 0;
  if (envelopeHistory.length >= 3) {
    const recent = envelopeHistory.slice(-5);
    const minE = Math.min(...recent.map(e => e.energy));
    const maxE = Math.max(...recent.map(e => e.energy));
    if (maxE > minE) {
      riseTime = (maxE - minE) / maxE;
    }
  }
  
  return {
    timestamp: Date.now(),
    timeDomain: { rms, zeroCrossingRate: zcr, riseTime, crestFactor, waveformEntropy, skewness, kurtosis },
    frequency: { centroid, rolloff, flatness, bandwidth, bandEnergy },
    cepstral: { mfcc, cepstralPeak },
    derived: { dominantFrequency, snr: 0, energy }
  };
}

function calculateRMS(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const val = (data[i] - 128) / 128;
    sum += val * val;
  }
  return Math.sqrt(sum / data.length);
}

function calculateZCR(data: Uint8Array): number {
  let crossings = 0;
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1] - 128;
    const curr = data[i] - 128;
    if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
      crossings++;
    }
  }
  return crossings / data.length;
}

function calculateHOS(data: Uint8Array): { skewness: number; kurtosis: number } {
  const values: number[] = [];
  for (let i = 0; i < data.length; i++) {
    values.push((data[i] - 128) / 128);
  }
  
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return { skewness: 0, kurtosis: 0 };
  
  const skewness = values.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 3), 0) / n;
  const kurtosis = values.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 4), 0) / n - 3;
  
  return { skewness, kurtosis };
}

function calculateCrestFactor(data: Uint8Array): number {
  let peak = 0;
  let sumSquares = 0;
  for (let i = 0; i < data.length; i++) {
    const val = Math.abs((data[i] - 128) / 128);
    if (val > peak) peak = val;
    sumSquares += val * val;
  }
  const rms = Math.sqrt(sumSquares / data.length);
  return rms > 0 ? peak / rms : 0;
}

function calculateWaveformEntropy(data: Uint8Array): number {
  const bins = 20;
  const histogram = new Array(bins).fill(0);
  const range = 256 / bins;
  
  for (let i = 0; i < data.length; i++) {
    const bin = Math.min(Math.floor((data[i]) / range), bins - 1);
    histogram[bin]++;
  }
  
  const total = data.length;
  let entropy = 0;
  for (let i = 0; i < bins; i++) {
    if (histogram[i] > 0) {
      const p = histogram[i] / total;
      entropy -= p * Math.log2(p);
    }
  }
  
  return entropy / Math.log2(bins);
}

function calculateSpectralCentroid(data: Uint8Array): number {
  let weightedSum = 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const freq = (i * NYQUIST) / data.length;
    weightedSum += freq * data[i];
    sum += data[i];
  }
  return sum > 0 ? weightedSum / sum : 0;
}

function calculateSpectralRolloff(data: Uint8Array, threshold: number = 0.85): number {
  let totalEnergy = 0;
  for (let i = 0; i < data.length; i++) {
    totalEnergy += data[i] * data[i];
  }
  
  const targetEnergy = totalEnergy * threshold;
  let cumulativeEnergy = 0;
  
  for (let i = 0; i < data.length; i++) {
    cumulativeEnergy += data[i] * data[i];
    if (cumulativeEnergy >= targetEnergy) {
      return (i * NYQUIST) / data.length;
    }
  }
  
  return NYQUIST / 2;
}

function calculateSpectralFlatness(data: Uint8Array): number {
  let sumLog = 0;
  let sum = 0;
  
  for (let i = 0; i < data.length; i++) {
    if (data[i] > 0) {
      sumLog += Math.log(data[i]);
      sum += data[i];
    }
  }
  
  if (sum === 0) return 0;
  
  const geometricMean = Math.exp(sumLog / data.length);
  const arithmeticMean = sum / data.length;
  
  return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
}

function calculateSpectralBandwidth(data: Uint8Array): number {
  const centroid = calculateSpectralCentroid(data);
  
  let weightedSum = 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const freq = (i * NYQUIST) / data.length;
    const diff = freq - centroid;
    weightedSum += diff * diff * data[i];
    sum += data[i];
  }
  
  return sum > 0 ? Math.sqrt(weightedSum / sum) : 0;
}

function calculateBandEnergy(data: Uint8Array, binSize: number): { low: number; mid: number; high: number } {
  let low = 0, mid = 0, high = 0;
  let lowCount = 0, midCount = 0, highCount = 0;
  
  for (let i = 0; i < data.length; i++) {
    const freq = i * binSize;
    if (freq < 250) {
      low += data[i] * data[i];
      lowCount++;
    } else if (freq < 2000) {
      mid += data[i] * data[i];
      midCount++;
    } else {
      high += data[i] * data[i];
      highCount++;
    }
  }
  
  return {
    low: lowCount > 0 ? Math.sqrt(low / lowCount) : 0,
    mid: midCount > 0 ? Math.sqrt(mid / midCount) : 0,
    high: highCount > 0 ? Math.sqrt(high / highCount) : 0
  };
}

function calculateMFCC(data: Uint8Array): number[] {
  const numCoeffs = 13;
  const melFilters = createMelFilterbank(numCoeffs, data.length);
  const melEnergies: number[] = [];
  
  for (let m = 0; m < melFilters.length; m++) {
    let sum = 0;
    for (let k = 0; k < data.length; k++) {
      sum += data[k] * data[k] * melFilters[m][k];
    }
    melEnergies.push(Math.log(sum + 1e-10));
  }
  
  const mfcc: number[] = [];
  for (let n = 0; n < numCoeffs; n++) {
    let sum = 0;
    for (let m = 0; m < melFilters.length; m++) {
      sum += melEnergies[m] * Math.cos(Math.PI * n * (m + 0.5) / melFilters.length);
    }
    mfcc.push(sum);
  }
  
  return mfcc;
}

function createMelFilterbank(numFilters: number, numBins: number): number[][] {
  const melMin = 0;
  const melMax = 2595 * Math.log10(1 + NYQUIST / 2 / 700);
  
  const melPoints: number[] = [];
  for (let i = 0; i <= numFilters + 1; i++) {
    melPoints.push(melMin + (melMax - melMin) * i / numFilters);
  }
  
  const hzPoints = melPoints.map(m => 700 * (Math.pow(10, m / 2595) - 1));
  const binPoints = hzPoints.map(h => Math.floor((h * 2 * numBins) / NYQUIST));
  
  const filters: number[][] = [];
  for (let m = 1; m <= numFilters; m++) {
    const filter: number[] = [];
    for (let k = 0; k < numBins; k++) {
      let value = 0;
      if (k >= binPoints[m - 1] && k < binPoints[m]) {
        value = (k - binPoints[m - 1]) / (binPoints[m] - binPoints[m - 1]);
      } else if (k >= binPoints[m] && k < binPoints[m + 1]) {
        value = (binPoints[m + 1] - k) / (binPoints[m + 1] - binPoints[m]);
      }
      filter.push(value);
    }
    filters.push(filter);
  }
  
  return filters;
}

function calculateCepstralPeak(data: Uint8Array): number {
  const logSpectrum: number[] = [];
  for (let i = 1; i < data.length; i++) {
    logSpectrum.push(Math.log(data[i] + 1));
  }
  
  let maxPeak = 0;
  for (let i = 1; i < logSpectrum.length - 1; i++) {
    if (logSpectrum[i] > logSpectrum[i - 1] && logSpectrum[i] > logSpectrum[i + 1]) {
      if (logSpectrum[i] > maxPeak) {
        maxPeak = logSpectrum[i];
      }
    }
  }
  
  return maxPeak;
}

export function useHitDetection(
  getAudioData: () => AudioAnalyzerData,
  isListening: boolean,
  options: UseHitDetectionOptions = {}
): UseHitDetectionReturn {
  const {
    learnedProfile = null,
    minHitInterval = 250,
    confidenceThreshold = 0.6
  } = options;

  const [result, setResult] = useState<HitDetectionResult>({
    hitCount: 0,
    hitsPerMinute: 0,
    duration: 0,
    lastHitTime: null,
    averageConfidence: 0,
    frequencyHistory: [],
    learnedProfile: null
  });

  const [currentConfidence, setCurrentConfidence] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  const animationFrameRef = useRef<number | null>(null);
  const calibrationFrameRef = useRef<number | null>(null);
  const lastHitTimeRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hitCountRef = useRef(0);
  const hitIdCounterRef = useRef(0);
  const confidenceHistoryRef = useRef<number[]>([]);
  const frequencyHistoryRef = useRef<HitRecord[]>([]);
  const envelopeHistoryRef = useRef<{ energy: number; timestamp: number }[]>([]);
  const lastEnergyRef = useRef(0);
  const isRisingRef = useRef(false);
  const peakEnergyRef = useRef(0);
  const learnedProfileRef = useRef<LearnedSoundProfile | null>(learnedProfile);
  const confidenceThresholdRef = useRef(confidenceThreshold);
  const minHitIntervalRef = useRef(minHitInterval);
  const noiseSamplesRef = useRef<number[]>([]);

  const resetStats = useCallback(() => {
    setResult({
      hitCount: 0,
      hitsPerMinute: 0,
      duration: 0,
      lastHitTime: null,
      averageConfidence: 0,
      frequencyHistory: [],
      learnedProfile: learnedProfileRef.current
    });
    hitCountRef.current = 0;
    lastHitTimeRef.current = null;
    startTimeRef.current = null;
    confidenceHistoryRef.current = [];
    frequencyHistoryRef.current = [];
    hitIdCounterRef.current = 0;
    envelopeHistoryRef.current = [];
  }, []);

  const calibrate = useCallback(async () => {
    if (!isListening) return;

    setIsCalibrating(true);
    setCalibrationProgress(0);
    noiseSamplesRef.current = [];
    
    const startTime = Date.now();
    const calibrationDuration = 1500;
    
    const collectSample = () => {
      const audioData = getAudioData();
      const { frequencyData } = audioData;
      const binSize = NYQUIST / frequencyData.length;
      const minIndex = Math.floor(50 / binSize);
      const maxIndex = Math.min(Math.ceil(300 / binSize), frequencyData.length - 1);
      
      let sum = 0;
      for (let i = minIndex; i <= maxIndex; i++) {
        sum += frequencyData[i] * frequencyData[i];
      }
      const energy = Math.sqrt(sum / (maxIndex - minIndex + 1));
      noiseSamplesRef.current.push(energy);
      
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / calibrationDuration, 1);
      setCalibrationProgress(progress);
      
      if (elapsed < calibrationDuration) {
        calibrationFrameRef.current = requestAnimationFrame(collectSample);
      } else {
        setIsCalibrating(false);
        setCalibrationProgress(1);
      }
    };
    
    calibrationFrameRef.current = requestAnimationFrame(collectSample);
  }, [isListening, getAudioData]);

  const detectHits = useCallback(() => {
    if (!isListening) return;

    const audioData = getAudioData();
    const { frequencyData } = audioData;
    const binSize = NYQUIST / frequencyData.length;
    const minIndex = Math.floor(50 / binSize);
    const maxIndex = Math.min(Math.ceil(300 / binSize), frequencyData.length - 1);
    
    let sum = 0;
    for (let i = minIndex; i <= maxIndex; i++) {
      sum += frequencyData[i] * frequencyData[i];
    }
    const energy = Math.sqrt(sum / (maxIndex - minIndex + 1));
    
    envelopeHistoryRef.current.push({ energy, timestamp: Date.now() });
    if (envelopeHistoryRef.current.length > 20) {
      envelopeHistoryRef.current.shift();
    }
    
    const currentTime = Date.now();
    const noiseAvg = noiseSamplesRef.current.length > 0
      ? noiseSamplesRef.current.reduce((a, b) => a + b, 0) / noiseSamplesRef.current.length
      : 10;
    const snr = noiseAvg > 0 ? energy / noiseAvg : 0;
    
    const threshold = noiseAvg * 2 + 20;
    const minInterval = minHitIntervalRef.current;
    
    let confidence = 0;
    
    if (energy > threshold && learnedProfileRef.current) {
      if (!isRisingRef.current && energy > lastEnergyRef.current + 5) {
        isRisingRef.current = true;
        peakEnergyRef.current = 0;
      }
      
      if (isRisingRef.current) {
        if (energy > peakEnergyRef.current) {
          peakEnergyRef.current = energy;
        }
        
        if (energy < peakEnergyRef.current * 0.7 && peakEnergyRef.current > threshold) {
          const canDetect = lastHitTimeRef.current === null || 
                           (currentTime - lastHitTimeRef.current) > minInterval;
          
          if (canDetect) {
            const features = extractFeatures(audioData, envelopeHistoryRef.current);
            features.derived.snr = snr;
            
            confidence = calculateSimilarity(features, learnedProfileRef.current, noiseAvg);
            setCurrentConfidence(confidence);
            
            if (confidence > confidenceThresholdRef.current) {
              hitCountRef.current += 1;
              lastHitTimeRef.current = currentTime;
              
              hitIdCounterRef.current += 1;
              frequencyHistoryRef.current.push({
                id: hitIdCounterRef.current,
                timestamp: new Date(currentTime),
                absoluteTime: formatAbsoluteTime(currentTime),
                relativeTime: formatRelativeTime(currentTime, startTimeRef.current),
                confidence: Math.round(confidence * 100) / 100,
                features
              });
              
              if (frequencyHistoryRef.current.length > 50) {
                frequencyHistoryRef.current.shift();
              }
              
              confidenceHistoryRef.current.push(confidence);
              if (confidenceHistoryRef.current.length > 50) {
                confidenceHistoryRef.current.shift();
              }
            }
          }
        }
      }
    }
    
    if (energy < threshold * 0.5) {
      isRisingRef.current = false;
    }
    lastEnergyRef.current = energy;
    
    if (startTimeRef.current === null) {
      startTimeRef.current = currentTime;
    }
    
    const duration = currentTime - startTimeRef.current;
    const minutes = duration / 60000;
    const hitsPerMinute = minutes > 0 ? hitCountRef.current / minutes : 0;
    const avgConfidence = confidenceHistoryRef.current.length > 0
      ? confidenceHistoryRef.current.reduce((a, b) => a + b, 0) / confidenceHistoryRef.current.length
      : 0;

    setResult({
      hitCount: hitCountRef.current,
      hitsPerMinute: Math.round(hitsPerMinute * 10) / 10,
      duration,
      lastHitTime: lastHitTimeRef.current,
      averageConfidence: Math.round(avgConfidence * 100) / 100,
      frequencyHistory: [...frequencyHistoryRef.current],
      learnedProfile: learnedProfileRef.current
    });

    animationFrameRef.current = requestAnimationFrame(detectHits);
  }, [getAudioData, isListening]);

  const startDetection = useCallback(async () => {
    if (!isListening) return;
    
    learnedProfileRef.current = learnedProfile;
    minHitIntervalRef.current = minHitInterval;
    confidenceThresholdRef.current = confidenceThreshold;
    
    resetStats();
    setIsDetecting(true);
    startTimeRef.current = Date.now();
    
    await calibrate();
    
    animationFrameRef.current = requestAnimationFrame(detectHits);
  }, [isListening, resetStats, detectHits, calibrate, learnedProfile, minHitInterval, confidenceThreshold]);

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
    currentConfidence,
    calibrationProgress,
    startDetection,
    stopDetection,
    resetStats,
    startCalibration: calibrate,
    getAudioData
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

function formatRelativeTime(timestamp: number, startTime: number | null): string {
  const start = startTime || timestamp;
  const elapsed = timestamp - start;
  const totalSeconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor((elapsed % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}
