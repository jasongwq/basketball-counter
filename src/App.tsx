import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import { useHitDetection } from './hooks/useHitDetection';
import { useSoundLearning, LearnedSoundProfile } from './hooks/useSoundLearning';
import { AudioVisualizer } from './components/AudioVisualizer';
import { StatsPanel } from './components/StatsPanel';
import { LearningPanel } from './components/LearningPanel';

function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const [confidenceHistory, setConfidenceHistory] = useState<number[]>([]);
  
  const confidenceHistoryRef = useRef<number[]>([]);

  const {
    isListening,
    hasPermission,
    error,
    startListening,
    stopListening,
    getAudioData
  } = useAudioAnalyzer();

  const {
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
  } = useSoundLearning();

  const {
    result,
    isDetecting,
    isCalibrating,
    currentConfidence,
    calibrationProgress,
    startDetection,
    stopDetection,
    resetStats
  } = useHitDetection(getAudioData, isListening, {
    learnedProfile,
    minHitInterval: 250,
    confidenceThreshold
  });

  useEffect(() => {
    const loaded = loadProfile();
    if (loaded) {
      console.log('学习配置已加载:', loaded.sampleCount, '个样本');
    }
  }, []);

  useEffect(() => {
    if (error) {
      alert(`错误: ${error}`);
    }
  }, [error]);

  useEffect(() => {
    confidenceHistoryRef.current.push(currentConfidence);
    if (confidenceHistoryRef.current.length > 100) {
      confidenceHistoryRef.current.shift();
    }
    setConfidenceHistory([...confidenceHistoryRef.current]);
  }, [currentConfidence]);

  const handleStart = useCallback(async () => {
    await startListening();
    setShowPermissionModal(false);
    setIsStarted(true);
    confidenceHistoryRef.current = [];
    setConfidenceHistory([]);
    startDetection();
  }, [startListening, startDetection]);

  const handleStop = useCallback(() => {
    stopDetection();
    stopListening();
    setIsStarted(false);
    setShowPermissionModal(true);
  }, [stopDetection, stopListening]);

  const handleReset = useCallback(() => {
    resetStats();
    confidenceHistoryRef.current = [];
    setConfidenceHistory([]);
  }, [resetStats]);

  const handleStartLearning = useCallback((count: number) => {
    startLearning(getAudioData, count);
  }, [startLearning, getAudioData]);

  const handleSaveProfile = useCallback(() => {
    if (saveProfile()) {
      alert('学习结果已保存！检测将使用学习到的参数。');
    } else {
      alert('保存失败');
    }
  }, [saveProfile]);

  const handleClearProfile = useCallback(() => {
    if (confirm('确定要清除学习结果吗？')) {
      clearProfile();
    }
  }, [clearProfile]);

  const handleExportProfile = useCallback(() => {
    if (learnedProfile) {
      exportProfile();
    }
  }, [learnedProfile, exportProfile]);

  const handleImportProfile = useCallback(() => {
    importProfile();
  }, [importProfile]);

  const handleConfidenceChange = useCallback((value: number) => {
    setConfidenceThreshold(value);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            🏀 篮球拍球计数器
          </h1>
          <p className="text-gray-400 text-sm md:text-base">
            基于机器学习的声音识别
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <AudioVisualizer
              audioData={getAudioData()}
              isActive={isDetecting || isCalibrating}
              dribbleCount={result.hitCount}
            />

            <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-lg">控制面板</h3>
                <div className="flex items-center space-x-4">
                  {isCalibrating && (
                    <div className="flex items-center space-x-2 text-yellow-400">
                      <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
                      <span className="text-sm">校准中 {Math.round(calibrationProgress * 100)}%</span>
                    </div>
                  )}
                  <div className={`flex items-center space-x-2 ${
                    isDetecting ? 'text-green-400' : 'text-gray-500'
                  }`}>
                    <div className={`w-3 h-3 rounded-full ${
                      isDetecting ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                    }`} />
                    <span className="text-sm">
                      {isDetecting ? '检测中' : '已停止'}
                    </span>
                  </div>
                </div>
              </div>

              {isCalibrating && (
                <div className="mb-4">
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-yellow-400 h-2 rounded-full transition-all duration-100"
                      style={{ width: `${calibrationProgress * 100}%` }}
                    />
                  </div>
                  <p className="text-yellow-400 text-xs mt-2 text-center">
                    正在检测环境噪音基准...
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm text-gray-400">置信度阈值</label>
                    <span className="text-lg font-bold text-cyan-400">
                      {(confidenceThreshold * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={confidenceThreshold * 100}
                    onChange={(e) => handleConfidenceChange(Number(e.target.value) / 100)}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>低 (易检测)</span>
                    <span>高 (严格)</span>
                  </div>
                </div>

                {confidenceHistory.length > 0 && (
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-400">置信度曲线</span>
                      <span className={`text-sm font-medium ${
                        currentConfidence >= confidenceThreshold ? 'text-green-400' : 'text-gray-500'
                      }`}>
                        {(currentConfidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-16 relative">
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <line x1="0" y1={100 - confidenceThreshold * 100} x2="100" y2={100 - confidenceThreshold * 100} 
                              stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
                        {confidenceHistory.length > 1 && (
                          <polyline
                            fill="none"
                            stroke="#06b6d4"
                            strokeWidth="1"
                            points={confidenceHistory.map((v, i) => {
                              const x = (i / (confidenceHistory.length - 1)) * 100;
                              const y = 100 - v * 100;
                              return `${x},${y}`;
                            }).join(' ')}
                          />
                        )}
                      </svg>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {!isDetecting && !isCalibrating ? (
                    <button
                      onClick={handleStart}
                      className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all transform hover:scale-105 shadow-lg"
                    >
                      ▶ 开始检测
                    </button>
                  ) : isDetecting ? (
                    <button
                      onClick={handleStop}
                      className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105 shadow-lg"
                    >
                      ⏹ 停止检测
                    </button>
                  ) : null}

                  <button
                    onClick={handleReset}
                    disabled={!isStarted || result.hitCount === 0}
                    className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-gray-700 hover:to-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🔄 重置
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <StatsPanel
              result={result}
              isActive={isDetecting}
              currentConfidence={currentConfidence}
              confidenceThreshold={confidenceThreshold}
            />
            <LearningPanel
              isRecording={isRecording}
              recordingProgress={recordingProgress}
              samples={samples}
              learnedProfile={learnedProfile}
              onStartLearning={handleStartLearning}
              onStopLearning={stopLearning}
              onSaveProfile={handleSaveProfile}
              onClearProfile={handleClearProfile}
              onDeleteSample={deleteSample}
              onUpdateProfile={updateProfile}
              onExportProfile={handleExportProfile}
              onImportProfile={handleImportProfile}
              isActive={isDetecting}
            />
          </div>
        </div>

        <footer className="mt-12 text-center">
          <p className="text-gray-500 text-xs">
            录制您的篮球拍球声音，学习特征参数，提高识别准确度
          </p>
        </footer>
      </div>

      {showPermissionModal && !hasPermission && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-2xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🎤</div>
              <h2 className="text-2xl font-bold text-white mb-2">
                需要麦克风权限
              </h2>
              <p className="text-gray-400 text-sm">
                为了检测篮球拍球声音，请允许访问您的麦克风。
              </p>
            </div>

            <button
              onClick={handleStart}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-4 rounded-xl font-semibold hover:from-orange-600 hover:to-orange-700 transition-all transform hover:scale-105 shadow-lg"
            >
              授权并开始
            </button>

            <p className="text-gray-500 text-xs text-center mt-4">
              您的麦克风音频仅在本地处理，不会上传到任何服务器。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
