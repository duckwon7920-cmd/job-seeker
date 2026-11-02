import React, { useState, useEffect } from 'react';
import { ResumeData, JobDiagnosisResult, ComparisonTableRow } from '../types';
import { SAMPLE_JOB_POSTINGS } from '../data/samples';
import { isResumeEmpty, copyTextToClipboard } from '../utils/storage';
import { safeFetchJson, ApiErrorDetail } from '../utils/apiClient';
import { ApiErrorBox } from './ApiErrorBox';
import {
  FileSearch,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  XCircle,
  Copy,
  ExternalLink,
  Tag,
  ArrowRight,
  TrendingUp,
  BookmarkCheck,
  ChevronDown,
  Layers,
} from 'lucide-react';

interface DiagnoseTabProps {
  resume: ResumeData;
  initialJobData?: { company: string; role: string; sourceUrl: string } | null;
  onSaveDiagnosis: (diagnosis: JobDiagnosisResult) => void;
  onNavigateToTab: (tab: string) => void;
}

export const DiagnoseTab: React.FC<DiagnoseTabProps> = ({
  resume,
  initialJobData,
  onSaveDiagnosis,
  onNavigateToTab,
}) => {
  const [company, setCompany] = useState(initialJobData?.company || '');
  const [role, setRole] = useState(initialJobData?.role || '');
  const [link, setLink] = useState(initialJobData?.sourceUrl || '');
  const [jobPostingText, setJobPostingText] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<ApiErrorDetail | null>(null);
  const [currentResult, setCurrentResult] = useState<JobDiagnosisResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [filterVerdict, setFilterVerdict] = useState<string>('전체');

  // If initialJobData was passed from RecommendTab, update state
  useEffect(() => {
    if (initialJobData) {
      if (initialJobData.company) setCompany(initialJobData.company);
      if (initialJobData.role) setRole(initialJobData.role);
      if (initialJobData.sourceUrl) setLink(initialJobData.sourceUrl);
    }
  }, [initialJobData]);

  const emptyResume = isResumeEmpty(resume);

  // Load sample job posting
  const handleLoadSample = (sample: (typeof SAMPLE_JOB_POSTINGS)[0]) => {
    setCompany(sample.company);
    setRole(sample.role);
    setLink(sample.url);
    setJobPostingText(sample.text);
    setErrorMessage(null);
    setErrorDetail(null);
  };

  // Run analysis via Gemini with safe JSON parsing
  const handleDiagnose = async () => {
    if (emptyResume) {
      setErrorMessage('내 이력이 비어 있습니다. [내 이력] 탭에서 이력을 먼저 작성해 주세요.');
      setErrorDetail(null);
      return;
    }
    if (!company.trim() || !role.trim() || !jobPostingText.trim()) {
      setErrorMessage('회사명, 직무명, 공고 본문을 모두 입력해 주세요.');
      setErrorDetail(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setErrorDetail(null);

    const apiRes = await safeFetchJson<{ success: boolean; data: any }>('/api/jobs/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: company.trim(),
        role: role.trim(),
        jobPostingText: jobPostingText.trim(),
        resume,
      }),
    });

    setIsLoading(false);

    if (!apiRes.ok || !apiRes.data?.data) {
      setErrorMessage(apiRes.error || '공고 진단에 실패했습니다.');
      setErrorDetail(apiRes.errorDetail || null);
      // Requirement 7: Keep company, role, link, jobPostingText intact
      return;
    }

    const resData = apiRes.data;
    const diagnosisData: JobDiagnosisResult = {
      id: `diag_${Date.now()}`,
      createdAt: new Date().toISOString(),
      company: company.trim(),
      role: role.trim(),
      jobPostingUrl: link.trim(),
      jobPostingText: jobPostingText.trim(),
      summary: resData.data.summary,
      comparisonTable: resData.data.comparisonTable,
      improvementPlan: resData.data.improvementPlan,
    };

    setCurrentResult(diagnosisData);
    onSaveDiagnosis(diagnosisData); // Auto-save to localStorage
  };

  // Copy full diagnosis report to clipboard
  const handleCopyReport = async () => {
    if (!currentResult) return;

    let text = `[공고 진단 리포트]
■ 회사명: ${currentResult.company}
■ 직무명: ${currentResult.role}
■ 공고 링크: ${currentResult.jobPostingUrl || '확인 필요'}
■ 진단 일시: ${new Date(currentResult.createdAt).toLocaleString('ko-KR')}

[1. 주요 업무 요약]
${currentResult.summary.responsibilities.map((r) => `- ${r}`).join('\n')}

[2. 필수 요건]
${currentResult.summary.requiredQualifications.map((r) => `- ${r}`).join('\n')}

[3. 우대사항]
${currentResult.summary.preferredQualifications.map((r) => `- ${r}`).join('\n')}

[4. 핵심 키워드]
${currentResult.summary.keywords.join(', ')}

[5. 요건별 적합도 비교표]
${currentResult.comparisonTable
  .map(
    (row) =>
      `• [${row.verdict}] [${row.category}] ${row.requirement}
   - 공고 원문: "${row.exactQuote}"
   - 이력 근거: ${row.resumeEvidence}
   - 다음에 할 일: ${row.actionItem}`
  )
  .join('\n\n')}

[6. 미충족 요건 중요도순 보완 계획]
${currentResult.improvementPlan
  .map(
    (plan, i) =>
      `${i + 1}. [중요도: ${plan.priority}] ${plan.unmetRequirement}
   - 원문 근거: "${plan.exactQuote}"
   - 부족 원인: ${plan.gapReason}
   - 구체적 실행 방안: ${plan.concreteAction}`
  )
  .join('\n\n')}
`;

    const success = await copyTextToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Helper for verdict tag styling
  const renderVerdictBadge = (verdict: ComparisonTableRow['verdict']) => {
    switch (verdict) {
      case '충족':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            충족
          </span>
        );
      case '부분 충족':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            부분 충족
          </span>
        );
      case '미충족':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            미충족
          </span>
        );
      case '확인 필요':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            확인 필요
          </span>
        );
    }
  };

  const filteredTableRows =
    currentResult?.comparisonTable.filter((row) => {
      if (filterVerdict === '전체') return true;
      if (filterVerdict === '미충족/부분충족') return row.verdict === '미충족' || row.verdict === '부분 충족';
      return row.verdict === filterVerdict;
    }) || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Empty Resume Guard */}
      {emptyResume && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-amber-950">내 이력을 먼저 작성해 주세요</p>
            <p className="text-xs text-amber-800">
              공고 요건과 내 이력을 정확히 대조하기 위해, [내 이력] 탭에 전공, 자격증, 도구, 경험을 먼저 저장해야 합니다.
            </p>
            <button
              type="button"
              onClick={() => onNavigateToTab('resume')}
              className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
            >
              [내 이력] 탭으로 이동하기 &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900">공고 정보 입력 및 정밀 진단</h2>
          </div>
          <span className="text-xs text-slate-600 font-medium">
            원문 팩트 기반 요건 매칭
          </span>
        </div>

        {/* Preset sample buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-600 font-medium">테스트용 실제 예시 공고 불러오기:</span>
          {SAMPLE_JOB_POSTINGS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleLoadSample(sample)}
              className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors border border-slate-200"
            >
              {sample.company} ({sample.role.split(' ')[0]})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              회사명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="예: 현대자동차, LG에너지솔루션, 모빌리티정밀"
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              직무명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="예: 품질관리(QC), 스마트팩토리 MES, 생산기술"
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">공고 링크 (URL)</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="예: https://recruit.company.com/jobs/12345"
              className="w-full text-xs sm:text-sm p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              공고 본문 내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={jobPostingText}
              onChange={(e) => setJobPostingText(e.target.value)}
              placeholder="채용공고 웹페이지에서 담당 업무, 자격 요건, 우대사항 텍스트를 그대로 복사하여 붙여넣으세요..."
              rows={7}
              className="w-full text-xs sm:text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
            />
            <p className="text-[11px] text-slate-600 mt-1">
              * 붙여넣은 본문에 실제로 존재하는 문장만을 근거로 추출하고 판정합니다.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDiagnose}
          disabled={isLoading || emptyResume || !company.trim() || !role.trim() || !jobPostingText.trim()}
          className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>공고 원문과 내 이력을 대조하여 정밀 분석하는 중...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>공고 분석하기</span>
            </>
          )}
        </button>

        {errorMessage && (
          <ApiErrorBox
            error={errorMessage}
            errorDetail={errorDetail}
            onRetry={handleDiagnose}
            title="공고 진단 오류"
          />
        )}
      </div>

      {/* Analysis Results Display */}
      {currentResult && (
        <div className="space-y-6">
          {/* Header & Copy Button */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                    진단 완료 · 자동 저장됨
                  </span>
                  <span className="text-xs text-slate-600">
                    {new Date(currentResult.createdAt).toLocaleString('ko-KR')}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
                  [{currentResult.company}] {currentResult.role}
                </h3>
                {currentResult.jobPostingUrl && (
                  <a
                    href={currentResult.jobPostingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>공고 링크 확인</span>
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>복사 완료!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>진단 결과 복사</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Structured Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* Responsibilities */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  주요 업무
                </h4>
                <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                  {currentResult.summary.responsibilities.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Requirements */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  필수 요건
                </h4>
                <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                  {currentResult.summary.requiredQualifications.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Preferred */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  우대사항
                </h4>
                <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                  {currentResult.summary.preferredQualifications.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Keywords */}
            <div className="pt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mr-1">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                핵심 키워드:
              </span>
              {currentResult.summary.keywords.map((kw, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100"
                >
                  #{kw}
                </span>
              ))}
            </div>
          </div>

          {/* Comparison Table Section */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  내 이력 vs 공고 요건 대조표
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  공고 원문 문구와 내 이력에 명시된 팩트를 기반으로 판정하였습니다.
                </p>
              </div>

              {/* Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                {['전체', '미충족/부분충족', '충족', '확인 필요'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilterVerdict(f)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      filterVerdict === f
                        ? 'bg-white text-slate-900 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="p-3 w-28">요건 구분</th>
                    <th className="p-3 w-40">요건 명칭</th>
                    <th className="p-3 w-28 text-center">판정</th>
                    <th className="p-3 min-w-[200px]">공고 원문 문구</th>
                    <th className="p-3 min-w-[180px]">이력 근거</th>
                    <th className="p-3 min-w-[180px]">다음에 할 일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTableRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 align-top font-semibold text-slate-700">
                        <span className="px-2 py-0.5 bg-slate-200/80 rounded-md text-[11px]">
                          {row.category}
                        </span>
                      </td>
                      <td className="p-3 align-top font-bold text-slate-900">
                        {row.requirement}
                      </td>
                      <td className="p-3 align-top text-center">
                        {renderVerdictBadge(row.verdict)}
                      </td>
                      <td className="p-3 align-top text-slate-700 leading-relaxed font-mono text-[11px] bg-slate-50/50">
                        "{row.exactQuote}"
                      </td>
                      <td className="p-3 align-top text-slate-700 leading-relaxed">
                        {row.resumeEvidence}
                      </td>
                      <td className="p-3 align-top text-blue-900 font-medium leading-relaxed">
                        {row.actionItem}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footnote */}
            <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-3 pt-1">
              <span>판정 기준:</span>
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> 충족 (이력에 직접 명시된 근거 확인)
              </span>
              <span className="flex items-center gap-1 text-amber-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> 부분 충족 (유사 경험 또는 기초 수준)
              </span>
              <span className="flex items-center gap-1 text-rose-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> 미충족 (이력에 언급 없음 또는 불일치)
              </span>
              <span className="flex items-center gap-1 text-slate-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-slate-400" /> 확인 필요 (공고/이력 내용만으로 판단 불가)
              </span>
            </div>
          </div>

          {/* Remediation Action Plan (보완 계획) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <TrendingUp className="w-5 h-5 text-rose-600" />
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  미충족 항목 중요도순 보완 계획
                </h3>
                <p className="text-xs text-slate-600">
                  서류 및 면접 합격률을 높이기 위해 우선적으로 보완해야 할 구체적인 실행 방안입니다.
                </p>
              </div>
            </div>

            {currentResult.improvementPlan.length === 0 ? (
              <div className="p-6 text-center text-slate-600 text-xs sm:text-sm">
                미충족 또는 보완이 필요한 항목이 없습니다. 훌륭한 적합도를 보이고 있습니다!
              </div>
            ) : (
              <div className="space-y-3">
                {currentResult.improvementPlan.map((plan, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                            plan.priority === '높음'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : plan.priority === '보통'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          중요도: {plan.priority}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">
                          {plan.unmetRequirement}
                        </h4>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-100 font-mono">
                      원문 근거: "{plan.exactQuote}"
                    </div>

                    <div className="text-xs space-y-1 pt-1">
                      <div>
                        <strong className="text-slate-800">부족 원인: </strong>
                        <span className="text-slate-700">{plan.gapReason}</span>
                      </div>
                      <div className="text-blue-900 bg-blue-50/70 p-2.5 rounded-lg border border-blue-100">
                        <strong className="text-blue-950 font-bold">💡 구체적 실행 방안: </strong>
                        <span>{plan.concreteAction}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick link to compare tab */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-indigo-950">
                진단한 공고가 브라우저에 저장되었습니다!
              </p>
              <p className="text-xs text-indigo-800 mt-0.5">
                여러 공고를 진단한 후 [공고 비교] 탭에서 가장 많이 반복되는 역량 부족 항목을 차트로 확인해 보세요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab('compare')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-xs"
            >
              공고 비교 탭으로 이동 &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
