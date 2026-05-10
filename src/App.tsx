import React, { useState, useEffect, useCallback } from 'react';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import { useHitDetection } from './hooks/useHitDetection';
import { AudioVisualizer } from './components/AudioVisualizer';
import { StatsPanel } from './components/StatsPanel';

function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [energyThreshold, setEnergyThreshold] = useState(80);
  const [showPermissionModal, setShowPermissionModal] = useState(true);

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
    startDetection,
    stopDetection,
    resetStats,
    setThreshold
  } = useHitDetection(getAudioData, isListening, {
    energyThreshold,
    minHitInterval: 250
  });

  useEffect(() => {
    setThreshold(energyThreshold);
  }, [energyThreshold, setThreshold]);

  const handleStart = useCallback(async () => {
    await startListening();
    setShowPermissionModal(false);
    setIsStarted(true);
    setTimeout(() => {
      startDetection();
    }, 500);
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

  useEffect(() => {
    if (error) {
      alert(`错误: ${error}`);
    }
  }, [error]);

  const handleThresholdChange = useCallback((value: number) => {
    setEnergyThreshold(value);
  }, []);

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
              isActive={isDetecting}
              dribbleCount={result.hitCount}
            />

            <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-lg">控制面板</h3>
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

              <div className="flex flex-wrap gap-3">
                {!isDetecting ? (
                  <button
                    onClick={handleStart}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all transform hover:scale-105 shadow-lg"
                  >
                    ▶ 开始检测
                  </button>
                ) : (
                  <button
                    onClick={handleStop}
                    className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105 shadow-lg"
                  >
                    ⏹ 停止检测
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
            />
          </div>
        </div>

        <footer className="mt-12 text-center">
          <p className="text-gray-500 text-xs">
            使用 Web Audio API 和 Canvas 实现实时音频分析
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
