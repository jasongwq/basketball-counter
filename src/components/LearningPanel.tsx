import React, { useState, useEffect } from 'react';
import { LearnedSoundProfile, SoundFeatures } from '../hooks/useSoundLearning';

interface LearningPanelProps {
  isRecording: boolean;
  recordingProgress: number;
  samples: SoundFeatures[];
  learnedProfile: LearnedSoundProfile | null;
  onStartLearning: (count: number) => void;
  onStopLearning: () => void;
  onSaveProfile: () => void;
  onClearProfile: () => void;
  onDeleteSample: (index: number) => void;
  onUpdateProfile: (profile: LearnedSoundProfile) => void;
  onExportProfile?: () => void;
  onImportProfile?: () => void;
  isActive: boolean;
}

export const LearningPanel: React.FC<LearningPanelProps> = ({
  isRecording,
  recordingProgress,
  samples,
  learnedProfile,
  onStartLearning,
  onStopLearning,
  onSaveProfile,
  onClearProfile,
  onDeleteSample,
  onUpdateProfile,
  onExportProfile,
  onImportProfile,
  isActive
}) => {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<LearnedSoundProfile | null>(null);

  useEffect(() => {
    if (learnedProfile) {
      setEditingProfile({ ...learnedProfile });
    }
  }, [learnedProfile]);

  const handleOpenEdit = () => {
    if (learnedProfile) {
      setEditingProfile({ ...learnedProfile });
      setShowProfileModal(true);
    }
  };

  const handleSaveEdit = () => {
    if (editingProfile) {
      onUpdateProfile(editingProfile);
      setShowProfileModal(false);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const renderFeatureRow = (label: string, stats: { min: number; max: number; avg: number; stdDev: number }, unit: string = '', decimals: number = 1) => (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300">
        {stats.avg.toFixed(decimals)}{unit}
        <span className="text-gray-500 ml-1">±{stats.stdDev.toFixed(decimals)}</span>
      </span>
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-lg flex items-center gap-2">
          🎓 声音学习
        </h3>
        {learnedProfile && (
          <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">
            已学习 {learnedProfile.sampleCount} 个样本
          </span>
        )}
      </div>

      {!isRecording && samples.length === 0 && !learnedProfile && (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            录制您的篮球拍球声音，学习特征参数，提高检测准确度。
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onStartLearning(3)}
              disabled={!isActive}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              录 3 次
            </button>
            <button
              onClick={() => onStartLearning(5)}
              disabled={!isActive}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              录 5 次
            </button>
            <button
              onClick={() => onStartLearning(10)}
              disabled={!isActive}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              录 10 次
            </button>
          </div>
          <p className="text-gray-500 text-xs text-center">
            请拍球时力度适中，环境安静
          </p>
        </div>
      )}

      {isRecording && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-2 animate-pulse">🎙️</div>
            <p className="text-yellow-400 font-medium">正在录制...</p>
            <p className="text-gray-400 text-sm">请拍 {(samples.length || 0) + 1}/...</p>
          </div>
          
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-400 h-3 rounded-full transition-all"
              style={{ width: `${recordingProgress * 100}%` }}
            />
          </div>
          
          <button
            onClick={onStopLearning}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-lg font-medium hover:from-red-700 hover:to-red-800 transition-all"
          >
            停止录制
          </button>
        </div>
      )}

      {!isRecording && samples.length > 0 && !learnedProfile && (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            已录制 {samples.length} 个样本
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {samples.map((sample, index) => (
              <div key={index} className="bg-gray-800/50 rounded-lg p-2 flex justify-between items-center">
                <span className="text-orange-400 text-sm">样本 #{index + 1}</span>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-300 text-xs">
                    {sample.derived.dominantFrequency.toFixed(0)} Hz
                  </span>
                  <button
                    onClick={() => onDeleteSample(index)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onSaveProfile}
              disabled={samples.length < 1}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-medium hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存学习结果
            </button>
            <button
              onClick={onClearProfile}
              className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-2 rounded-lg font-medium hover:from-gray-700 hover:-gray-800 transition-all"
            >
              清除
            </button>
          </div>
        </div>
      )}

      {learnedProfile && !isRecording && (
        <div className="space-y-4">
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-3 max-h-80 overflow-y-auto">
            <div className="text-xs text-gray-400 mb-2">学习结果 - 更新于 {formatDate(learnedProfile.updatedAt)}</div>
            
            <div className="border-b border-gray-700 pb-2">
              <div className="text-xs text-cyan-400 mb-1">时域特征</div>
              {renderFeatureRow('RMS', learnedProfile.timeDomain.rms, '', 3)}
              {renderFeatureRow('过零率', learnedProfile.timeDomain.zcr, '', 4)}
              {renderFeatureRow('上升时间', learnedProfile.timeDomain.riseTime, '', 2)}
              {renderFeatureRow('峰值因子', learnedProfile.timeDomain.crestFactor, '', 2)}
              {renderFeatureRow('波形熵', learnedProfile.timeDomain.waveformEntropy, '', 2)}
              {renderFeatureRow('偏度', learnedProfile.timeDomain.skewness, '', 2)}
              {renderFeatureRow('峰度', learnedProfile.timeDomain.kurtosis, '', 2)}
            </div>

            <div className="border-b border-gray-700 pb-2">
              <div className="text-xs text-green-400 mb-1">频域特征</div>
              {renderFeatureRow('频谱质心', learnedProfile.frequency.centroid, ' Hz', 0)}
              {renderFeatureRow('频谱滚降', learnedProfile.frequency.rolloff, ' Hz', 0)}
              {renderFeatureRow('频谱平坦度', learnedProfile.frequency.flatness, '', 3)}
              {renderFeatureRow('频谱带宽', learnedProfile.frequency.bandwidth, ' Hz', 0)}
              <div className="text-xs text-gray-500 mt-1">1/3 倍频程能量</div>
              {renderFeatureRow('  低频', learnedProfile.frequency.bandEnergy.low, '', 1)}
              {renderFeatureRow('  中频', learnedProfile.frequency.bandEnergy.mid, '', 1)}
              {renderFeatureRow('  高频', learnedProfile.frequency.bandEnergy.high, '', 1)}
            </div>

            <div className="border-b border-gray-700 pb-2">
              <div className="text-xs text-yellow-400 mb-1">导出特征</div>
              {renderFeatureRow('主频率', learnedProfile.derived.dominantFrequency, ' Hz', 0)}
              {renderFeatureRow('能量', learnedProfile.derived.energy, '', 1)}
            </div>

            <div>
              <div className="text-xs text-purple-400 mb-1">噪声基准</div>
              <div className="text-xs text-gray-300">
                动态噪声基底: <span className="text-orange-300">{learnedProfile.noiseFloor.toFixed(1)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onStartLearning(3)}
              disabled={!isActive}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              重新学习
            </button>
            <button
              onClick={handleOpenEdit}
              className="bg-gradient-to-r from-yellow-600 to-yellow-700 text-white px-3 py-2 rounded-lg font-medium hover:from-yellow-700 hover:to-yellow-800 transition-all text-sm"
            >
              编辑
            </button>
            <button
              onClick={onClearProfile}
              className="bg-gradient-to-r from-red-600 to-red-700 text-white px-3 py-2 rounded-lg font-medium hover:from-red-700 hover:to-red-800 transition-all text-sm"
            >
              清除
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onExportProfile}
              disabled={!learnedProfile}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-3 py-2 rounded-lg font-medium hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              📤 导出
            </button>
            <button
              onClick={onImportProfile}
              className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-3 py-2 rounded-lg font-medium hover:from-purple-700 hover:to-purple-800 transition-all text-sm"
            >
              📥 导入
            </button>
          </div>
        </div>
      )}

      {showProfileModal && editingProfile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-white font-bold text-lg mb-4">学习到的特征参数</h3>
            
            <div className="space-y-4 text-sm">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-cyan-400 font-medium mb-2">时域特征</div>
                <div className="space-y-1 text-xs">
                  <div>RMS: {editingProfile.timeDomain.rms.avg.toFixed(3)} ± {editingProfile.timeDomain.rms.stdDev.toFixed(3)}</div>
                  <div>过零率: {editingProfile.timeDomain.zcr.avg.toFixed(4)} ± {editingProfile.timeDomain.zcr.stdDev.toFixed(4)}</div>
                  <div>上升时间: {editingProfile.timeDomain.riseTime.avg.toFixed(2)} ± {editingProfile.timeDomain.riseTime.stdDev.toFixed(2)}</div>
                  <div>峰值因子: {editingProfile.timeDomain.crestFactor.avg.toFixed(2)} ± {editingProfile.timeDomain.crestFactor.stdDev.toFixed(2)}</div>
                  <div>波形熵: {editingProfile.timeDomain.waveformEntropy.avg.toFixed(2)} ± {editingProfile.timeDomain.waveformEntropy.stdDev.toFixed(2)}</div>
                  <div>偏度: {editingProfile.timeDomain.skewness.avg.toFixed(2)} ± {editingProfile.timeDomain.skewness.stdDev.toFixed(2)}</div>
                  <div>峰度: {editingProfile.timeDomain.kurtosis.avg.toFixed(2)} ± {editingProfile.timeDomain.kurtosis.stdDev.toFixed(2)}</div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-green-400 font-medium mb-2">频域特征</div>
                <div className="space-y-1 text-xs">
                  <div>频谱质心: {editingProfile.frequency.centroid.avg.toFixed(0)} Hz</div>
                  <div>频谱滚降: {editingProfile.frequency.rolloff.avg.toFixed(0)} Hz</div>
                  <div>频谱平坦度: {editingProfile.frequency.flatness.avg.toFixed(3)}</div>
                  <div>频谱带宽: {editingProfile.frequency.bandwidth.avg.toFixed(0)} Hz</div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-yellow-400 font-medium mb-2">倒谱特征 (MFCC)</div>
                <div className="grid grid-cols-4 gap-1 text-xs">
                  {editingProfile.cepstral.mfcc.avg.map((v, i) => (
                    <div key={i} className="text-center">
                      <div className="text-gray-400">#{i+1}</div>
                      <div className="text-purple-300">{v.toFixed(1)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-orange-400 font-medium mb-2">噪声基准</div>
                <div className="text-xs text-gray-300 flex items-center gap-2">
                  <span>动态噪声基底:</span>
                  <input
                    type="number"
                    step="0.1"
                    value={editingProfile.noiseFloor}
                    onChange={(e) => setEditingProfile({
                      ...editingProfile,
                      noiseFloor: parseFloat(e.target.value) || 0
                    })}
                    className="bg-gray-700 text-orange-300 text-xs px-2 py-1 rounded w-20 border border-gray-600 focus:border-orange-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-medium hover:from-green-700 hover:to-green-800 transition-all"
              >
                保存
              </button>
              <button
                onClick={() => setShowProfileModal(false)}
                className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-600 transition-all"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
