import React, { useState } from 'react';
import { ResumeData, RecommendedJob, ZeroResultFallback } from '../types';
import { isResumeEmpty, copyTextToClipboard } from '../utils/storage';
import {
  Search,
  ExternalLink,
  Calendar,
  MapPin,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
  Copy,
  Info,
  Sparkles,
  AlertOctagon,
  Compass,
  Tag,
  RotateCcw,
} from 'lucide-react';

interface RecommendTabProps {
  resume: ResumeData;
  onNavigateToTab: (tab: string) => void;
  onSelectJobForDiagnosis: (job: { company: string; role: string; sourceUrl: string }) => void;
}

export const RecommendTab: React.FC<RecommendTabProps> = ({
  resume,
  onNavigateToTab,
  onSelectJobForDiagnosis,
}) => {
  const [filterRole, setFilterRole] = useState(resume.desiredRole || '품질관리');
  const [filterLocation, setFilterLocation] = useState(resume.desiredLocation || '전국');
  const [filterType, setFilterType] = useState<string>('전체');

  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendedJob[]>([]);
  const [queriesUsed, setQueriesUsed] = useState<string[]>([]);
  const [fallbackData, setFallbackData] = useState<ZeroResultFallback | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isServerError, setIsServerError] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const emptyResume = isResumeEmpty(resume);

  // Search jobs using 2-stage Gemini + Google Search Grounding
  const handleSearchJobs = async () => {
    if (emptyResume) {
      setErrorMessage('내 이력이 비어 있습니다. [내 이력] 탭에서 이력을 먼저 작성해 주세요.');
      setIsServerError(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setIsServerError(false);
    setHasSearched(true);
    setFallbackData(null);

    try {
      const response = await fetch('/api/jobs/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume,
          filterRole,
          filterLocation,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        setIsServerError(true);
        throw new Error(resData.error || '공고 추천 서버 처리 중 오류가 발생했습니다.');
      }

      setQueriesUsed(resData.queriesUsed || []);
      setRecommendations(resData.jobs || []);
      if (resData.fallback) {
        setFallbackData(resData.fallback);
      }
    } catch (err: any) {
      setIsServerError(true);
      setErrorMessage(err.message || '공고 검색 중 서버 통신 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyJobCard = async (job: RecommendedJob, index: number) => {
    const cardText = `[추천 공고 정보]
회사명: ${job.company}
직무명: ${job.role}
활동 유형: ${job.type}
근무지: ${job.location}
마감일: ${job.deadline}
추천 이유: ${job.recommendationReason}
이력과 맞는 점: ${job.matchingPoints}
부족한 점: ${job.gaps}
원문 링크: ${job.sourceUrl}
`;
    const success = await copyTextToClipboard(cardText);
    if (success) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const filteredJobs = recommendations.filter((job) => {
    if (filterType === '전체') return true;
    return job.type === filterType;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Required Notice Banner */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-xs flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold text-amber-950">공고 추천 이용 안내</p>
          <p className="mt-0.5">
            <span className="font-bold underline">추천 결과는 지원 전에 반드시 원문에서 확인하세요.</span> Google 실시간 검색에서 확인된 실제 출처 링크(URL)만 제공하며, 마감일이나 근무지가 불확실한 경우 '확인 필요'로 표기됩니다.
          </p>
        </div>
      </div>

      {/* Empty Resume Warning Guard */}
      {emptyResume && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <h3 className="text-base font-bold text-red-950">저장된 내 이력이 없습니다</h3>
          <p className="text-xs sm:text-sm text-red-800 max-w-md mx-auto">
            지원자의 전공, 자격증, 도구, 프로젝트 경험을 바탕으로 맞춤 공고를 찾으려면 먼저 이력을 작성해야 합니다.
          </p>
          <button
            type="button"
            onClick={() => onNavigateToTab('resume')}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors inline-flex items-center gap-1.5"
          >
            <span>[내 이력] 탭으로 이동하여 작성하기</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Filters & Action Box */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900">맞춤 공고 2단계 정밀 검색 조건</h2>
          </div>
          <span className="text-xs text-slate-600 font-medium">
            3개 이상 직무 키워드 동시 검색
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Role Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">희망 직무 필터</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="품질관리">품질관리 (QC / QA / QM)</option>
              <option value="스마트팩토리">스마트팩토리 (MES / 공정데이터 / 자동화)</option>
              <option value="생산기술">생산기술 (공정설계 / 라인자동화 / 설비보전)</option>
              <option value="품질관리 및 생산기술">품질관리 및 생산기술 전체</option>
            </select>
          </div>

          {/* Location Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">희망 지역 필터</label>
            <input
              type="text"
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              placeholder="예: 경기, 충남, 울산, 경남, 전국"
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Activity Type Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">활동 유형 보기</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="전체">전체 (신입·인턴·교육)</option>
              <option value="신입 채용">신입 채용만</option>
              <option value="인턴">인턴십만</option>
              <option value="기업 연계 교육">기업 연계 교육만</option>
            </select>
          </div>
        </div>

        {/* Current Applied Resume Info Preview */}
        {!emptyResume && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold text-slate-800">적용된 이력 스펙:</span>
            <span>전공: {resume.major || '미입력'}</span>
            <span>자격: {resume.certifications || '미입력'}</span>
            <span>어학: {resume.languages || '미입력'}</span>
            <span>도구: {resume.tools || '미입력'}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleSearchJobs}
          disabled={isLoading || emptyResume}
          className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>3개 검색어로 2단계 실시간 공고 탐색 및 출처 검증 중...</span>
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>내 이력으로 공고 찾기</span>
            </>
          )}
        </button>
      </div>

      {/* Used Queries Display Banner */}
      {queriesUsed.length > 0 && (
        <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-blue-600" />
            <span>실시간 탐색에 사용한 직무 중심 검색어 ({queriesUsed.length}개):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {queriesUsed.map((q, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-800 font-mono text-[11px]"
              >
                "{q}"
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 1. SERVER ERROR DISPLAY */}
      {isServerError && errorMessage && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl text-xs sm:text-sm text-red-800 space-y-2">
          <div className="flex items-center gap-2 font-bold text-red-900">
            <AlertOctagon className="w-5 h-5 text-red-600 shrink-0" />
            <span>서버 통신 오류가 발생했습니다</span>
          </div>
          <p className="text-red-700 leading-relaxed">{errorMessage}</p>
          <div className="pt-1">
            <button
              type="button"
              onClick={handleSearchJobs}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>다시 시도하기</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. ZERO RESULT DISPLAY (Separated from Server Error) */}
      {!isServerError && hasSearched && !isLoading && recommendations.length === 0 && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border-2 border-amber-200 shadow-xs space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mx-auto border border-amber-200">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              검색 조건에 맞는 공고가 0건입니다
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
              현재 Google 실시간 검색에서 유효한 공식 웹 출처 링크가 직접 확인된 채용공고가 발견되지 않았거나 마감되었습니다. 아래 맞춤 키워드와 취업 포털 바로가기로 직접 확인해 보세요.
            </p>
          </div>

          {fallbackData && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              {/* Recommended Matching Roles */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  지원자 이력에 적합한 추천 직무 (3개)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {fallbackData.recommendedRoles.map((r, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-white border border-slate-200 text-slate-800 rounded-lg text-xs font-semibold"
                    >
                      {idx + 1}. {r}
                    </span>
                  ))}
                </div>
              </div>

              {/* Recommended Search Keywords */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-blue-600" />
                  추천 검색 키워드
                </h4>
                <div className="flex flex-wrap gap-2">
                  {fallbackData.recommendedKeywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-medium"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>

              {/* Direct Portal Search Links */}
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-bold text-slate-800">
                  주요 채용 포털 바로가기 (원클릭 검색):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {fallbackData.externalLinks.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 rounded-xl transition-colors flex items-center justify-between text-xs font-semibold text-slate-800 group shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                        <span>{link.platform}</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. VERIFIED SEARCH RESULTS DISPLAY */}
      {!isServerError && hasSearched && !isLoading && filteredJobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                추천 공고 검색 결과 ({filteredJobs.length}건)
              </h3>
            </div>
            <span className="text-xs text-slate-600 font-medium">
              실제 웹 출처 확인 완료 (최대 5건)
            </span>
          </div>

          <div className="space-y-4">
            {filteredJobs.map((job, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all p-5 sm:p-6 space-y-4"
              >
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          job.type === '신입 채용'
                            ? 'bg-blue-100 text-blue-800'
                            : job.type === '인턴'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-violet-100 text-violet-800'
                        }`}
                      >
                        {job.type}
                      </span>
                      <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {job.company}
                      </span>
                    </div>
                    <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {job.role}
                    </h4>
                  </div>

                  {/* Metadata tags */}
                  <div className="flex flex-wrap sm:flex-col sm:items-end gap-1.5 text-xs text-slate-600 shrink-0">
                    <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      <span>근무지: <strong className="text-slate-800">{job.location}</strong></span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>마감일: <strong className="text-slate-800">{job.deadline}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Recommendation Reason & Analysis */}
                <div className="space-y-2 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 text-xs sm:text-sm">
                  <div>
                    <span className="font-bold text-blue-900 mr-1.5">💡 추천 이유:</span>
                    <span className="text-slate-700">{job.recommendationReason}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                    <div className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-emerald-900 text-xs">이력과 맞는 점:</strong>
                        <p className="text-xs text-slate-700 mt-0.5">{job.matchingPoints}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-amber-900 text-xs">부족하거나 확인할 점:</strong>
                        <p className="text-xs text-slate-700 mt-0.5">{job.gaps}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                  <a
                    href={job.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline truncate max-w-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">공고 원문 출처 열기</span>
                  </a>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyJobCard(job, idx)}
                      className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>복사됨!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>공고 복사</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectJobForDiagnosis({
                          company: job.company,
                          role: job.role,
                          sourceUrl: job.sourceUrl,
                        });
                        onNavigateToTab('diagnose');
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <span>진단하기</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
