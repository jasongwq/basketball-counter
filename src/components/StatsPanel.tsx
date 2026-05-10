import React, { useEffect, useState } from 'react';
import { HitDetectionResult, HitRecord } from '../hooks/useHitDetection';

interface StatsPanelProps {
  result: HitDetectionResult;
  isActive: boolean;
  energyThreshold: number;
  onThresholdChange: (value: number) => void;
  minFrequency?: number;
  maxFrequency?: number;
  onMinFrequencyChange?: (value: number) => void;
  onMaxFrequencyChange?: (value: number) => void;
  currentConfidence?: number;
  minHitInterval?: number;
  onMinHitIntervalChange?: (value: number) => void;
  confidenceThreshold?: number;
  onConfidenceThresholdChange?: (value: number) => void;
  peakWindowSize?: number;
  onPeakWindowSizeChange?: (value: number) => void;
  energyWeight?: number;
  timeDomainWeight?: number;
  stabilityWeight?: number;
  rangeWeight?: number;
  onEnergyWeightChange?: (value: number) => void;
  onTimeDomainWeightChange?: (value: number) => void;
  onStabilityWeightChange?: (value: number) => void;
  onRangeWeightChange?: (value: number) => void;
  useAdaptiveThreshold?: boolean;
  onUseAdaptiveThresholdChange?: (value: boolean) => void;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  result,
  isActive,
  energyThreshold,
  onThresholdChange,
  minFrequency = 50,
  maxFrequency = 300,
  onMinFrequencyChange,
  onMaxFrequencyChange,
  currentConfidence = 0,
  minHitInterval = 250,
  onMinHitIntervalChange,
  confidenceThreshold = 0.5,
  onConfidenceThresholdChange,
  peakWindowSize = 5,
  onPeakWindowSizeChange,
  energyWeight = 0.4,
  timeDomainWeight = 0.25,
  stabilityWeight = 0.15,
  rangeWeight = 0.2,
  onEnergyWeightChange,
  onTimeDomainWeightChange,
  onStabilityWeightChange,
  onRangeWeightChange,
  useAdaptiveThreshold = false,
  onUseAdaptiveThresholdChange
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

