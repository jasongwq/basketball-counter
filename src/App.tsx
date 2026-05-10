import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import { useHitDetection, DetectionDebugInfo } from './hooks/useHitDetection';
import { useSoundLearning, LearnedSoundProfile } from './hooks/useSoundLearning';
import { AudioVisualizer } from './components/AudioVisualizer';
import { StatsPanel } from './components/StatsPanel';
import { LearningPanel } from './components/LearningPanel';
import { DetectionDebugPanel } from './components/DetectionDebugPanel';

const BUILD_VERSION = '1.0.0';
const BUILD_TIME = '2026-05-10';

function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const [confidenceHistory, setConfidenceHistory] = useState<number[]>([]);
  const [profileLoadStatus, setProfileLoadStatus] = useState<'loading' | 'loaded' | 'none'>('loading');
  
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
    resetStats,
    debugInfo
  } = useHitDetection(getAudioData, isListening, {
    learnedProfile,
    minHitInterval: 250,
    confidenceThreshold
  });

  useEffect(() => {
    const loaded = loadProfile();
    if (loaded) {
      setProfileLoadStatus('loaded');
    } else {
      setProfileLoadStatus('none');
    }
  }, []);

  useEffect(() => {
    if (error) {
      alert(`错误: ${error}`);
    }
  }, [error]);

  useEffect(() => {
    confidenceHistoryRef.current.push(currentConfidence);
    if (confidenceHistoryRef.current.length > 200) {
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
      setProfileLoadStatus('loaded');
      alert('学习结果已保存！检测将使用学习到的参数。');
    } else {
      alert('保存失败');
    }
  }, [saveProfile]);

  const handleClearProfile = useCallback(() => {
    if (confirm('确定要清除学习结果吗？')) {
      clearProfile();
      setProfileLoadStatus('none');
    }
  }, [clearProfile]);

  const handleExportProfile = useCallback(() => {
    if (learnedProfile) {
      exportProfile();
    }
  }, [learnedProfile, exportProfile]);

  const handleImportProfile = useCallback(() => {
    importProfile();
    setTimeout(() => {
      const loaded = loadProfile();
      if (loaded) {
        setProfileLoadStatus('loaded');
      }
    }, 100);
  }, [importProfile, loadProfile]);

  const handleConfidenceChange = useCallback((value: number) => {
    setConfidenceThreshold(value);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <header className="flex items-center justify-between px-6 py-3 bg-gray-900/50 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white">
          🏀 篮球拍球计数器
        </h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {profileLoadStatus === 'loaded' && (
              <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">
                ✓ 已加载学习配置
              </span>
            )}
            {profileLoadStatus === 'none' && (
              <span className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded">
                ⚠ 请先学习
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            v{BUILD_VERSION} · {BUILD_TIME}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <AudioVisualizer
              audioData={getAudioData()}
              isActive={isDetecting || isCalibrating}
              dribbleCount={result.hitCount}
            />

            <DetectionDebugPanel debugInfo={debugInfo} isActive={isDetecting} />

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
                    className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>低 (易检测)</span>
                    <span>高 (严格)</span>
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-gray-400">实时置信度</span>
                    <span className={`text-lg font-bold ${
                      currentConfidence >= confidenceThreshold ? 'text-green-400' : 'text-gray-400'
                    }`}>
                      {(currentConfidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-24 relative bg-gray-900/50 rounded-lg overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="confidenceGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3"/>
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05"/>
                        </linearGradient>
                      </defs>
                      {confidenceHistory.length > 1 && (
                        <>
                          <polygon
                            fill="url(#confidenceGradient)"
                            points={confidenceHistory.map((v, i) => {
                              const x = (i / Math.max(confidenceHistory.length - 1, 1)) * 200;
                              const y = 100 - v * 100;
                              return `${x},${y}`;
                            }).join(' ') + `,200,100,0,100`}
                          />
                          <polyline
                            fill="none"
                            stroke="#06b6d4"
                            strokeWidth="2"
                            points={confidenceHistory.map((v, i) => {
                              const x = (i / Math.max(confidenceHistory.length - 1, 1)) * 200;
                              const y = 100 - v * 100;
                              return `${x},${y}`;
                            }).join(' ')}
                          />
                        </>
                      )}
                      <line 
                        x1="0" 
                        y1={100 - confidenceThreshold * 100} 
                        x2="200" 
                        y2={100 - confidenceThreshold * 100}
                        stroke="#ef4444" 
                        strokeWidth="1.5" 
                        strokeDasharray="4,4"
                      />
                      <text 
                        x="195" 
                        y={95 - confidenceThreshold * 100} 
                        fill="#ef4444" 
                        fontSize="8" 
                        textAnchor="end"
                      >
                        {(confidenceThreshold * 100).toFixed(0)}%
                      </text>
                    </svg>
                  </div>
                </div>

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
