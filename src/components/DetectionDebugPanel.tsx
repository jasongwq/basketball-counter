import React, { useState, useEffect } from 'react';
import { DetectionDebugInfo } from '../hooks/useHitDetection';

interface DetectionDebugPanelProps {
  debugInfo: DetectionDebugInfo;
  isActive: boolean;
}

interface CheckStep {
  id: string;
  name: string;
  status: 'pending' | 'checking' | 'pass' | 'fail' | 'skip';
  value?: string;
  threshold?: string;
  detail?: string;
}

export const DetectionDebugPanel: React.FC<DetectionDebugPanelProps> = ({ debugInfo, isActive }) => {
  const [steps, setSteps] = useState<CheckStep[]>([]);

  useEffect(() => {
    if (!isActive || !debugInfo) return;

    const newSteps: CheckStep[] = [
      {
        id: 'energy',
        name: '能量检测',
        status: debugInfo.energyChecked ? (debugInfo.energyPass ? 'pass' : 'fail') : 'checking',
        value: debugInfo.currentEnergy?.toFixed(1) ?? '-',
        threshold: `> ${debugInfo.energyThreshold?.toFixed(1) ?? '-'}`,
        detail: debugInfo.energyChecked ? (debugInfo.energyPass ? '能量充足' : '能量不足') : '等待中'
      },
      {
        id: 'rising',
        name: '上升沿检测',
        status: debugInfo.risingChecked ? (debugInfo.risingPass ? 'pass' : 'fail') : 'skip',
        value: debugInfo.isRising ? '是' : '否',
        threshold: '能量上升',
        detail: !debugInfo.energyPass ? '跳过' : (debugInfo.risingPass ? '检测到上升' : '无上升沿')
      },
      {
        id: 'peak',
        name: '峰值检测',
        status: debugInfo.peakChecked ? (debugInfo.peakPass ? 'pass' : 'fail') : 'skip',
        value: debugInfo.peakEnergy?.toFixed(1) ?? '-',
        threshold: `> 能量×0.7`,
        detail: !debugInfo.risingPass ? '跳过' : (debugInfo.peakPass ? '峰值已过' : '等待峰值')
      },
      {
        id: 'confidence',
        name: '置信度',
        status: debugInfo.confidenceChecked ? (debugInfo.confidencePass ? 'pass' : 'fail') : 'checking',
        value: debugInfo.currentConfidence !== undefined ? `${(debugInfo.currentConfidence * 100).toFixed(0)}%` : '-',
        threshold: `> ${((debugInfo.confidenceThreshold ?? 0.5) * 100).toFixed(0)}%`,
        detail: debugInfo.confidenceChecked 
          ? (debugInfo.confidencePass ? '特征匹配' : '特征不匹配')
          : '计算中'
      },
      {
        id: 'interval',
        name: '时间间隔',
        status: debugInfo.intervalChecked ? (debugInfo.intervalPass ? 'pass' : 'fail') : 'skip',
        value: debugInfo.timeSinceLastHit !== undefined ? `${debugInfo.timeSinceLastHit}ms` : '-',
        threshold: `> ${debugInfo.minInterval ?? 250}ms`,
        detail: !debugInfo.peakPass ? '跳过' : (debugInfo.intervalPass ? '间隔足够' : '间隔太短')
      },
      {
        id: 'result',
        name: '最终判定',
        status: debugInfo.detected ? 'pass' : (debugInfo.allChecksComplete ? 'fail' : 'checking'),
        value: debugInfo.detected ? '✓ 计数' : (debugInfo.allChecksComplete ? '✗ 未通过' : '判定中'),
        detail: debugInfo.failReason || (debugInfo.detected ? '检测成功' : '等待完整判定')
      }
    ];

    setSteps(newSteps);
  }, [debugInfo, isActive]);

  const getStatusColor = (status: CheckStep['status']) => {
    switch (status) {
      case 'pass': return { bg: 'bg-green-900/50', border: 'border-green-500', text: 'text-green-400', icon: '✓' };
      case 'fail': return { bg: 'bg-red-900/50', border: 'border-red-500', text: 'text-red-400', icon: '✗' };
      case 'checking': return { bg: 'bg-yellow-900/50', border: 'border-yellow-500', text: 'text-yellow-400', icon: '◐' };
      case 'skip': return { bg: 'bg-gray-800/50', border: 'border-gray-600', text: 'text-gray-500', icon: '○' };
      default: return { bg: 'bg-gray-800/50', border: 'border-gray-600', text: 'text-gray-400', icon: '○' };
    }
  };

  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gradient-to-br from-gray-900 to-purple-900 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          🔍 检测调试面板
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          {expanded ? '收起' : '展开'}
        </button>
      </div>

      <div className="space-y-2">
        {steps.map((step, index) => {
          const colors = getStatusColor(step.status);
          return (
            <div key={step.id} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${step.status === 'pass' ? 'bg-green-400' : step.status === 'fail' ? 'bg-red-400' : step.status === 'checking' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-600'}`} />
              <span className="text-xs text-gray-400 w-20">{step.name}</span>
              <span className={`text-xs font-mono ${colors.text}`}>{step.value}</span>
              {expanded && step.threshold && (
                <span className="text-xs text-gray-500 ml-auto">阈值: {step.threshold}</span>
              )}
            </div>
          );
        })}
      </div>

      {expanded && debugInfo && (
        <div className="bg-gray-900/50 rounded-lg p-3 space-y-2 text-xs">
          <div className="text-gray-400 mb-2">详细参数:</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">当前能量:</span>
              <span className="text-cyan-400 font-mono">{debugInfo.currentEnergy?.toFixed(2) ?? '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">能量阈值:</span>
              <span className="text-orange-400 font-mono">{debugInfo.energyThreshold?.toFixed(2) ?? '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">SNR:</span>
              <span className="text-purple-400 font-mono">{debugInfo.snr?.toFixed(2) ?? '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">峰值能量:</span>
              <span className="text-yellow-400 font-mono">{debugInfo.peakEnergy?.toFixed(2) ?? '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">频率:</span>
              <span className="text-pink-400 font-mono">{debugInfo.dominantFrequency?.toFixed(0) ?? '-'} Hz</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">间隔:</span>
              <span className="text-green-400 font-mono">{debugInfo.timeSinceLastHit ?? '-'}ms</span>
            </div>
          </div>
        </div>
      )}

      <div className={`text-xs text-center py-2 rounded-lg ${debugInfo.detected ? 'bg-green-900/30 text-green-400' : 'bg-gray-800/30 text-gray-500'}`}>
        {debugInfo.detected 
          ? `🎯 检测成功！当前计数: ${debugInfo.hitCount}`
          : debugInfo.failReason || '等待检测中...'}
      </div>
    </div>
  );
};
