import React, { useState, useEffect, useCallback } from 'react';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import { useHitDetection } from './hooks/useHitDetection';
import { useSoundLearning } from './hooks/useSoundLearning';
import { AudioVisualizer } from './components/AudioVisualizer';
import { StatsPanel } from './components/StatsPanel';
import { LearningPanel } from './components/LearningPanel';

function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [energyThreshold, setEnergyThreshold] = useState(80);
  const [minFrequency, setMinFrequency] = useState(50);
  const [maxFrequency, setMaxFrequency] = useState(300);
  const [minHitInterval, setMinHitInterval] = useState(250);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const [peakWindowSize, setPeakWindowSize] = useState(5);
  const [energyWeight, setEnergyWeight] = useState(0.4);
  const [timeDomainWeight, setTimeDomainWeight] = useState(0.25);
  const [stabilityWeight, setStabilityWeight] = useState(0.15);
  const [rangeWeight, setRangeWeight] = useState(0.2);
  const [useAdaptiveThreshold, setUseAdaptiveThreshold] = useState(true);
  const [showPermissionModal, setShowPermissionModal] = useState(true);

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
    updateProfile
  } = useSoundLearning();

  const {
    isListening,
    hasPermission,
    error,
    startListening,
    stopListening,
    getAudioData
  } = useAudioAnalyzer();

  const {
    result,
    isDetecting,
    isCalibrating,
    currentConfidence,
    calibrationProgress,
    startDetection,
    stopDetection,
    resetStats,
    setThreshold,
    setFrequencyRange,
    setMinHitInterval: setHitInterval,
    setConfidenceThreshold: setConfThreshold,
    setPeakWindowSize: setPWS,
    setWeights,
    startCalibration
  } = useHitDetection(getAudioData, isListening, {
    energyThreshold,
    minHitInterval,
    minFrequency,
    maxFrequency,
    useAdaptiveThreshold: useAdaptiveThreshold,
    useMultiFeature: true,
    calibrationDuration: 2000,
    confidenceThreshold,
    peakWindowSize,
    energyWeight,
    timeDomainWeight,
    stabilityWeight,
    rangeWeight,
    learnedProfile
  });

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    setThreshold(energyThreshold);
  }, [energyThreshold, setThreshold]);

  useEffect(() => {
    setFrequencyRange(minFrequency, maxFrequency);
  }, [minFrequency, maxFrequency, setFrequencyRange]);

  useEffect(() => {
    setHitInterval(minHitInterval);
  }, [minHitInterval, setHitInterval]);

  useEffect(() => {
    setConfThreshold(confidenceThreshold);
  }, [confidenceThreshold, setConfThreshold]);

  useEffect(() => {
    setPWS(peakWindowSize);
  }, [peakWindowSize, setPWS]);

  useEffect(() => {
    setWeights({ energy: energyWeight, timeDomain: timeDomainWeight, stability: stabilityWeight, range: rangeWeight });
  }, [energyWeight, timeDomainWeight, stabilityWeight, rangeWeight, setWeights]);

  const handleUseAdaptiveThresholdChange = useCallback((value: boolean) => {
    setUseAdaptiveThreshold(value);
  }, []);

  const handleStart = useCallback(async () => {
    await startListening();
    setShowPermissionModal(false);
    setIsStarted(true);
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
  }, [resetStats]);

  const handleRecalibrate = useCallback(() => {
    startCalibration();
  }, [startCalibration]);

  useEffect(() => {
    if (error) {
      alert(`错误: ${error}`);
    }
  }, [error]);

  const handleThresholdChange = useCallback((value: number) => {
    setEnergyThreshold(value);
  }, []);

  const handleMinFrequencyChange = useCallback((value: number) => {
    setMinFrequency(value);
  }, []);

  const handleMaxFrequencyChange = useCallback((value: number) => {
    setMaxFrequency(value);
  }, []);

  const handleMinHitIntervalChange = useCallback((value: number) => {
    setMinHitInterval(value);
  }, []);

  const handleConfidenceThresholdChange = useCallback((value: number) => {
    setConfidenceThreshold(value);
  }, []);

  const handlePeakWindowSizeChange = useCallback((value: number) => {
    setPeakWindowSize(value);
  }, []);

  const handleEnergyWeightChange = useCallback((value: number) => {
    setEnergyWeight(value);
  }, []);

  const handleTimeDomainWeightChange = useCallback((value: number) => {
    setTimeDomainWeight(value);
  }, []);

  const handleStabilityWeightChange = useCallback((value: number) => {
    setStabilityWeight(value);
  }, []);

  const handleRangeWeightChange = useCallback((value: number) => {
    setRangeWeight(value);
  }, []);

  const handleStartLearning = useCallback((count: number) => {
    startLearning(getAudioData, count);
  }, [startLearning, getAudioData]);

  const handleSaveProfile = useCallback(() => {
    if (saveProfile()) {
      alert('学习结果已保存！');
    } else {
      alert('保存失败');
    }
  }, [saveProfile]);

  const handleClearProfile = useCallback(() => {
    if (confirm('确定要清除学习结果吗？')) {
      clearProfile();
    }
  }, [clearProfile]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            🏀 篮球拍球计数器
          </h1>
          <p className="text-gray-400 text-sm md:text-base">
            实时识别并统计您的篮球拍球次数
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
                    请保持安静，正在检测环境噪音...
                  </p>
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

                {isDetecting && (
                  <button
                    onClick={handleRecalibrate}
                    className="bg-gradient-to-r from-yellow-600 to-yellow-700 text-white px-4 py-3 rounded-lg font-semibold hover:from-yellow-700 hover:to-yellow-800 transition-all shadow-lg"
                  >
                    🎯 重新校准
                  </button>
                )}

                <button
                  onClick={handleReset}
                  disabled={!isStarted || result.hitCount === 0}
                  className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-gray-700 hover:to-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔄 重置
                </button>
              </div>

              {result.noiseLevel > 0 && (
                <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">环境噪音</span>
                    <span className="text-gray-300">{result.noiseLevel}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-400">自适应阈值</span>
                    <span className="text-green-400">{result.adaptiveThreshold}</span>
                  </div>
                </div>
              )}

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
              energyThreshold={energyThreshold}
              onThresholdChange={handleThresholdChange}
              minFrequency={minFrequency}
              maxFrequency={maxFrequency}
              onMinFrequencyChange={handleMinFrequencyChange}
              onMaxFrequencyChange={handleMaxFrequencyChange}
              currentConfidence={currentConfidence}
              minHitInterval={minHitInterval}
              onMinHitIntervalChange={handleMinHitIntervalChange}
              confidenceThreshold={confidenceThreshold}
              onConfidenceThresholdChange={handleConfidenceThresholdChange}
              peakWindowSize={peakWindowSize}
              onPeakWindowSizeChange={handlePeakWindowSizeChange}
              energyWeight={energyWeight}
              timeDomainWeight={timeDomainWeight}
              stabilityWeight={stabilityWeight}
              rangeWeight={rangeWeight}
              onEnergyWeightChange={handleEnergyWeightChange}
              onTimeDomainWeightChange={handleTimeDomainWeightChange}
              onStabilityWeightChange={handleStabilityWeightChange}
              onRangeWeightChange={handleRangeWeightChange}
              useAdaptiveThreshold={useAdaptiveThreshold}
              onUseAdaptiveThresholdChange={handleUseAdaptiveThresholdChange}
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
              isActive={isDetecting}
            />
          </div>
        </div>

        <footer className="mt-12 text-center">
          <p className="text-gray-500 text-xs">
            使用 Web Audio API 和 Canvas 实现实时音频分析 | 多特征融合 + 自适应阈值
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
