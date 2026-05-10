import React, { useState, useEffect } from 'react';
import { LearnedSoundProfile, SoundSample } from '../hooks/useSoundLearning';

interface LearningPanelProps {
  isRecording: boolean;
  recordingProgress: number;
  samples: SoundSample[];
  learnedProfile: LearnedSoundProfile | null;
  onStartLearning: (count: number) => void;
  onStopLearning: () => void;
  onSaveProfile: () => void;
  onClearProfile: () => void;
  onDeleteSample: (index: number) => void;
  onUpdateProfile: (profile: LearnedSoundProfile) => void;
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
  isActive
}) => {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<LearnedSoundProfile | null>(null);

  useEffect(() => {
    if (learnedProfile) {
      setEditingProfile({ ...learnedProfile });
    }
  }, [learnedProfile]);

  const handleStartLearning = (count: number) => {
    onStartLearning(count);
  };

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

  const handleWeightChange = (
    key: keyof LearnedSoundProfile['confidenceWeight'],
    value: number
  ) => {
    if (editingProfile) {
      setEditingProfile({
        ...editingProfile,
        confidenceWeight: {
          ...editingProfile.confidenceWeight,
          [key]: value
        }
      });
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-lg">🎓 声音学习</h3>
        {learnedProfile && (
          <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">
            已学习 {learnedProfile.sampleCount} 个样本
          </span>
        )}
      </div>

      {!isRecording && samples.length === 0 && !learnedProfile && (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            通过录制您的篮球拍球声音，学习其特征参数，提高检测准确度。
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleStartLearning(3)}
              disabled={!isActive}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              录 3 次
            </button>
            <button
              onClick={() => handleStartLearning(5)}
              disabled={!isActive}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              录 5 次
            </button>
            <button
              onClick={() => handleStartLearning(10)}
              disabled={!isActive}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              录 10 次
            </button>
          </div>
          <p className="text-gray-500 text-xs text-center">
            请在安静的室内录制，拍球时力度适中
          </p>
        </div>
      )}

      {isRecording && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-2 animate-pulse">🎙️</div>
            <p className="text-yellow-400 font-medium">正在录制...</p>
            <p className="text-gray-400 text-sm">请拍 {recordingProgress * 10 | 0}/{samples.length || 3} 次</p>
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
                  <span className="text-cyan-300 text-xs">{sample.dominantFrequency.toFixed(0)} Hz</span>
                  <span className="text-purple-300 text-xs">能量 {sample.energy.toFixed(1)}</span>
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
              className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-2 rounded-lg font-medium hover:from-gray-700 hover:to-gray-800 transition-all"
            >
              清除
            </button>
          </div>
        </div>
      )}

      {learnedProfile && !isRecording && (
        <div className="space-y-4">
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
            <div className="text-xs text-gray-400 mb-2">学习结果</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">样本数</span>
                <span className="text-gray-300">{learnedProfile.sampleCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">更新时间</span>
                <span className="text-gray-300">{formatDate(learnedProfile.updatedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">频率范围</span>
                <span className="text-cyan-300">{learnedProfile.frequencyRange.min.toFixed(0)}-{learnedProfile.frequencyRange.max.toFixed(0)} Hz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">平均频率</span>
                <span className="text-cyan-300">{learnedProfile.frequencyRange.avg.toFixed(0)} Hz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">能量范围</span>
                <span className="text-orange-300">{learnedProfile.energyRange.min.toFixed(1)}-{learnedProfile.energyRange.max.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">能量标准差</span>
                <span className="text-orange-300">{learnedProfile.energyRange.stdDev.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">频谱质心</span>
                <span className="text-green-300">{learnedProfile.spectralCentroidRange.avg.toFixed(0)} Hz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">过零率</span>
                <span className="text-red-300">{learnedProfile.zeroCrossingRateRange.avg.toFixed(4)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleStartLearning(3)}
              disabled={!isActive}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              重新学习
            </button>
            <button
              onClick={handleOpenEdit}
              className="bg-gradient-to-r from-yellow-600 to-yellow-700 text-white px-4 py-2 rounded-lg font-medium hover:from-yellow-700 hover:to-yellow-800 transition-all"
            >
              编辑
            </button>
            <button
              onClick={onClearProfile}
              className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-lg font-medium hover:from-red-700 hover:to-red-800 transition-all"
            >
              清除
            </button>
          </div>
        </div>
      )}

      {showProfileModal && editingProfile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-white font-bold text-lg mb-4">编辑特征权重</h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-orange-400">能量权重</span>
                  <span className="text-gray-300">{(editingProfile.confidenceWeight.energy * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editingProfile.confidenceWeight.energy * 100}
                  onChange={(e) => handleWeightChange('energy', Number(e.target.value) / 100)}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-cyan-400">频率权重</span>
                  <span className="text-gray-300">{(editingProfile.confidenceWeight.frequency * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editingProfile.confidenceWeight.frequency * 100}
                  onChange={(e) => handleWeightChange('frequency', Number(e.target.value) / 100)}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-400">频谱质心权重</span>
                  <span className="text-gray-300">{(editingProfile.confidenceWeight.spectralCentroid * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editingProfile.confidenceWeight.spectralCentroid * 100}
                  onChange={(e) => handleWeightChange('spectralCentroid', Number(e.target.value) / 100)}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-red-400">过零率权重</span>
                  <span className="text-gray-300">{(editingProfile.confidenceWeight.zeroCrossingRate * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editingProfile.confidenceWeight.zeroCrossingRate * 100}
                  onChange={(e) => handleWeightChange('zeroCrossingRate', Number(e.target.value) / 100)}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-yellow-400">上升时间权重</span>
                  <span className="text-gray-300">{(editingProfile.confidenceWeight.riseTime * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editingProfile.confidenceWeight.riseTime * 100}
                  onChange={(e) => handleWeightChange('riseTime', Number(e.target.value) / 100)}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-pink-400">时域能量权重</span>
                  <span className="text-gray-300">{(editingProfile.confidenceWeight.timeDomain * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editingProfile.confidenceWeight.timeDomain * 100}
                  onChange={(e) => handleWeightChange('timeDomain', Number(e.target.value) / 100)}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="text-xs text-gray-500 text-center pt-2">
                总权重: {(
                  editingProfile.confidenceWeight.energy +
                  editingProfile.confidenceWeight.frequency +
                  editingProfile.confidenceWeight.spectralCentroid +
                  editingProfile.confidenceWeight.zeroCrossingRate +
                  editingProfile.confidenceWeight.riseTime +
                  editingProfile.confidenceWeight.timeDomain
                ).toFixed(2)}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowProfileModal(false)}
                className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-600 transition-all"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-medium hover:from-green-700 hover:to-green-800 transition-all"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
