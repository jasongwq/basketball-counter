import React, { useEffect, useState } from 'react';
import { HitDetectionResult } from '../hooks/useHitDetection';

interface StatsPanelProps {
  result: HitDetectionResult;
  isActive: boolean;
  energyThreshold: number;
  onThresholdChange: (value: number) => void;
  minFrequency?: number;
  maxFrequency?: number;
  onMinFrequencyChange?: (value: number) => void;
  onMaxFrequencyChange?: (value: number) => void;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  result,
  isActive,
  energyThreshold,
  onThresholdChange,
  minFrequency = 20,
  maxFrequency = 500,
  onMinFrequencyChange,
  onMaxFrequencyChange
}) => {
  const [animatedCount, setAnimatedCount] = useState(0);

  useEffect(() => {
    if (result.hitCount > animatedCount) {
      const timeout = setTimeout(() => {
        setAnimatedCount(result.hitCount);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [result.hitCount, animatedCount]);

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getPerformanceLevel = (): { label: string; color: string; icon: string } => {
    if (result.hitsPerMinute >= 60) {
      return { label: '专业级', color: 'text-yellow-400', icon: '⚡' };
    } else if (result.hitsPerMinute >= 40) {
      return { label: '优秀', color: 'text-green-400', icon: '🔥' };
    } else if (result.hitsPerMinute >= 20) {
      return { label: '良好', color: 'text-blue-400', icon: '👍' };
    } else if (result.hitsPerMinute > 0) {
      return { label: '进行中', color: 'text-gray-400', icon: '🎯' };
    }
    return { label: '待开始', color: 'text-gray-500', icon: '⏳' };
  };

  const performance = getPerformanceLevel();

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-xl p-6 space-y-6">
        <div className="text-center">
          <div className="text-6xl font-bold text-white mb-2 transition-all duration-300">
            {animatedCount}
          </div>
          <div className="text-gray-400 text-sm uppercase tracking-wider">篮球拍球次数</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-orange-400">
              {result.hitsPerMinute.toFixed(1)}
            </div>
            <div className="text-gray-400 text-xs mt-1">次/分钟</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-yellow-400">
              {formatDuration(result.duration)}
            </div>
            <div className="text-gray-400 text-xs mt-1">训练时长</div>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-2 bg-gray-800/50 rounded-lg py-3">
          <span className="text-2xl">{performance.icon}</span>
          <span className={`text-lg font-semibold ${performance.color}`}>
            {performance.label}
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">峰值频率</span>
            <span className="text-cyan-400 font-medium">
              {result.peakFrequency > 0 ? `${result.peakFrequency.toFixed(0)} Hz` : '--'}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-400">上次频率</span>
            <span className="text-green-400 font-medium">
              {result.lastHitFrequency > 0 ? `${result.lastHitFrequency.toFixed(0)} Hz` : '--'}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-400">平均能量</span>
            <span className="text-purple-400 font-medium">
              {result.averageEnergy.toFixed(1)}
            </span>
          </div>
        </div>

        {result.frequencyHistory.length > 0 && (
          <div className="bg-gray-800/30 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-2">频率记录 (最近10次)</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {result.frequencyHistory.slice(-10).reverse().map((item, index) => {
                const elapsed = item.time - (result.frequencyHistory[0]?.time || 0);
                const seconds = Math.floor(elapsed / 1000);
                const minutes = Math.floor(seconds / 60);
                const secs = seconds % 60;
                const timeStr = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                return (
                  <div key={index} className="flex justify-between text-xs bg-gray-700/30 px-2 py-1 rounded">
                    <span className="text-gray-500">#{result.frequencyHistory.length - index}</span>
                    <span className="text-blue-300 font-mono">{item.frequency} Hz</span>
                    <span className="text-gray-500">{timeStr}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm text-gray-400">检测灵敏度</label>
            <span className="text-sm text-orange-400 font-medium">{energyThreshold}</span>
          </div>
          <input
            type="range"
            min="30"
            max="180"
            value={energyThreshold}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            disabled={!isActive}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>高灵敏度</span>
            <span>低灵敏度</span>
          </div>
        </div>

        {onMinFrequencyChange && onMaxFrequencyChange && (
          <div className="space-y-2 pt-3 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <label className="text-sm text-gray-400">频率范围</label>
              <span className="text-sm text-cyan-400 font-medium">{minFrequency} - {maxFrequency} Hz</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>最小</span>
                  <span>{minFrequency}Hz</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="200"
                  value={minFrequency}
                  onChange={(e) => onMinFrequencyChange(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  disabled={!isActive}
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>最大</span>
                  <span>{maxFrequency}Hz</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1000"
                  value={maxFrequency}
                  onChange={(e) => onMaxFrequencyChange(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  disabled={!isActive}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-orange-900/20 to-yellow-900/20 rounded-xl p-4 border border-orange-500/20">
        <div className="flex items-start space-x-3">
          <div className="text-2xl">💡</div>
          <div>
            <h4 className="text-orange-400 font-semibold text-sm mb-1">使用提示</h4>
            <p className="text-gray-400 text-xs leading-relaxed">
              调整灵敏度阈值可以过滤环境噪音。建议在安静环境下使用此应用进行篮球拍球训练。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
