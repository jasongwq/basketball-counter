import React, { useEffect, useState } from 'react';
import { HitDetectionResult, HitRecord } from '../hooks/useHitDetection';

interface StatsPanelProps {
  result: HitDetectionResult;
  isActive: boolean;
  currentConfidence: number;
  confidenceThreshold?: number;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  result,
  isActive,
  currentConfidence,
  confidenceThreshold = 0.5
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

  const getConfidenceColor = (conf: number): string => {
    if (conf >= confidenceThreshold) return 'text-green-400';
    if (conf >= confidenceThreshold * 0.6) return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
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

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">当前置信度</span>
          <span className={`font-medium ${getConfidenceColor(currentConfidence)}`}>
            {(currentConfidence * 100).toFixed(0)}%
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-400">平均置信度</span>
          <span className={`font-medium ${getConfidenceColor(result.averageConfidence)}`}>
            {(result.averageConfidence * 100).toFixed(0)}%
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-400">学习样本</span>
          <span className={result.learnedProfile ? 'text-green-400' : 'text-gray-500'}>
            {result.learnedProfile ? `${result.learnedProfile.sampleCount} 个` : '未学习'}
          </span>
        </div>
      </div>

      {result.frequencyHistory.length > 0 && (
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-2">检测记录 (最近5次)</div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {result.frequencyHistory.slice(-5).reverse().map((record: HitRecord, index: number) => {
              const confPercent = (record.confidence * 100).toFixed(0);
              const confColor = record.confidence >= confidenceThreshold ? 'text-green-400' : 
                                record.confidence >= confidenceThreshold * 0.6 ? 'text-yellow-400' : 'text-gray-400';
              return (
                <div key={index} className="bg-gray-900/50 rounded-lg p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-orange-400 font-bold">#{record.id}</span>
                    <span className={`text-xs font-mono ${confColor}`}>{confPercent}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">时间</span>
                      <span className="text-gray-300 font-mono">{record.relativeTime}</span>
                    </div>
                    {record.features?.derived?.dominantFrequency && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">频率</span>
                        <span className="text-cyan-300 font-mono">
                          {record.features.derived.dominantFrequency.toFixed(0)} Hz
                        </span>
                      </div>
                    )}
                    {record.features?.timeDomain?.rms && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">RMS</span>
                        <span className="text-purple-300 font-mono">
                          {record.features.timeDomain.rms.toFixed(3)}
                        </span>
                      </div>
                    )}
                    {record.features?.timeDomain?.zeroCrossingRate && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">过零率</span>
                        <span className="text-pink-300 font-mono">
                          {record.features.timeDomain.zeroCrossingRate.toFixed(3)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-green-900/20 to-blue-900/20 rounded-xl p-4 border border-green-500/20">
        <div className="flex items-start space-x-3">
          <div className="text-2xl">🎯</div>
          <div>
            <h4 className="text-green-400 font-semibold text-sm mb-1">机器学习检测</h4>
            <p className="text-gray-400 text-xs leading-relaxed">
              {result.learnedProfile 
                ? '已学习您的拍球特征，检测更准确'
                : '录制您的拍球声音进行学习，提高识别准确度'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
