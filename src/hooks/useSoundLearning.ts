import { useState, useRef, useCallback } from 'react';
import { AudioAnalyzerData } from './useAudioAnalyzer';

export interface SoundFeatures {
  timestamp: number;
  
  timeDomain: {
    rms: number;
    zeroCrossingRate: number;
    riseTime: number;
    crestFactor: number;
    waveformEntropy: number;
    skewness: number;
    kurtosis: number;
  };
  
  frequency: {
    centroid: number;
    rolloff: number;
    flatness: number;
    bandwidth: number;
    bandEnergy: { low: number; mid: number; high: number };
  };
  
  cepstral: {
    mfcc: number[];
    cepstralPeak: number;
  };
  
  derived: {
    dominantFrequency: number;
    snr: number;
    energy: number;
  };
}

export interface LearnedSoundProfile {
  version: number;
  createdAt: string;
  updatedAt: string;
  sampleCount: number;
  
  timeDomain: {
    rms: { min: number; max: number; avg: number; stdDev: number };
    zcr: { min: number; max: number; avg: number; stdDev: number };
    riseTime: { min: number; max: number; avg: number; stdDev: number };
    crestFactor: { min: number; max: number; avg: number; stdDev: number };
    waveformEntropy: { min: number; max: number; avg: number; stdDev: number };
    skewness: { min: number; max: number; avg: number; stdDev: number };
    kurtosis: { min: number; max: number; avg: number; stdDev: number };
  };
  
  frequency: {
    centroid: { min: number; max: number; avg: number; stdDev: number };
    rolloff: { min: number; max: number; avg: number; stdDev: number };
    flatness: { min: number; max: number; avg: number; stdDev: number };
    bandwidth: { min: number; max: number; avg: number; stdDev: number };
    bandEnergy: {
      low: { min: number; max: number; avg: number; stdDev: number };
      mid: { min: number; max: number; avg: number; stdDev: number };
      high: { min: number; max: number; avg: number; stdDev: number };
    };
  };
  
  cepstral: {
    mfcc: { min: number[]; max: number[]; avg: number[]; stdDev: number[] };
    cepstralPeak: { min: number; max: number; avg: number; stdDev: number };
  };
  
  derived: {
    dominantFrequency: { min: number; max: number; avg: number; stdDev: number };
    snr: { min: number; max: number; avg: number; stdDev: number };
    energy: { min: number; max: number; avg: number; stdDev: number };
  };
  
  noiseFloor: number;
}

export interface UseSoundLearningReturn {
  isRecording: boolean;
  recordingProgress: number;
  samples: SoundFeatures[];
  learnedProfile: LearnedSoundProfile | null;
  startLearning: (getAudioData: () => AudioAnalyzerData, count?: number) => void;
  stopLearning: () => void;
  saveProfile: () => boolean;
  loadProfile: () => LearnedSoundProfile | null;
  clearProfile: () => void;
  deleteSample: (index: number) => void;
  updateProfile: (profile: LearnedSoundProfile) => boolean;
  exportProfile: () => void;
  importProfile: () => void;
}

const STORAGE_KEY = 'basketball_sound_profile';

function extractFeatures(
  audioData: AudioAnalyzerData,
  minFreq: number,
  maxFreq: number,
  envelopeHistory: { energy: number; timestamp: number }[]
): SoundFeatures {
  const { frequencyData, timeDomainData } = audioData;
  const nyquist = 22050;
  const binSize = nyquist / frequencyData.length;
  
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
  const dominantFrequency = (dominantIndex * nyquist) / frequencyData.length;
  
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
  const nyquist = 22050;
  for (let i = 0; i < data.length; i++) {
    const freq = (i * nyquist) / data.length;
    weightedSum += freq * data[i];
    sum += data[i];
  }
  return sum > 0 ? weightedSum / sum : 0;
}

