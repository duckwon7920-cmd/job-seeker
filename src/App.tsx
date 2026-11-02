import React, { useState, useEffect } from 'react';
import {
  ResumeData,
  JobDiagnosisResult,
  TrendAnalysisResult,
} from './types';
import {
  loadResume,
  saveResume,
  loadDiagnoses,
  saveDiagnosis,
  deleteDiagnosis,
  loadTrends,
  saveTrend,
  deleteTrend,
  isResumeEmpty,
} from './utils/storage';
import { ResumeTab } from './components/ResumeTab';
import { RecommendTab } from './components/RecommendTab';
import { DiagnoseTab } from './components/DiagnoseTab';
import { TrendsTab } from './components/TrendsTab';
import { CompareTab } from './components/CompareTab';
import {
  UserCheck,
  Search,
  FileCheck2,
  Newspaper,
  BarChart3,
  Factory,
  Cpu,
  Settings,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'resume' | 'recommend' | 'diagnose' | 'trends' | 'compare'>('resume');

  // Stored state
  const [resume, setResume] = useState<ResumeData>(() => loadResume());
  const [diagnoses, setDiagnoses] = useState<JobDiagnosisResult[]>(() => loadDiagnoses());
  const [trends, setTrends] = useState<TrendAnalysisResult[]>(() => loadTrends());

  // Handoff state from RecommendTab to DiagnoseTab
  const [initialJobForDiagnosis, setInitialJobForDiagnosis] = useState<{
    company: string;
    role: string;
    sourceUrl: string;
  } | null>(null);

  // Resume save handler
  const handleSaveResume = (updated: ResumeData) => {
    setResume(updated);
    saveResume(updated);
  };

  // Diagnosis save handler
  const handleSaveDiagnosis = (diagnosis: JobDiagnosisResult) => {
    const updated = saveDiagnosis(diagnosis);
    setDiagnoses(updated);
  };

  // Diagnosis delete handler
  const handleDeleteDiagnosis = (id: string) => {
    const updated = deleteDiagnosis(id);
    setDiagnoses(updated);
  };

  // Trend save handler
  const handleSaveTrend = (trend: TrendAnalysisResult) => {
    const updated = saveTrend(trend);
    setTrends(updated);
  };

  // Trend delete handler
  const handleDeleteTrend = (id: string) => {
    const updated = deleteTrend(id);
    setTrends(updated);
  };

  // Handoff handler when clicking '진단하기' in RecommendTab
  const handleSelectJobForDiagnosis = (job: { company: string; role: string; sourceUrl: string }) => {
    setInitialJobForDiagnosis(job);
    setActiveTab('diagnose');
  };

  const hasResume = !isResumeEmpty(resume);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Application Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  공고 진단기
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                  제조 취업 특화
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                품질관리 · 스마트팩토리 · 생산기술 직무 맞춤 채용공고 분석 및 갭 진단
              </p>
            </div>
          </div>

          {/* Quick Status Badges */}
          <div className="flex items-center gap-2 text-xs">
            <div
              className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 ${
                hasResume
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${hasResume ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>{hasResume ? `이력 등록됨 (${resume.desiredRole || '제조'})` : '이력 미등록'}</span>
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-medium">
              진단 공고: <strong>{diagnoses.length}</strong>개
            </div>
          </div>
        </div>

        {/* 5-Tab Navigation Bar */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar pt-1">
            <button
              type="button"
              onClick={() => setActiveTab('resume')}
              className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === 'resume'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>내 이력</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('recommend')}
              className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === 'recommend'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Search className="w-4 h-4 shrink-0" />
              <span>공고 추천</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('diagnose')}
              className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === 'diagnose'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <FileCheck2 className="w-4 h-4 shrink-0" />
              <span>공고 진단</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('trends')}
              className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === 'trends'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Newspaper className="w-4 h-4 shrink-0" />
              <span>산업 동향</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('compare')}
              className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors relative ${
                activeTab === 'compare'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>공고 비교</span>
              {diagnoses.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-700 font-extrabold">
                  {diagnoses.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'resume' && (
          <ResumeTab
            resume={resume}
            onSaveResume={handleSaveResume}
            onNavigateToTab={(tab) => setActiveTab(tab as any)}
          />
        )}

        {activeTab === 'recommend' && (
          <RecommendTab
            resume={resume}
            onNavigateToTab={(tab) => setActiveTab(tab as any)}
            onSelectJobForDiagnosis={handleSelectJobForDiagnosis}
          />
        )}

        {activeTab === 'diagnose' && (
          <DiagnoseTab
            resume={resume}
            initialJobData={initialJobForDiagnosis}
            onSaveDiagnosis={handleSaveDiagnosis}
            onNavigateToTab={(tab) => setActiveTab(tab as any)}
          />
        )}

        {activeTab === 'trends' && (
          <TrendsTab
            resume={resume}
            savedTrends={trends}
            onSaveTrend={handleSaveTrend}
            onDeleteTrend={handleDeleteTrend}
          />
        )}

        {activeTab === 'compare' && (
          <CompareTab
            diagnoses={diagnoses}
            onDeleteDiagnosis={handleDeleteDiagnosis}
            onNavigateToTab={(tab) => setActiveTab(tab as any)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-center text-xs text-slate-600">
        <div className="max-w-6xl mx-auto px-4 space-y-1">
          <p className="font-semibold text-slate-700">공고 진단기 · 제조 직무(품질관리 / 스마트팩토리 / 생산기술) 취업준비 지원 도구</p>
          <p className="text-slate-600">
            개인정보는 외부 서버에 보관되지 않으며 브라우저에만 저장됩니다. 추천 및 진단 결과는 실제 원문 공고를 반드시 확인하시기 바랍니다.
          </p>
        </div>
      </footer>
    </div>
  );
}
