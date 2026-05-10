import React, { useRef, useEffect } from 'react';
import { AudioAnalyzerData } from '../hooks/useAudioAnalyzer';

interface AudioVisualizerProps {
  audioData: AudioAnalyzerData;
  isActive: boolean;
  dribbleCount: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
  audioData, 
  isActive, 
  dribbleCount 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }>>([]);
  const lastDribbleCountRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const waveformCanvas = waveformCanvasRef.current;
    const particleCanvas = particleCanvasRef.current;
    
    if (!canvas || !waveformCanvas || !particleCanvas) return;

    const ctx = canvas.getContext('2d');
    const waveformCtx = waveformCanvas.getContext('2d');
    const particleCtx = particleCanvas.getContext('2d');

    if (!ctx || !waveformCtx || !particleCtx) return;

    let animationId: number;

    const resizeCanvases = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;

      [canvas, waveformCanvas, particleCanvas].forEach(c => {
        if (c) {
          c.width = width * dpr;
          c.height = height * dpr;
          c.style.width = `${width}px`;
          c.style.height = `${height}px`;
        }
      });

      ctx.scale(dpr, dpr);
      waveformCtx.scale(dpr, dpr);
      particleCtx.scale(dpr, dpr);
    };

    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);

    const drawSpectrum = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      
      ctx.fillStyle = 'rgba(26, 26, 46, 0.3)';
      ctx.fillRect(0, 0, width, height);

      if (!isActive) {
        ctx.fillStyle = 'rgba(107, 114, 128, 0.5)';
        ctx.font = '16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('点击开始按钮启动篮球拍球检测', width / 2, height / 2);
        return;
      }

      const { frequencyData } = audioData;
      const barCount = 64;
      const barWidth = (width / barCount) - 2;
      const step = Math.floor(frequencyData.length / barCount);

      for (let i = 0; i < barCount; i++) {
        const value = frequencyData[i * step];
        const barHeight = (value / 255) * height;
        
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, '#FF6B35');
        gradient.addColorStop(0.5, '#F7B32B');
        gradient.addColorStop(1, '#0F4C75');
        
        ctx.fillStyle = gradient;
        
        const x = i * (barWidth + 2);
        const y = height - barHeight;
        
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
        ctx.fill();

        if (value > 180) {
          ctx.shadowColor = '#FF6B35';
          ctx.shadowBlur = 15;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    };

    const drawWaveform = () => {
      const width = waveformCanvas.offsetWidth;
      const height = waveformCanvas.offsetHeight;
      
      waveformCtx.fillStyle = 'rgba(15, 76, 117, 0.3)';
      waveformCtx.fillRect(0, 0, width, height);

      if (!isActive) return;

      const { timeDomainData } = audioData;
      
      waveformCtx.lineWidth = 2;
      waveformCtx.strokeStyle = '#F7B32B';
      waveformCtx.beginPath();

      const sliceWidth = width / timeDomainData.length;
      let x = 0;

      for (let i = 0; i < timeDomainData.length; i++) {
        const v = timeDomainData[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          waveformCtx.moveTo(x, y);
        } else {
          waveformCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      waveformCtx.stroke();

      waveformCtx.shadowColor = '#F7B32B';
      waveformCtx.shadowBlur = 10;
      waveformCtx.stroke();
      waveformCtx.shadowBlur = 0;
    };

    const emitParticles = () => {
      const centerX = particleCanvas.offsetWidth / 2;
      const centerY = particleCanvas.offsetHeight / 2;
      
      for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        const speed = 3 + Math.random() * 3;
        
        particlesRef.current.push({
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: Math.random() > 0.5 ? '#FF6B35' : '#F7B32B'
        });
      }
    };

    const drawParticles = () => {
      const width = particleCanvas.offsetWidth;
      const height = particleCanvas.offsetHeight;
      
      particleCtx.clearRect(0, 0, width, height);

      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        p.vy += 0.1;

        if (p.life > 0) {
          particleCtx.beginPath();
          particleCtx.arc(p.x, p.y, 4 * p.life, 0, Math.PI * 2);
          particleCtx.fillStyle = p.color;
          particleCtx.globalAlpha = p.life;
          particleCtx.fill();
          particleCtx.globalAlpha = 1;
          return true;
        }
        return false;
      });
    };

    const animate = () => {
      drawSpectrum();
      drawWaveform();
      drawParticles();
      animationId = requestAnimationFrame(animate);
    };

    animate();

    if (dribbleCount > lastDribbleCountRef.current) {
      emitParticles();
      lastDribbleCountRef.current = dribbleCount;
    }

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvases);
    };
  }, [audioData, isActive, dribbleCount]);

  return (
    <div className="relative w-full h-80 rounded-xl overflow-hidden bg-gradient-to-br from-gray-900 to-blue-900">
      <canvas 
        ref={particleCanvasRef}
        className="absolute inset-0 pointer-events-none"
      />
      <canvas 
        ref={canvasRef}
        className="absolute inset-0"
      />
      <canvas 
        ref={waveformCanvasRef}
        className="absolute bottom-0 left-0 right-0 h-1/3"
      />
      <div className="absolute top-4 left-4 z-10">
        <h3 className="text-white font-semibold text-sm">频谱分析</h3>
      </div>
      <div className="absolute bottom-4 left-4 z-10">
        <h3 className="text-white font-semibold text-sm">波形显示</h3>
      </div>
    </div>
  );
};