function calculateSpectralRolloff(data: Uint8Array, threshold: number = 0.85): number {
  const nyquist = 22050;
  let totalEnergy = 0;
  for (let i = 0; i < data.length; i++) {
    totalEnergy += data[i] * data[i];
  }
  
  const targetEnergy = totalEnergy * threshold;
  let cumulativeEnergy = 0;
  
  for (let i = 0; i < data.length; i++) {
    cumulativeEnergy += data[i] * data[i];
    if (cumulativeEnergy >= targetEnergy) {
      return (i * nyquist) / data.length;
    }
  }
  
  return nyquist / 2;
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
  const nyquist = 22050;
  const centroid = calculateSpectralCentroid(data);
  
  let weightedSum = 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const freq = (i * nyquist) / data.length;
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
  const nyquist = 22050;
  const melMin = 0;
  const melMax = 2595 * Math.log10(1 + nyquist / 2 / 700);
  
  const melPoints: number[] = [];
  for (let i = 0; i <= numFilters + 1; i++) {
    melPoints.push(melMin + (melMax - melMin) * i / numFilters);
  }
  
  const hzPoints = melPoints.map(m => 700 * (Math.pow(10, m / 2595) - 1));
  const binPoints = hzPoints.map(h => Math.floor((h * 2 * numBins) / nyquist));
  
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

function calculateStats(values: number[]): { min: number; max: number; avg: number; stdDev: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  return { min, max, avg, stdDev: Math.sqrt(variance) };
}

function calculateProfileFromSamples(samples: SoundFeatures[], noiseFloor: number): LearnedSoundProfile {
  if (samples.length === 0) {
    throw new Error('No samples to analyze');
  }
  
  const timeDomain = {
    rms: calculateStats(samples.map(s => s.timeDomain.rms)),
    zcr: calculateStats(samples.map(s => s.timeDomain.zeroCrossingRate)),
    riseTime: calculateStats(samples.map(s => s.timeDomain.riseTime)),
    crestFactor: calculateStats(samples.map(s => s.timeDomain.crestFactor)),
    waveformEntropy: calculateStats(samples.map(s => s.timeDomain.waveformEntropy)),
    skewness: calculateStats(samples.map(s => s.timeDomain.skewness)),
    kurtosis: calculateStats(samples.map(s => s.timeDomain.kurtosis))
  };
  
  const frequency = {
    centroid: calculateStats(samples.map(s => s.frequency.centroid)),
    rolloff: calculateStats(samples.map(s => s.frequency.rolloff)),
    flatness: calculateStats(samples.map(s => s.frequency.flatness)),
    bandwidth: calculateStats(samples.map(s => s.frequency.bandwidth)),
    bandEnergy: {
      low: calculateStats(samples.map(s => s.frequency.bandEnergy.low)),
      mid: calculateStats(samples.map(s => s.frequency.bandEnergy.mid)),
      high: calculateStats(samples.map(s => s.frequency.bandEnergy.high))
    }
  };
  
  const numMfcc = samples[0].cepstral.mfcc.length;
  const mfccStats: { min: number[]; max: number[]; avg: number[]; stdDev: number[] } = {
    min: [], max: [], avg: [], stdDev: []
  };
  
  for (let i = 0; i < numMfcc; i++) {
    const values = samples.map(s => s.cepstral.mfcc[i]);
    mfccStats.min.push(Math.min(...values));
    mfccStats.max.push(Math.max(...values));
    mfccStats.avg.push(values.reduce((a, b) => a + b, 0) / values.length);
    const avg = mfccStats.avg[i];
    mfccStats.stdDev.push(Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length));
  }
  
  const cepstral = {
    mfcc: mfccStats,
    cepstralPeak: calculateStats(samples.map(s => s.cepstral.cepstralPeak))
  };
  
  const derived = {
    dominantFrequency: calculateStats(samples.map(s => s.derived.dominantFrequency)),
    snr: calculateStats(samples.map(s => s.derived.snr)),
    energy: calculateStats(samples.map(s => s.derived.energy))
  };
  
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sampleCount: samples.length,
    timeDomain,
    frequency,
    cepstral,
    derived,
    noiseFloor
  };
}

