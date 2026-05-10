import React, { useState, useEffect, useRef } from 'react';

export interface LogEntry {
  id: number;
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: string;
}

let logIdCounter = 0;

// 全局日志收集器
const logListeners: Set<(entry: LogEntry) => void> = new Set();

function addLogEntry(type: LogEntry['type'], args: unknown[]) {
  const message = args
    .map(arg => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');

  const entry: LogEntry = {
    id: ++logIdCounter,
    type,
    message,
    timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
  };

  logListeners.forEach(listener => listener(entry));
}

// 拦截 console 方法
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
};

console.log = (...args: unknown[]) => {
  originalConsole.log(...args);
  addLogEntry('log', args);
};

console.warn = (...args: unknown[]) => {
  originalConsole.warn(...args);
  addLogEntry('warn', args);
};

console.error = (...args: unknown[]) => {
  originalConsole.error(...args);
  addLogEntry('error', args);
};

console.info = (...args: unknown[]) => {
  originalConsole.info(...args);
  addLogEntry('info', args);
};

export function useConsoleLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const maxLogs = 200;

  useEffect(() => {
    const listener = (entry: LogEntry) => {
      setLogs(prev => {
        const next = [...prev, entry];
        return next.length > maxLogs ? next.slice(-maxLogs) : next;
      });
    };
    logListeners.add(listener);
    return () => { logListeners.delete(listener); };
  }, []);

  const clearLogs = () => setLogs([]);

  return { logs, clearLogs };
}

interface ConsolePanelProps {
  logs: LogEntry[];
  onClear: () => void;
  onClose: () => void;
}

export function ConsolePanel({ logs, onClear, onClose }: ConsolePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<'all' | 'log' | 'warn' | 'error'>('all');

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.type === filter);

  const typeColor: Record<string, string> = {
    log: 'text-gray-300',
    warn: 'text-yellow-400',
    error: 'text-red-400',
    info: 'text-cyan-400',
  };

  const typeBg: Record<string, string> = {
    log: 'bg-gray-700',
    warn: 'bg-yellow-900/50',
    error: 'bg-red-900/50',
    info: 'bg-cyan-900/50',
  };

  return (
    <div className="fixed bottom-0 right-0 z-50 flex flex-col bg-gray-950 border border-gray-700 rounded-tl-lg shadow-2xl"
         style={{ width: '480px', height: '320px' }}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700 rounded-tl-lg shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400">📋 控制台</span>
          <span className="text-xs text-gray-600">({filteredLogs.length})</span>
        </div>
        <div className="flex items-center gap-1">
          {/* 过滤按钮 */}
          {(['all', 'log', 'warn', 'error'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-1.5 py-0.5 text-xs rounded ${
                filter === f ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f === 'all' ? '全部' : f}
            </button>
          ))}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-1.5 py-0.5 text-xs rounded ${autoScroll ? 'bg-blue-900/50 text-blue-400' : 'text-gray-500'}`}
            title="自动滚动"
          >
            ↓
          </button>
          <button
            onClick={onClear}
            className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-gray-300 rounded"
          >
            清空
          </button>
          <button
            onClick={onClose}
            className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-red-400 rounded"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 日志内容 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden font-mono text-xs p-1 space-y-0">
        {filteredLogs.length === 0 && (
          <div className="text-gray-600 text-center py-4">暂无日志</div>
        )}
        {filteredLogs.map(entry => (
          <div
            key={entry.id}
            className={`flex items-start px-2 py-0.5 hover:bg-gray-800/50 ${typeBg[entry.type] || ''}`}
          >
            <span className="text-gray-600 shrink-0 mr-2 select-none">{entry.timestamp}</span>
            <span className={`shrink-0 mr-2 w-10 text-center font-bold ${typeColor[entry.type]}`}>
              {entry.type === 'warn' ? '⚠' : entry.type === 'error' ? '✕' : entry.type === 'info' ? 'ℹ' : '·'}
            </span>
            <span className={`break-all ${typeColor[entry.type]}`}>{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
