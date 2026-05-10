import { useState, useRef, useCallback, useEffect } from 'react';

export interface AudioAnalyzerData {
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
  energy: number;
}

export interface UseAudioAnalyzerReturn {
  isListening: boolean;
  hasPermission: boolean;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  getAudioData: () => AudioAnalyzerData;
  analyserRef: React.RefObject<AnalyserNode | null>;
  audioContextRef: React.RefObject<AudioContext | null>;
}

export function useAudioAnalyzer(): UseAudioAnalyzerReturn {
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArraysRef = useRef<{
    frequencyData: Uint8Array;
    timeDomainData: Uint8Array;
  } | null>(null);

  const getAudioData = useCallback((): AudioAnalyzerData => {
    if (!analyserRef.current || !dataArraysRef.current) {
      return {
        frequencyData: new Uint8Array(128),
        timeDomainData: new Uint8Array(256),
        energy: 0
      };
    }

    analyserRef.current.getByteFrequencyData(dataArraysRef.current.frequencyData);
    analyserRef.current.getByteTimeDomainData(dataArraysRef.current.timeDomainData);

    const frequencyData = dataArraysRef.current.frequencyData;
    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      sum += frequencyData[i] * frequencyData[i];
    }
    const energy = Math.sqrt(sum / frequencyData.length);

    return {
      frequencyData: dataArraysRef.current.frequencyData,
      timeDomainData: dataArraysRef.current.timeDomainData,
      energy
    };
  }, []);

  const stopListening = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    dataArraysRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback(async () => {
    try {
      setError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('您的浏览器不支持麦克风访问。请使用 Chrome、Safari 或 Firefox 等现代浏览器。');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      streamRef.current = stream;
      setHasPermission(true);

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('您的浏览器不支持 Web Audio API。请使用现代浏览器。');
      }
      
      const audioContext = new AudioContextClass({ sampleRate: 48000 });
      audioContextRef.current = audioContext;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.5;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyserRef.current = analyser;

      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      dataArraysRef.current = {
        frequencyData: new Uint8Array(bufferLength),
        timeDomainData: new Uint8Array(analyser.fftSize)
      };

      setIsListening(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '无法访问麦克风';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('麦克风权限被拒绝。请在浏览器设置中允许麦克风访问，然后刷新页面重试。');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('未找到麦克风设备。请确保您的设备已连接麦克风。');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('麦克风正在被其他程序使用。请关闭其他使用麦克风的应用程序后重试。');
        } else {
          setError(errorMessage);
        }
      } else {
        setError('无法访问麦克风。请确保使用 HTTPS 连接或在本地服务器上运行。');
      }
      
      setHasPermission(false);
      console.error('音频初始化错误:', err);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    hasPermission,
    error,
    startListening,
    stopListening,
    getAudioData,
    analyserRef,
    audioContextRef
  };
}
