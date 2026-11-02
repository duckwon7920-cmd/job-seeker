import React, { useState, useEffect } from 'react';
import { JobDiagnosisResult, ComparisonClusterResult } from '../types';
import { copyTextToClipboard } from '../utils/storage';
import {
  BarChart3,
  Trash2,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Copy,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Award,
  Layers,
  FileCheck2,
} from 'lucide-react';

interface CompareTabProps {
  diagnoses: JobDiagnosisResult[];
  onDeleteDiagnosis: (id: string) => void;
  onNavigateToTab: (tab: string) => void;
}

export const CompareTab: React.FC<CompareTabProps> = ({
  diagnoses,
  onDeleteDiagnosis,
  onNavigateToTab,
}) => {
  const [clusterData, setClusterData] = useState<ComparisonClusterResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Trigger clustering when diagnoses list changes and has items
  const fetchClustering = async (items: JobDiagnosisResult[]) => {
    if (items.length === 0) {
      setClusterData(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/comparison/cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnoses: items }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || '역량 비교 분석에 실패했습니다.');
      }

      setClusterData(resData.data);
    } catch (err: any) {
      setErrorMessage(err.message || '역량 군집화 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (diagnoses.length > 0) {
      fetchClustering(diagnoses);
    } else {
      setClusterData(null);
    }
  }, [diagnoses]);

  // Copy summary
  const handleCopySummary = async () => {
    if (!clusterData) return;

    const text = `[저장된 공고 종합 역량 갭 분석 보고서]
총 분석된 공고: ${diagnoses.length}건
- 대상 공고: ${diagnoses.map((d) => `${d.company}(${d.role})`).join(', ')}

■ 미충족 역량 빈도 순위:
${clusterData.clusters
  .map((c, i) => `${i + 1}위. ${c.competencyName} (부족 출현 ${c.count}회)`)
  .join('\n')}

■ 최우선 보완 추천 역량 TOP 3:
${clusterData.topCompetencies
  .map(
    (tc) =>
      `[${tc.rank}위] ${tc.competencyName} (${tc.frequencyText})
• 다음에 할 일: ${tc.nextAction}
• 추천 학습 자원: ${tc.recommendedResources.join(', ')}`
  )
  .join('\n\n')}
`;

    const success = await copyTextToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const maxCount = clusterData?.clusters.reduce((max, c) => Math.max(max, c.count), 1) || 1;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              공고별 역량 갭(Gap) 비교 및 통계
            </h2>
          </div>
          <span className="text-xs text-slate-600 font-medium">
            현재 저장된 공고: <strong>{diagnoses.length}</strong>개
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-600">
          진단한 여러 공고에서 반복적으로 요구되는 미충족 역량을 분석하여, 어떤 자격증이나 기술을 먼저 취득해야 취업 성공률을 극대화할 수 있는지 우선순위를 제공합니다.
        </p>
      </div>

      {/* List of Saved Job Postings */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-slate-500" />
            저장된 공고 목록
          </h3>
          {diagnoses.length > 0 && clusterData && (
            <button
              type="button"
              onClick={handleCopySummary}
              className="text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>복사됨!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>종합 분석 복사</span>
                </>
              )}
            </button>
          )}
        </div>

        {diagnoses.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
            <FileCheck2 className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">저장된 공고 진단 결과가 없습니다.</p>
            <p className="text-xs text-slate-600">
              [공고 진단] 탭에서 원하는 공고를 진단해 보세요. 진단된 공고는 여기에 자동 저장됩니다.
            </p>
            <button
              type="button"
              onClick={() => onNavigateToTab('diagnose')}
              className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors inline-flex items-center gap-1 shadow-xs"
            >
              <span>공고 진단하러 가기</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {diagnoses.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{item.company}</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-700 font-medium">{item.role}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-slate-600 text-[11px]">
                    <span>진단일: {new Date(item.createdAt).toLocaleDateString('ko-KR')}</span>
                    <span>·</span>
                    <span className="text-rose-600 font-semibold">
                      미충족/보완 {item.improvementPlan.length}건
                    </span>
                    {item.jobPostingUrl && (
                      <>
                        <span>·</span>
                        <a
                          href={item.jobPostingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-0.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>원문 링크</span>
                        </a>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => onDeleteDiagnosis(item.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-xs"
                    title="공고 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="sm:hidden">삭제</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-800">
            저장된 공고 전체의 미충족 요건을 군집화 분석하는 중입니다...
          </p>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Horizontal Bar Chart of Unmet Competency Clusters */}
      {clusterData && clusterData.clusters.length > 0 && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">
                미충족 역량 빈도 순위 (막대 차트)
              </h3>
            </div>
            <span className="text-xs text-slate-600">출현 빈도 높은 순서</span>
          </div>

          <div className="space-y-4 pt-1">
            {clusterData.clusters.map((cluster, idx) => {
              const percentage = Math.round((cluster.count / maxCount) * 100);
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-[11px] border border-indigo-200">
                        {idx + 1}
                      </span>
                      {cluster.competencyName}
                    </span>
                    <span className="font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md text-[11px]">
                      {cluster.count}건 부족
                    </span>
                  </div>

                  {/* Visual Bar */}
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-600 truncate">
                    관련 공고 요건: {cluster.relatedRequirements.join(', ')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Top 3 Competencies & Concrete Next Actions */}
      {clusterData && clusterData.topCompetencies.length > 0 && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Award className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                가장 많이 나온 역량 3개와 다음에 할 일
              </h3>
              <p className="text-xs text-slate-600">
                합격률을 단기간에 끌어올릴 수 있는 1순위 집중 보완 로드맵입니다.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {clusterData.topCompetencies.map((item) => (
              <div
                key={item.rank}
                className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold text-white ${
                        item.rank === 1
                          ? 'bg-rose-500'
                          : item.rank === 2
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                    >
                      {item.rank}
                    </span>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900">
                      {item.competencyName}
                    </h4>
                  </div>
                  <span className="text-xs font-medium text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
                    {item.frequencyText}
                  </span>
                </div>

                {/* Next Action */}
                <div className="text-xs sm:text-sm text-slate-800 space-y-1">
                  <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 text-indigo-950">
                    <strong className="block text-xs font-bold text-indigo-900 mb-1">
                      🎯 다음에 할 일 (실행 가이드):
                    </strong>
                    <p className="leading-relaxed">{item.nextAction}</p>
                  </div>
                </div>

                {/* Recommended Resources */}
                <div className="pt-1">
                  <span className="text-xs font-bold text-slate-700 block mb-1.5">
                    추천 자격증 및 학습 자원:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.recommendedResources.map((res, rIdx) => (
                      <span
                        key={rIdx}
                        className="px-2.5 py-1 text-xs bg-white text-slate-700 rounded-lg border border-slate-200 font-medium"
                      >
                        ✓ {res}
                      </span>
                    ))}
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
