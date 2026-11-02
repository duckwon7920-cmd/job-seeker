import React, { useState, useEffect } from 'react';
import {
  ResumeData,
  ManufacturingIssue,
  SavedIssuesState,
  TrendAnalysisResult,
  RssArticleItem,
} from '../types';
import { SAMPLE_TREND_ARTICLES } from '../data/samples';
import {
  loadSavedIssues,
  saveSavedIssues,
  copyTextToClipboard,
} from '../utils/storage';
import { safeFetchJson, ApiErrorDetail } from '../utils/apiClient';
import { ApiErrorBox } from './ApiErrorBox';
import {
  Newspaper,
  Sparkles,
  ExternalLink,
  Calendar,
  Copy,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Tag,
  FileText,
  Bookmark,
  MessageSquare,
  Flame,
  RotateCcw,
  Clock,
  Layers,
  Rss,
} from 'lucide-react';

interface TrendsTabProps {
  resume: ResumeData;
  savedTrends: TrendAnalysisResult[];
  onSaveTrend: (trend: TrendAnalysisResult) => void;
  onDeleteTrend: (id: string) => void;
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

const RSS_CATEGORIES = [
  '스마트팩토리',
  '제조 AI',
  '제조 품질',
  '전기차 배터리',
  '반도체 공정',
  '조선 방산',
  '관세 공급망',
];

export const TrendsTab: React.FC<TrendsTabProps> = ({
  resume,
  savedTrends,
  onSaveTrend,
  onDeleteTrend,
}) => {
  // Current role filter for hot issues search
  const [selectedRole, setSelectedRole] = useState<string>(resume.desiredRole || '품질관리');

  // Hot Issues state loaded from localStorage
  const [savedIssuesState, setSavedIssuesState] = useState<SavedIssuesState | null>(() =>
    loadSavedIssues()
  );
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [issuesErrorDetail, setIssuesErrorDetail] = useState<ApiErrorDetail | null>(null);
  const [isIssuesServerError, setIsIssuesServerError] = useState(false);
  const [rssNetworkErrorBanner, setRssNetworkErrorBanner] = useState<string | null>(null);
  const [copiedIssueIndex, setCopiedIssueIndex] = useState<number | null>(null);
  const [isAllRssExpanded, setIsAllRssExpanded] = useState(false);

  // Accordion state for "직접 기사 분석" (Direct Article Analysis)
  const [isManualAnalysisOpen, setIsManualAnalysisOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualLink, setManualLink] = useState('');
  const [manualArticleText, setManualArticleText] = useState('');
  const [isManualLoading, setIsManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualErrorDetail, setManualErrorDetail] = useState<ApiErrorDetail | null>(null);
  const [manualResult, setManualResult] = useState<TrendAnalysisResult | null>(null);
  const [manualCopied, setManualCopied] = useState(false);

  // Sync selectedRole if resume.desiredRole changes
  useEffect(() => {
    if (resume.desiredRole && !savedIssuesState) {
      setSelectedRole(resume.desiredRole);
    }
  }, [resume.desiredRole]);

  // Check if saved result is within 6 hours
  const isWithin6Hours = savedIssuesState?.lastSearchedAt
    ? Date.now() - new Date(savedIssuesState.lastSearchedAt).getTime() < SIX_HOURS_MS
    : false;

  // Fetch Hot Issues using Google News RSS & Gemini Clustering
  const fetchHotIssues = async (
    roleToUse: string,
    forceRssFetch = true,
    cachedArticles?: RssArticleItem[]
  ) => {
    setIsLoadingIssues(true);
    setIssuesError(null);
    setIssuesErrorDetail(null);
    setIsIssuesServerError(false);
    setRssNetworkErrorBanner(null);

    const apiRes = await safeFetchJson<{
      success: boolean;
      aiAnalysisSuccess: boolean;
      aiError?: string;
      queriesUsed: string[];
      targetRole: string;
      searchDate: string;
      issues: ManufacturingIssue[];
      rssArticles: RssArticleItem[];
      searchedAt: string;
    }>('/api/trends/fetch-hot-issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetRole: roleToUse,
        cachedRssArticles: !forceRssFetch && cachedArticles ? cachedArticles : undefined,
      }),
    });

    setIsLoadingIssues(false);

    if (!apiRes.ok || !apiRes.data) {
      // Requirement: If RSS fails, show saved previous results with timestamp
      if (
        savedIssuesState &&
        (savedIssuesState.issues.length > 0 ||
          (savedIssuesState.rssArticles && savedIssuesState.rssArticles.length > 0))
      ) {
        setRssNetworkErrorBanner(
          `최신 RSS 뉴스를 수집하는 데 실패했습니다. 이전에 저장된 결과(${new Date(
            savedIssuesState.lastSearchedAt
          ).toLocaleString('ko-KR')})를 계속 표시합니다.`
        );
      } else {
        setIsIssuesServerError(true);
        setIssuesError(apiRes.error || '제조업 뉴스 RSS를 불러오지 못했습니다.');
        setIssuesErrorDetail(apiRes.errorDetail || null);
      }
      return;
    }

    const resData = apiRes.data;
    const newState: SavedIssuesState = {
      lastSearchedAt: resData.searchedAt || new Date().toISOString(),
      targetRole: roleToUse,
      queriesUsed: resData.queriesUsed || [],
      issues: resData.issues || [],
      rssArticles: resData.rssArticles || [],
      aiAnalysisSuccess: resData.aiAnalysisSuccess,
      aiErrorMessage: resData.aiError,
    };

    setSavedIssuesState(newState);
    saveSavedIssues(newState);
  };

  // Re-analyze already collected RSS articles
  const handleReAnalyzeWithAi = () => {
    if (savedIssuesState?.rssArticles && savedIssuesState.rssArticles.length > 0) {
      fetchHotIssues(selectedRole, false, savedIssuesState.rssArticles);
    } else {
      fetchHotIssues(selectedRole, true);
    }
  };

  // Role filter click triggers re-search from that role's perspective
  const handleRoleFilterChange = (role: string) => {
    setSelectedRole(role);
    if (savedIssuesState?.rssArticles && savedIssuesState.rssArticles.length > 0) {
      fetchHotIssues(role, false, savedIssuesState.rssArticles);
    } else {
      fetchHotIssues(role, true);
    }
  };

  // Copy individual hot issue card
  const handleCopyIssueCard = async (issue: ManufacturingIssue, idx: number) => {
    const text = `[제조업 핫이슈] ${issue.title}
■ 분야: ${issue.domain}
■ 보도 날짜: ${issue.date}
■ 출처 링크: ${issue.sourceUrls.map((s) => `${s.title}: ${s.url}`).join(', ')}

[1. 핵심 내용 요약]
${(issue.threeLineSummary || []).map((s, i) => `${i + 1}) ${s}`).join('\n')}

[2. 왜 중요한가?]
${issue.whyItMatters}

[3. 희망 직무(${selectedRole})와의 관련성]
${issue.roleRelevance}

[4. 자소서 활용 소재]
${issue.selfIntroMaterial}

[5. 예상 면접 질문 3개]
${issue.interviewQuestions
  .map(
    (q, i) =>
      `Q${i + 1}. ${q.question}
   - 의도: ${q.intent}
   - 답변 팁: ${q.answerTip}`
  )
  .join('\n\n')}
`;
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedIssueIndex(idx);
      setTimeout(() => setCopiedIssueIndex(null), 2000);
    }
  };

  // Direct article manual analysis with safe JSON parsing
  const handleAnalyzeManualArticle = async () => {
    if (!manualTitle.trim() || !manualArticleText.trim()) {
      setManualError('기사 제목과 본문을 모두 입력해 주세요.');
      setManualErrorDetail(null);
      return;
    }

    setIsManualLoading(true);
    setManualError(null);
    setManualErrorDetail(null);

    const apiRes = await safeFetchJson<{ success: boolean; data: any }>('/api/trends/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: manualTitle.trim(),
        date: manualDate.trim() || '확인 필요',
        link: manualLink.trim() || '확인 필요',
        articleText: manualArticleText.trim(),
        desiredRole: selectedRole || resume.desiredRole || '품질관리/스마트팩토리/생산기술',
      }),
    });

    setIsManualLoading(false);

    if (!apiRes.ok || !apiRes.data?.data) {
      setManualError(apiRes.error || '산업 동향 분석에 실패했습니다.');
      setManualErrorDetail(apiRes.errorDetail || null);
      return;
    }

    const resData = apiRes.data;
    const trendData: TrendAnalysisResult = {
      id: `trend_${Date.now()}`,
      createdAt: new Date().toISOString(),
      title: resData.data.title,
      date: resData.data.date,
      link: resData.data.link,
      articleText: manualArticleText.trim(),
      desiredRole: selectedRole,
      threeLineSummary: resData.data.threeLineSummary || [],
      roleRelevance: resData.data.roleRelevance || '',
      selfIntroMaterials: resData.data.selfIntroMaterials || [],
      interviewQuestions: resData.data.interviewQuestions || [],
    };

    setManualResult(trendData);
    onSaveTrend(trendData);
  };

  const handleLoadSampleManual = (sample: (typeof SAMPLE_TREND_ARTICLES)[0]) => {
    setManualTitle(sample.title);
    setManualDate(sample.date);
    setManualLink(sample.link);
    setManualArticleText(sample.articleText);
    setManualError(null);
  };

  const currentIssues = savedIssuesState?.issues || [];
  const currentRssArticles = savedIssuesState?.rssArticles || [];
  const isAiAnalysisFailed = savedIssuesState?.aiAnalysisSuccess === false;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 1. TOP PROMINENT ACTION BUTTON & INTRO */}
      <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 text-white p-6 sm:p-7 rounded-2xl shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-current" />
                Google 뉴스 RSS 실시간 수집
              </span>
              <span className="text-xs text-blue-200">최근 30일 제조 7대 분야</span>
              {isWithin6Hours && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  6시간 보관 유지 중
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-2xl font-extrabold tracking-tight">
              오늘의 제조업 핵심 이슈 브리핑
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 max-w-xl">
              스마트팩토리, 제조 AI, 제조 품질, 전기차 배터리, 반도체 공정, 조선 방산, 관세 공급망 등
              7대 핵심 분야 RSS 기사를 수집하고 중복 보도된 핫이슈를 분석합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchHotIssues(selectedRole, true)}
            disabled={isLoadingIssues}
            className="w-full sm:w-auto px-6 py-3.5 bg-amber-400 hover:bg-amber-300 disabled:bg-slate-500 text-slate-950 rounded-xl text-sm sm:text-base font-extrabold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 shrink-0"
          >
            {isLoadingIssues ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>RSS 기사 수집 및 이슈 분석 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>{savedIssuesState ? '새로 찾기' : '오늘의 제조업 이슈 찾기'}</span>
              </>
            )}
          </button>
        </div>

        {/* Role Perspective Filters */}
        <div className="pt-2 border-t border-blue-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-200">
            <span>직무 관점 필터:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: '품질관리', label: '품질관리' },
                { key: '스마트팩토리', label: '스마트팩토리' },
                { key: '생산기술', label: '생산기술' },
                { key: '품질관리, 스마트팩토리, 생산기술', label: '제조 전체' },
              ].map((roleItem) => (
                <button
                  key={roleItem.key}
                  type="button"
                  disabled={isLoadingIssues}
                  onClick={() => handleRoleFilterChange(roleItem.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    selectedRole === roleItem.key
                      ? 'bg-white text-blue-900 shadow-xs'
                      : 'bg-blue-950/60 text-blue-200 hover:bg-blue-800/80 border border-blue-700/50'
                  }`}
                >
                  {roleItem.label}
                </button>
              ))}
            </div>
          </div>

          {/* Last Searched Timestamp */}
          {savedIssuesState?.lastSearchedAt && (
            <div className="text-[11px] text-blue-200 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-300" />
              <span>
                마지막 탐색:{' '}
                <strong>{new Date(savedIssuesState.lastSearchedAt).toLocaleString('ko-KR')}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* RSS Network Error Fallback Banner */}
      {rssNetworkErrorBanner && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-xs sm:text-sm text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">{rssNetworkErrorBanner}</span>
            <p className="text-amber-800 text-xs">
              네트워크 연결 상태를 확인한 후 상단의 '새로 찾기' 버튼을 눌러 다시 시도해 보세요.
            </p>
          </div>
        </div>
      )}

      {/* Queries Used Banner */}
      {savedIssuesState?.queriesUsed && savedIssuesState.queriesUsed.length > 0 && (
        <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-indigo-600" />
            <span>수집 대상 Google 뉴스 RSS 검색어 (7개 분야):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {savedIssuesState.queriesUsed.map((q, idx) => (
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

      {/* Server Error Display */}
      {isIssuesServerError && issuesError && (
        <ApiErrorBox
          error={issuesError}
          errorDetail={issuesErrorDetail}
          onRetry={() => fetchHotIssues(selectedRole, true)}
          title="제조업 이슈 검색 중 서버 오류가 발생했습니다"
        />
      )}

      {/* AI Analysis Failure Banner (429/503 fallback: show notice + raw RSS list) */}
      {isAiAnalysisFailed && currentRssArticles.length > 0 && !isLoadingIssues && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 font-bold text-amber-950 text-sm sm:text-base">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>AI 분석은 잠시 후 다시 시도할 수 있습니다</span>
          </div>
          <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
            Gemini API 일시적 호출 한도(429) 또는 서비스 지연으로 인해 요약 분석을 바로 완료하지 못했습니다.
            수집된 Google 뉴스 RSS 기사 목록(총 {currentRssArticles.length}건)을 아래 분야별로 먼저 확인하실 수 있으며,
            잠시 후 '다시 분석하기'를 누르면 즉시 분석을 진행합니다.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleReAnalyzeWithAi}
              disabled={isLoadingIssues}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>다시 분석하기</span>
            </button>
            <span className="text-xs text-amber-800">
              (이미 수집된 RSS 기사 {currentRssArticles.length}건을 기반으로 재분석합니다)
            </span>
          </div>
        </div>
      )}

      {/* 0 Results Display */}
      {!isIssuesServerError &&
        savedIssuesState &&
        currentIssues.length === 0 &&
        currentRssArticles.length === 0 &&
        !isLoadingIssues && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-amber-200 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-sm sm:text-base font-bold text-slate-800">
              수집된 기사 결과가 0건입니다
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              상단의 '새로 찾기' 버튼을 누르거나 잠시 후 다시 시도해 보세요.
            </p>
          </div>
        )}

      {/* Initial Empty State Guide (when never searched) */}
      {!savedIssuesState && !isLoadingIssues && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
          <Newspaper className="w-10 h-10 text-indigo-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            상단의 '오늘의 제조업 이슈 찾기' 버튼을 눌러보세요!
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
            Google 뉴스 RSS를 통해 스마트팩토리, 제조 AI, 품질, 배터리, 반도체, 조선 방산, 공급망 등
            7대 핵심 분야의 최신 30일 뉴스를 수집하고 직무 맞춤형 핫이슈로 정리해 드립니다.
          </p>
        </div>
      )}

      {/* Hot Issues Cards Display (Max 5) */}
      {currentIssues.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                선별된 핵심 핫이슈 ({currentIssues.length}건)
              </h3>
            </div>
            <span className="text-xs text-slate-600 font-medium">
              직무 관점: <strong>{savedIssuesState?.targetRole || selectedRole}</strong>
            </span>
          </div>

          <div className="space-y-5">
            {currentIssues.map((issue, idx) => (
              <div
                key={issue.id || idx}
                className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all space-y-4"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-800">
                        #{issue.domain}
                      </span>
                      <span className="text-xs text-slate-600 flex items-center gap-1 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        보도 날짜: <strong>{issue.date}</strong>
                      </span>
                    </div>
                    <h4 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                      {issue.title}
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyIssueCard(issue, idx)}
                    className="self-start px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                  >
                    {copiedIssueIndex === idx ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>복사됨!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>이슈 복사</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 1. Summary */}
                {issue.threeLineSummary && issue.threeLineSummary.length > 0 && (
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
                    <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      핵심 내용 요약
                    </h5>
                    <div className="space-y-1 text-xs sm:text-sm text-slate-800">
                      {issue.threeLineSummary.map((line, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-1.5">
                          <span className="font-bold text-blue-600 shrink-0">{sIdx + 1}.</span>
                          <p className="leading-relaxed">{line}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Why it matters & Role Relevance Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  {/* Why it matters */}
                  <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/60 space-y-1">
                    <strong className="text-amber-950 font-bold block text-xs">
                      ⚡ 왜 중요한가? (제조업계 영향도)
                    </strong>
                    <p className="text-slate-800 leading-relaxed text-xs">{issue.whyItMatters}</p>
                  </div>

                  {/* Target Role Relevance */}
                  <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-200/60 space-y-1">
                    <strong className="text-indigo-950 font-bold block text-xs">
                      🎯 희망 직무({selectedRole})와의 관련성
                    </strong>
                    <p className="text-slate-800 leading-relaxed text-xs">{issue.roleRelevance}</p>
                  </div>
                </div>

                {/* 3. Self-introduction material */}
                <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/60 space-y-1 text-xs sm:text-sm">
                  <div className="flex items-center gap-1 text-emerald-950 font-bold text-xs">
                    <Bookmark className="w-3.5 h-3.5 text-emerald-600" />
                    <span>자기소개서 작성 소재</span>
                  </div>
                  <p className="text-slate-800 leading-relaxed text-xs">{issue.selfIntroMaterial}</p>
                </div>

                {/* 4. Interview Questions */}
                <div className="space-y-2 pt-1">
                  <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                    예상 면접 질문 3개 및 모범 답변 착안점
                  </h5>
                  <div className="space-y-2">
                    {issue.interviewQuestions.map((q, qIdx) => (
                      <div
                        key={qIdx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1"
                      >
                        <div className="font-bold text-slate-900 flex items-start gap-1.5">
                          <span className="text-purple-600 font-extrabold">Q{qIdx + 1}.</span>
                          <span>{q.question}</span>
                        </div>
                        <div className="pl-3.5 border-l-2 border-slate-300 space-y-0.5 text-[11px] text-slate-600">
                          <div>
                            <strong className="text-slate-700">질문 의도: </strong>
                            <span>{q.intent}</span>
                          </div>
                          <div className="text-purple-900 font-medium">
                            <strong className="text-purple-950">💡 답변 팁: </strong>
                            <span>{q.answerTip}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. RSS Original Source Links */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-700">출처 기사 (RSS 원본):</span>
                  {issue.sourceUrls.map((src, sIdx) => (
                    <a
                      key={sIdx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-blue-700 hover:text-blue-900 rounded-lg border border-slate-200 transition-colors flex items-center gap-1 truncate max-w-xs font-medium text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{src.title || src.url}</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grouped Raw RSS Articles Section (Visible on AI failure OR toggleable when AI succeeded) */}
      {currentRssArticles.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setIsAllRssExpanded(!isAllRssExpanded)}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Rss className="w-4 h-4 text-orange-600" />
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                수집된 Google 뉴스 RSS 기사 목록 (7대 분야 {currentRssArticles.length}건)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>{isAllRssExpanded || isAiAnalysisFailed ? '접기' : '모두 펼치기'}</span>
              {isAllRssExpanded || isAiAnalysisFailed ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {(isAllRssExpanded || isAiAnalysisFailed) && (
            <div className="p-5 sm:p-6 border-t border-slate-100 space-y-6 bg-slate-50/40">
              {RSS_CATEGORIES.map((cat) => {
                const catArticles = currentRssArticles.filter((a) => a.category === cat);
                if (catArticles.length === 0) return null;
                return (
                  <div key={cat} className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-900">
                        {cat}
                      </span>
                      <span className="text-xs text-slate-500">최신 {catArticles.length}건</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {catArticles.map((article, aIdx) => (
                        <div
                          key={article.id || aIdx}
                          className="p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 transition-colors flex flex-col justify-between gap-2 text-xs"
                        >
                          <div className="space-y-1">
                            <h6 className="font-bold text-slate-900 leading-snug line-clamp-2">
                              {article.title}
                            </h6>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span className="font-semibold text-slate-700">
                                {article.publisher}
                              </span>
                              <span>·</span>
                              <span>{article.date}</span>
                            </div>
                          </div>
                          <a
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium self-end text-[11px] hover:underline"
                          >
                            <span>원문 기사 보기</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. ACCORDION / COLLAPSIBLE: '직접 기사 분석' (Preserved Original Feature) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setIsManualAnalysisOpen(!isManualAnalysisOpen)}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-slate-600" />
            <span className="text-xs sm:text-sm font-bold text-slate-900">
              직접 기사 분석 (기사 텍스트를 직접 붙여넣어 심층 분석하기)
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>{isManualAnalysisOpen ? '접기' : '펼치기'}</span>
            {isManualAnalysisOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isManualAnalysisOpen && (
          <div className="p-5 sm:p-6 border-t border-slate-100 space-y-4 bg-slate-50/30">
            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-600 font-medium">예시 기사 불러오기:</span>
              {SAMPLE_TREND_ARTICLES.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleLoadSampleManual(sample)}
                  className="px-2.5 py-1 text-xs bg-white hover:bg-slate-100 text-slate-700 font-medium rounded-lg transition-colors border border-slate-200"
                >
                  {sample.title.slice(0, 24)}...
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  기사 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="예: 배터리 수율 관리 및 스마트팩토리 비전 검사 도입 확산"
                  className="w-full text-xs sm:text-sm p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">기사 날짜</label>
                <input
                  type="text"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  placeholder="예: 2026-10-25 (미확인 시 '확인 필요')"
                  className="w-full text-xs sm:text-sm p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">기사 링크 (URL)</label>
                <input
                  type="url"
                  value={manualLink}
                  onChange={(e) => setManualLink(e.target.value)}
                  placeholder="예: https://news.example.com/1234"
                  className="w-full text-xs sm:text-sm p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  기사 본문 내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={manualArticleText}
                  onChange={(e) => setManualArticleText(e.target.value)}
                  placeholder="기사 본문 텍스트를 복사해 붙여넣으세요..."
                  rows={5}
                  className="w-full text-xs sm:text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAnalyzeManualArticle}
              disabled={isManualLoading || !manualTitle.trim() || !manualArticleText.trim()}
              className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              {isManualLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>기사 본문 기반 직무 연계 분석 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>입력한 기사 분석하기</span>
                </>
              )}
            </button>

            {manualError && (
              <ApiErrorBox
                error={manualError}
                errorDetail={manualErrorDetail}
                onRetry={handleAnalyzeManualArticle}
                title="직접 기사 분석 오류"
              />
            )}

            {/* Manual Analysis Result */}
            {manualResult && (
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-3 pt-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="font-bold text-slate-900 text-sm">{manualResult.title}</h4>
                  <button
                    type="button"
                    onClick={async () => {
                      const text = `[직접 기사 분석 결과] ${manualResult.title}\n날짜: ${manualResult.date}\n링크: ${manualResult.link}\n3줄요약:\n${manualResult.threeLineSummary.join('\n')}\n직무관련성:\n${manualResult.roleRelevance}`;
                      await copyTextToClipboard(text);
                      setManualCopied(true);
                      setTimeout(() => setManualCopied(false), 2000);
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-semibold"
                  >
                    {manualCopied ? '복사됨!' : '결과 복사'}
                  </button>
                </div>
                <div className="space-y-1 text-xs text-slate-800">
                  <strong className="block text-slate-900">핵심 내용 요약:</strong>
                  {manualResult.threeLineSummary.map((s, idx) => (
                    <p key={idx}>
                      {idx + 1}. {s}
                    </p>
                  ))}
                </div>
                <div className="text-xs text-slate-800">
                  <strong className="block text-slate-900 mb-0.5">직무 관련성:</strong>
                  <p>{manualResult.roleRelevance}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