export function useSoundLearning(): UseSoundLearningReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [samples, setSamples] = useState<SoundFeatures[]>([]);
  const [learnedProfile, setLearnedProfile] = useState<LearnedSoundProfile | null>(null);
  
  const recordingRef = useRef<{
    isActive: boolean;
    count: number;
    targetCount: number;
    animationFrameId: number | null;
    getAudioData: (() => AudioAnalyzerData) | null;
    minFreq: number;
    maxFreq: number;
    envelopeHistory: { energy: number; timestamp: number }[];
    lastEnergy: number;
    isRising: boolean;
    peakEnergy: number;
    samples: SoundFeatures[];
    noiseSamples: number[];
  }>({
    isActive: false,
    count: 0,
    targetCount: 3,
    animationFrameId: null,
    getAudioData: null,
    minFreq: 50,
    maxFreq: 300,
    envelopeHistory: [],
    lastEnergy: 0,
    isRising: false,
    peakEnergy: 0,
    samples: [],
    noiseSamples: []
  });

  const detectSoundEvent = useCallback((energy: number, isNoise: boolean = false) => {
    const state = recordingRef.current;
    
    if (isNoise) {
      state.noiseSamples.push(energy);
      if (state.noiseSamples.length > 50) {
        state.noiseSamples.shift();
      }
      return;
    }
    
    state.envelopeHistory.push({ energy, timestamp: Date.now() });
    if (state.envelopeHistory.length > 20) {
      state.envelopeHistory.shift();
    }
    
    const threshold = 50;
    const minInterval = 300;
    
    if (energy > threshold) {
      if (!state.isRising && energy > state.lastEnergy + 5) {
        state.isRising = true;
        state.peakEnergy = 0;
      }
      
      if (state.isRising) {
        if (energy > state.peakEnergy) {
          state.peakEnergy = energy;
        }
        
        if (energy < state.peakEnergy * 0.7 && state.peakEnergy > threshold) {
          const now = Date.now();
          const lastSample = state.samples[state.samples.length - 1];
          if (!lastSample || (now - lastSample.timestamp) > minInterval) {
            if (state.getAudioData) {
              const features = extractFeatures(
                state.getAudioData(),
                state.minFreq,
                state.maxFreq,
                state.envelopeHistory
              );
              
              const noiseAvg = state.noiseSamples.length > 0 
                ? state.noiseSamples.reduce((a, b) => a + b, 0) / state.noiseSamples.length 
                : 10;
              features.derived.snr = noiseAvg > 0 ? energy / noiseAvg : 0;
              
              state.samples.push(features);
              state.count = state.samples.length;
              setSamples([...state.samples]);
              setRecordingProgress(state.count / state.targetCount);
              
              if (state.count >= state.targetCount) {
                stopLearning();
              }
            }
          }
        }
      }
    }
    
    if (energy < threshold * 0.5) {
      state.isRising = false;
    }
    
    state.lastEnergy = energy;
  }, []);

  const recordingLoop = useCallback(() => {
    const state = recordingRef.current;
    if (!state.isActive || !state.getAudioData) return;
    
    const audioData = state.getAudioData();
    const { frequencyData } = audioData;
    const nyquist = 22050;
    const binSize = nyquist / frequencyData.length;
    const minIndex = Math.floor(state.minFreq / binSize);
    const maxIndex = Math.min(Math.ceil(state.maxFreq / binSize), frequencyData.length - 1);
    
    let sum = 0;
    for (let i = minIndex; i <= maxIndex; i++) {
      sum += frequencyData[i] * frequencyData[i];
    }
    const energy = Math.sqrt(sum / (maxIndex - minIndex + 1));
    
    detectSoundEvent(energy, false);
    
    if (state.isActive) {
      state.animationFrameId = requestAnimationFrame(recordingLoop);
    }
  }, [detectSoundEvent]);

  const startLearning = useCallback((getAudioData: () => AudioAnalyzerData, count: number = 5) => {
    recordingRef.current = {
      isActive: true,
      count: 0,
      targetCount: count,
      animationFrameId: null,
      getAudioData,
      minFreq: 50,
      maxFreq: 300,
      envelopeHistory: [],
      lastEnergy: 0,
      isRising: false,
      peakEnergy: 0,
      samples: [],
      noiseSamples: []
    };
    
    setIsRecording(true);
    setRecordingProgress(0);
    setSamples([]);
    
    setTimeout(() => {
      if (recordingRef.current.isActive) {
        recordingRef.current.animationFrameId = requestAnimationFrame(recordingLoop);
      }
    }, 500);
  }, [recordingLoop]);

  const stopLearning = useCallback(() => {
    const state = recordingRef.current;
    state.isActive = false;
    
    if (state.animationFrameId) {
      cancelAnimationFrame(state.animationFrameId);
      state.animationFrameId = null;
    }
    
    setIsRecording(false);
    
    if (state.samples.length > 0) {
      try {
        const noiseAvg = state.noiseSamples.length > 0 
          ? state.noiseSamples.reduce((a, b) => a + b, 0) / state.noiseSamples.length 
          : 10;
        const profile = calculateProfileFromSamples(state.samples, noiseAvg);
        setLearnedProfile(profile);
      } catch (e) {
        console.error('Failed to calculate profile:', e);
      }
    }
  }, []);

  const saveProfile = useCallback(() => {
    if (!learnedProfile) return false;
    
    try {
      const profileToSave = {
        ...learnedProfile,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profileToSave));
      return true;
    } catch (e) {
      console.error('Failed to save profile:', e);
      return false;
    }
  }, [learnedProfile]);

  const loadProfile = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const profile = JSON.parse(stored) as LearnedSoundProfile;
        setLearnedProfile(profile);
        setSamples([]);
        return profile;
      }
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
    return null;
  }, []);

  const clearProfile = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setLearnedProfile(null);
      setSamples([]);
    } catch (e) {
      console.error('Failed to clear profile:', e);
    }
  }, []);

  const deleteSample = useCallback((index: number) => {
    const newSamples = samples.filter((_, i) => i !== index);
    setSamples(newSamples);
    
    if (newSamples.length > 0 && learnedProfile) {
      try {
        const profile = calculateProfileFromSamples(newSamples, learnedProfile.noiseFloor);
        setLearnedProfile(profile);
      } catch (e) {
        console.error('Failed to recalculate profile:', e);
      }
    } else {
      setLearnedProfile(null);
    }
  }, [samples, learnedProfile]);

  const updateProfile = useCallback((profile: LearnedSoundProfile) => {
    try {
      const updatedProfile = {
        ...profile,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProfile));
      setLearnedProfile(updatedProfile);
      return true;
    } catch (e) {
      console.error('Failed to update profile:', e);
      return false;
    }
  }, []);

  const exportProfile = useCallback(() => {
    if (!learnedProfile) return;
    
    try {
      const dataStr = JSON.stringify(learnedProfile, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `basketball_profile_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export profile:', e);
      alert('导出失败');
    }
  }, [learnedProfile]);

  const importProfile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const profile = JSON.parse(event.target?.result as string) as LearnedSoundProfile;
          
          if (!profile.version || !profile.sampleCount || !profile.timeDomain) {
            throw new Error('Invalid profile format');
          }
          
          localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
          setLearnedProfile(profile);
          setSamples([]);
          alert('导入成功！');
        } catch (err) {
          console.error('Failed to import profile:', err);
          alert('导入失败：文件格式不正确');
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  }, []);

  return {
    isRecording,
    recordingProgress,
    samples,
    learnedProfile,
    startLearning,
    stopLearning,
    saveProfile,
    loadProfile,
    clearProfile,
    deleteSample,
    updateProfile,
    exportProfile,
    importProfile
  };
}
