import { useState, useRef, useCallback } from 'react';
import { AudioAnalyzerData } from './useAudioAnalyzer';

export interface LearnedSoundProfile {
  version: number;
  createdAt: string;
  updatedAt: string;
  sampleCount: number;
  frequencyRange: { min: number; max: number; avg: number };
  energyRange: { min: number; max: number; avg: number; stdDev: number };
  spectralCentroidRange: { min: number; max: number; avg: number };
  zeroCrossingRateRange: { min: number; max: number; avg: number };
  riseTimeRange: { min: number; max: number; avg: number };
  timeDomainEnergyRange: { min: number; max: number; avg: number };
  confidenceWeight: {
    energy: number;
    frequency: number;
    spectralCentroid: number;
    zeroCrossingRate: number;
    riseTime: number;
    timeDomain: number;
  };
}

export interface SoundSample {
  timestamp: number;
  dominantFrequency: number;
  energy: number;
  spectralCentroid: number;
  zeroCrossingRate: number;
  riseTime: number;
  timeDomainEnergy: number;
}

export interface UseSoundLearningReturn {
  isRecording: boolean;
  recordingProgress: number;
  samples: SoundSample[];
  learnedProfile: LearnedSoundProfile | null;
  startLearning: (getAudioData: () => AudioAnalyzerData, count?: number) => void;
  stopLearning: () => void;
  saveProfile: () => boolean;
  loadProfile: () => LearnedSoundProfile | null;
  clearProfile: () => void;
  deleteSample: (index: number) => void;
  updateProfile: (profile: LearnedSoundProfile) => boolean;
}

const STORAGE_KEY = 'basketball_sound_profile';

function calculateFeatures(
  audioData: AudioAnalyzerData,
  minFreq: number,
  maxFreq: number,
  envelopeHistory: { energy: number; timestamp: number }[]
): Omit<SoundSample, 'timestamp'> {
  const { frequencyData, timeDomainData } = audioData;
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
  const dominantFrequency = (dominantIndex * nyquist) / frequencyData.length;
  
  let energySum = 0;
  let count = 0;
  for (let i = minIndex; i <= maxIndex; i++) {
    energySum += frequencyData[i] * frequencyData[i];
    count++;
  }
  const energy = count > 0 ? Math.sqrt(energySum / count) : 0;
  
  let weightedSum = 0;
  let magnitudeSum = 0;
  for (let i = 0; i < frequencyData.length; i++) {
    const freq = (i * nyquist) / frequencyData.length;
    weightedSum += freq * frequencyData[i];
    magnitudeSum += frequencyData[i];
  }
  const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  
  let crossings = 0;
  for (let i = 1; i < timeDomainData.length; i++) {
    const prev = timeDomainData[i - 1] - 128;
    const curr = timeDomainData[i] - 128;
    if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
      crossings++;
    }
  }
  const zeroCrossingRate = crossings / timeDomainData.length;
  
  let timeDomainEnergy = 0;
  for (let i = 0; i < timeDomainData.length; i++) {
    const val = (timeDomainData[i] - 128) / 128;
    timeDomainEnergy += val * val;
  }
  timeDomainEnergy = Math.sqrt(timeDomainEnergy / timeDomainData.length);
  
  let riseTime = 0;
  if (envelopeHistory.length >= 3) {
    const recent = envelopeHistory.slice(-5);
    const minEnergy = Math.min(...recent.map(e => e.energy));
    const maxEnergy = Math.max(...recent.map(e => e.energy));
    if (maxEnergy > minEnergy) {
      riseTime = (maxEnergy - minEnergy) / maxEnergy;
    }
  }
  
  return {
    dominantFrequency,
    energy,
    spectralCentroid,
    zeroCrossingRate,
    riseTime,
    timeDomainEnergy
  };
}

function calculateProfileFromSamples(samples: SoundSample[]): LearnedSoundProfile {
  if (samples.length === 0) {
    throw new Error('No samples to analyze');
  }
  
  const frequencies = samples.map(s => s.dominantFrequency);
  const energies = samples.map(s => s.energy);
  const centroids = samples.map(s => s.spectralCentroid);
  const zcrs = samples.map(s => s.zeroCrossingRate);
  const riseTimes = samples.map(s => s.riseTime);
  const timeDomainEnergies = samples.map(s => s.timeDomainEnergy);
  
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const stdDev = (arr: number[]) => {
    const mean = avg(arr);
    return Math.sqrt(arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length);
  };
  const min = (arr: number[]) => Math.min(...arr);
  const max = (arr: number[]) => Math.max(...arr);
  
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sampleCount: samples.length,
    frequencyRange: {
      min: min(frequencies),
      max: max(frequencies),
      avg: avg(frequencies)
    },
    energyRange: {
      min: min(energies),
      max: max(energies),
      avg: avg(energies),
      stdDev: stdDev(energies)
    },
    spectralCentroidRange: {
      min: min(centroids),
      max: max(centroids),
      avg: avg(centroids)
    },
    zeroCrossingRateRange: {
      min: min(zcrs),
      max: max(zcrs),
      avg: avg(zcrs)
    },
    riseTimeRange: {
      min: min(riseTimes),
      max: max(riseTimes),
      avg: avg(riseTimes)
    },
    timeDomainEnergyRange: {
      min: min(timeDomainEnergies),
      max: max(timeDomainEnergies),
      avg: avg(timeDomainEnergies)
    },
    confidenceWeight: {
      energy: 0.35,
      frequency: 0.15,
      spectralCentroid: 0.15,
      zeroCrossingRate: 0.1,
      riseTime: 0.1,
      timeDomain: 0.15
    }
  };
}

export function useSoundLearning(): UseSoundLearningReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [samples, setSamples] = useState<SoundSample[]>([]);
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
    samples: SoundSample[];
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
    samples: []
  });

  const detectSoundEvent = useCallback((energy: number) => {
    const state = recordingRef.current;
    
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
          const recent = state.envelopeHistory.slice(-10);
          const lastSample = state.samples[state.samples.length - 1];
          if (!lastSample || (now - lastSample.timestamp) > minInterval) {
            if (state.getAudioData) {
              const features = calculateFeatures(
                state.getAudioData(),
                state.minFreq,
                state.maxFreq,
                state.envelopeHistory
              );
            
              state.samples.push({
                timestamp: now,
                ...features
              });
              
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
    
    detectSoundEvent(energy);
    
    if (state.isActive) {
      state.animationFrameId = requestAnimationFrame(recordingLoop);
    }
  }, [detectSoundEvent]);

  const startLearning = useCallback((getAudioData: () => AudioAnalyzerData, count: number = 3) => {
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
      samples: []
    };
    
    setIsRecording(true);
    setRecordingProgress(0);
    setSamples([]);
    recordingRef.current.animationFrameId = requestAnimationFrame(recordingLoop);
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
        const profile = calculateProfileFromSamples(state.samples);
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
    
    if (newSamples.length > 0) {
      try {
        const profile = calculateProfileFromSamples(newSamples);
        setLearnedProfile(profile);
      } catch (e) {
        console.error('Failed to recalculate profile:', e);
      }
    } else {
      setLearnedProfile(null);
    }
  }, [samples]);

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
    updateProfile
  };
}