  const getConfidenceColor = (conf: number): string => {
    if (conf >= 0.7) return 'text-green-400';
    if (conf >= 0.4) return 'text-yellow-400';
    return 'text-gray-400';
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
            <span className="text-gray-400">当前置信度</span>
            <span className={`font-medium ${getConfidenceColor(currentConfidence)}`}>
              {(currentConfidence * 100).toFixed(0)}%
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
            <div className="text-xs text-gray-400 mb-2">详细记录 (最近10次)</div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {result.frequencyHistory.slice(-10).reverse().map((record: HitRecord, index: number) => {
                const confPercent = (record.confidence * 100).toFixed(0);
                const confColor = record.confidence >= 0.7 ? 'text-green-400' : 
                                  record.confidence >= 0.4 ? 'text-yellow-400' : 'text-gray-400';
                return (
                  <div key={index} className="bg-gray-900/50 rounded-lg p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-orange-400 font-bold">#{record.id}</span>
                      <span className={`text-xs font-mono ${confColor}`}>{confPercent}%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">绝对时间</span>
                        <span className="text-gray-300 font-mono">{record.absoluteTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">相对时间</span>
                        <span className="text-gray-300 font-mono">{record.relativeTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">主频率</span>
                        <span className="text-blue-300 font-mono">{record.frequency} Hz</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">峰值频率</span>
                        <span className="text-cyan-300 font-mono">{record.peakFrequency} Hz</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">频率能量</span>
                        <span className="text-purple-300 font-mono">{record.energy}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">时域能量</span>
                        <span className="text-pink-300 font-mono">{record.timeDomainEnergy}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">稳定性</span>
                        <span className="text-yellow-300 font-mono">{record.stability}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">上升时间</span>
                        <span className="text-orange-300 font-mono">{record.riseTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">频谱质心</span>
                        <span className="text-green-300 font-mono">{record.spectralCentroid} Hz</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">过零率</span>
                        <span className="text-red-300 font-mono">{record.zeroCrossingRate}</span>
                      </div>
                      <div className="flex justify-between col-span-2">
                        <span className="text-gray-500">短促冲击</span>
                        <span className={record.isShortBurst ? 'text-green-400' : 'text-gray-500'}>
                          {record.isShortBurst ? '✓ 是' : '✗ 否'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm text-gray-400">检测阈值</label>
            <span className="text-sm text-orange-400 font-medium">{energyThreshold}</span>
          </div>
          {onUseAdaptiveThresholdChange && (
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500">自适应阈值</span>
              <button
                onClick={() => onUseAdaptiveThresholdChange(!useAdaptiveThreshold)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  useAdaptiveThreshold
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {useAdaptiveThreshold ? '开' : '关'}
              </button>
            </div>
          )}
          <input
            type="range"
            min="10"
            max="200"
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
            <p className="text-xs text-gray-500 text-center mt-1">
              篮球拍球约 50-300 Hz
            </p>
          </div>
        )}

        {onMinHitIntervalChange && (
          <div className="space-y-2 pt-3 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <label className="text-sm text-gray-400">最小间隔</label>
              <span className="text-sm text-yellow-400 font-medium">{minHitInterval} ms</span>
            </div>
            <input
              type="range"
              min="100"
              max="1000"
              value={minHitInterval}
              onChange={(e) => onMinHitIntervalChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              disabled={!isActive}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>快速连击</span>
              <span>慢速</span>
            </div>
          </div>
        )}

        {onConfidenceThresholdChange && (
          <div className="space-y-2 pt-3 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <label className="text-sm text-gray-400">置信度阈值</label>
              <span className="text-sm text-green-400 font-medium">{(confidenceThreshold * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={confidenceThreshold * 100}
              onChange={(e) => onConfidenceThresholdChange(Number(e.target.value) / 100)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              disabled={!isActive}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>宽松检测</span>
              <span>严格检测</span>
            </div>
          </div>
        )}

        {onPeakWindowSizeChange && (
          <div className="space-y-2 pt-3 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <label className="text-sm text-gray-400">峰值窗口</label>
              <span className="text-sm text-purple-400 font-medium">{peakWindowSize} 帧</span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              value={peakWindowSize}
              onChange={(e) => onPeakWindowSizeChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              disabled={!isActive}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>快速响应</span>
              <span>平滑检测</span>
            </div>
          </div>
        )}

        {(onEnergyWeightChange || onTimeDomainWeightChange || onStabilityWeightChange || onRangeWeightChange) && (
          <div className="space-y-3 pt-3 border-t border-gray-700">
            <div className="text-sm text-gray-400 font-medium">特征权重</div>

            {onEnergyWeightChange && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-orange-400">能量权重</span>
                  <span className="text-gray-300">{(energyWeight * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={energyWeight * 100}
                  onChange={(e) => onEnergyWeightChange(Number(e.target.value) / 100)}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  disabled={!isActive}
                />
              </div>
            )}

            {onTimeDomainWeightChange && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-pink-400">时域权重</span>
                  <span className="text-gray-300">{(timeDomainWeight * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={timeDomainWeight * 100}
                  onChange={(e) => onTimeDomainWeightChange(Number(e.target.value) / 100)}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  disabled={!isActive}
                />
              </div>
            )}

            {onStabilityWeightChange && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-yellow-400">稳定性权重</span>
                  <span className="text-gray-300">{(stabilityWeight * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={stabilityWeight * 100}
                  onChange={(e) => onStabilityWeightChange(Number(e.target.value) / 100)}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  disabled={!isActive}
                />
              </div>
            )}

            {onRangeWeightChange && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-cyan-400">频率范围权重</span>
                  <span className="text-gray-300">{(rangeWeight * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={rangeWeight * 100}
                  onChange={(e) => onRangeWeightChange(Number(e.target.value) / 100)}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  disabled={!isActive}
                />
              </div>
            )}

            <p className="text-xs text-gray-500 text-center">
              总权重: {((energyWeight + timeDomainWeight + stabilityWeight + rangeWeight) * 100).toFixed(0)}%
            </p>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-green-900/20 to-blue-900/20 rounded-xl p-4 border border-green-500/20">
        <div className="flex items-start space-x-3">
          <div className="text-2xl">🎯</div>
          <div>
            <h4 className="text-green-400 font-semibold text-sm mb-1">自适应检测</h4>
            <p className="text-gray-400 text-xs leading-relaxed">
              系统会先自动校准环境噪音，生成自适应阈值。多特征融合检测更准确。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
