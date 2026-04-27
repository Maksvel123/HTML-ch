'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, Loader2, X, Activity, LayoutTemplate } from 'lucide-react';

export default function Dashboard() {
  const [htmlCode, setHtmlCode] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errors, setErrors] = useState([]);
  const [selectedError, setSelectedError] = useState(null);

  const analyzeCode = async () => {
    if (!htmlCode) return;
    setIsAnalyzing(true);
    setSelectedError(null);
    setErrors([]);
    
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlCode })
      });
      const data = await res.json();
      if (data.results) {
        setErrors(data.results);
      } else {
        alert("Ошибка сервера: " + (data.error || "Неизвестная ошибка"));
      }
    } catch (error) {
      alert("Не удалось связаться с сервером.");
    }
    setIsAnalyzing(false);
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-orange-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-800 overflow-hidden">
      
      {/* ЛЕВАЯ ПАНЕЛЬ (Меню) */}
      <div className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 space-y-6 shrink-0">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">A</div>
        <LayoutTemplate className="text-slate-400 w-6 h-6 hover:text-indigo-600 cursor-pointer" />
        <Activity className="text-indigo-600 w-6 h-6 cursor-pointer" />
      </div>

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Email Template Health</h1>
          <p className="text-slate-500 text-sm">Вставьте HTML код для проверки на спам-триггеры и ошибки верстки (AI Powered).</p>
        </div>

        {/* Блок ввода кода */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
          <textarea 
            value={htmlCode}
            onChange={(e) => setHtmlCode(e.target.value)}
            placeholder="Вставьте HTML код шаблона сюда..."
            className="w-full h-40 p-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm resize-none"
          />
          <button 
            onClick={analyzeCode}
            disabled={isAnalyzing || !htmlCode}
            className="self-end bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isAnalyzing ? 'Анализ...' : 'Проверить шаблон'}
          </button>
        </div>

        {/* Список ошибок */}
        {errors.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-medium">Found Issues ({errors.length})</h2>
            </div>
            
            <div className="divide-y divide-slate-100">
              {errors.map((error, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setSelectedError(error)}
                  className={`px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors ${selectedError === error ? 'bg-orange-50/50' : ''}`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${getSeverityColor(error.severity)}`} />
                  <span className="flex-1 font-medium text-slate-700">{error.title}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ВЫЕЗЖАЮЩАЯ ПАНЕЛЬ СПРАВА */}
      <div className={`w-[400px] bg-white border-l border-slate-200 shadow-2xl transform transition-transform duration-300 ease-in-out shrink-0 ${selectedError ? 'translate-x-0' : 'translate-x-full'} hidden md:flex flex-col fixed right-0 top-0 bottom-0 z-50`}>
        {selectedError && (
          <>
            <div className="p-6 border-b border-slate-100 bg-[#FFFDF7]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                  How to fix
                </div>
                <button onClick={() => setSelectedError(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <h3 className="text-xl font-semibold text-slate-800 mb-3">{selectedError.title}</h3>
              
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200`}>
                <div className={`w-1.5 h-1.5 rounded-full ${getSeverityColor(selectedError.severity)}`} />
                {selectedError.severity} severity
              </span>
            </div>

            <div className="p-6 overflow-y-auto">
              <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                {selectedError.details}
              </p>

              <h4 className="text-sm font-semibold text-slate-800 mb-4">Follow these steps to resolve this issue:</h4>
              
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 text-sm text-slate-700 space-y-2">
                {selectedError.fix.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>

              <div className="mt-6 bg-[#F6FDF9] border border-[#E2F5EA] rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 font-medium mb-1 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  After fixing
                </div>
                <p className="text-xs text-green-600/80">
                  Внесите изменения в код и запустите проверку заново, чтобы убедиться, что проблема решена.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
