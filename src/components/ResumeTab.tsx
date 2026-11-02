import React, { useState } from 'react';
import { ResumeData } from '../types';
import { SAMPLE_RESUMES } from '../data/samples';
import { copyTextToClipboard } from '../utils/storage';
import { safeFetchJson, ApiErrorDetail } from '../utils/apiClient';
import { ApiErrorBox } from './ApiErrorBox';
import {
  ShieldAlert,
  FileText,
  Upload,
  Sparkles,
  Save,
  Copy,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  BookOpen,
} from 'lucide-react';

interface ResumeTabProps {
  resume: ResumeData;
  onSaveResume: (resume: ResumeData) => void;
  onNavigateToTab: (tab: string) => void;
}

export const ResumeTab: React.FC<ResumeTabProps> = ({
  resume,
  onSaveResume,
  onNavigateToTab,
}) => {
  const [formData, setFormData] = useState<ResumeData>(resume);
  const [bulkText, setBulkText] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfMimeType, setPdfMimeType] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<ApiErrorDetail | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Handle PDF file selection
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setErrorMessage('PDF 파일만 업로드할 수 있습니다.');
      setErrorDetail(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('파일 크기가 10MB를 초과할 수 없습니다.');
      setErrorDetail(null);
      return;
    }

    setErrorMessage(null);
    setErrorDetail(null);
    setSelectedFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      setPdfBase64(base64Data);
      setPdfMimeType(file.type);
    };
    reader.onerror = () => {
      setErrorMessage('파일을 읽는 중 문제가 발생했습니다.');
      setErrorDetail(null);
    };
    reader.readAsDataURL(file);
  };

  // Trigger Gemini auto-extraction with safe JSON handling
  const handleAutoExtract = async () => {
    if (!bulkText.trim() && !pdfBase64) {
      setErrorMessage('이력서 텍스트를 붙여넣거나 PDF 파일을 먼저 등록해 주세요.');
      setErrorDetail(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setErrorDetail(null);
    setStatusMessage(null);

    const apiRes = await safeFetchJson<{ success: boolean; data: any }>('/api/resume/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: bulkText.trim(),
        pdfBase64,
        mimeType: pdfMimeType,
      }),
    });

    setIsLoading(false);

    if (!apiRes.ok || !apiRes.data?.data) {
      setErrorMessage(apiRes.error || '이력서 분석에 실패했습니다.');
      setErrorDetail(apiRes.errorDetail || null);
      // Requirement 7: Keep bulkText and formData intact
      return;
    }

    const extracted = apiRes.data.data;
    setFormData((prev) => ({
      ...prev,
      major: extracted.major || prev.major,
      certifications: extracted.certifications || prev.certifications,
      languages: extracted.languages || prev.languages,
      tools: extracted.tools || prev.tools,
      experience: extracted.experience || prev.experience,
      desiredRole: extracted.desiredRole || prev.desiredRole,
      desiredLocation: extracted.desiredLocation || prev.desiredLocation,
    }));

    setStatusMessage('Gemini가 내용을 성공적으로 읽어왔습니다! 아래 항목을 확인하고 수정한 뒤 저장해 주세요.');
  };

  // Load sample preset
  const handleLoadSample = (key: keyof typeof SAMPLE_RESUMES) => {
    const sample = SAMPLE_RESUMES[key];
    if (sample) {
      setFormData(sample.data);
      setStatusMessage(`'${sample.label}' 예시 데이터를 불러왔습니다. 확인 후 저장해 보세요.`);
      setErrorMessage(null);
    }
  };

  // Save to browser
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveResume(formData);
    setStatusMessage('이력이 이 브라우저에 안전하게 저장되었습니다! 새로고침해도 유지됩니다.');
    setErrorMessage(null);
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  // Copy full resume summary
  const handleCopy = async () => {
    const textToCopy = `[제조 직무 지원자 이력 요약]
- 희망 직무: ${formData.desiredRole || '미입력'}
- 희망 지역: ${formData.desiredLocation || '미입력'}
- 전공: ${formData.major || '미입력'}
- 자격증: ${formData.certifications || '미입력'}
- 어학: ${formData.languages || '미입력'}
- 사용 도구: ${formData.tools || '미입력'}
- 경험 및 프로젝트:
${formData.experience || '미입력'}
`;
    const success = await copyTextToClipboard(textToCopy);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Privacy Notice Banner */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-xs flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold text-amber-950">개인정보 보호 안내</p>
          <p className="mt-0.5">
            <span className="underline font-medium">이름, 연락처, 주소, 주민등록번호는 지운 뒤 입력하세요.</span> 모든 데이터는 외부 서버에 보관되지 않고 사용자의 현재 브라우저에만 저장됩니다.
          </p>
        </div>
      </div>

      {/* Preset Buttons for Quick Testing */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-700 text-sm font-medium">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span>빠른 테스트용 추천 프로필:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleLoadSample('quality')}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
          >
            품질관리(QC/QA) 예시
          </button>
          <button
            type="button"
            onClick={() => handleLoadSample('smartFactory')}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-800 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            스마트팩토리/MES 예시
          </button>
          <button
            type="button"
            onClick={() => handleLoadSample('production')}
            className="px-3 py-1.5 text-xs font-semibold bg-violet-50 text-violet-800 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors"
          >
            생산기술/공정설계 예시
          </button>
        </div>
      </div>

      {/* Bulk Paste & PDF Upload Section */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900">이력서 한 번에 자동 입력 (AI 파싱)</h2>
          </div>
          <span className="text-xs text-slate-600 font-medium bg-slate-100 px-2.5 py-1 rounded-full">
            텍스트 붙여넣기 또는 PDF 업로드
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-600">
          기존에 작성해 둔 이력서 본문을 복사해 붙여넣거나 PDF 파일을 업로드하면, Gemini가 전공·자격증·어학·도구·경험 항목을 분류하여 자동으로 채워줍니다.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Paste Text Area */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              이력서 텍스트 붙여넣기
            </label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="이력서나 자기소개서, 포트폴리오 텍스트를 그대로 복사해 붙여넣으세요... (개인정보 제외)"
              rows={5}
              className="w-full text-xs sm:text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50/50"
            />
          </div>

          {/* PDF File Upload */}
          <div className="flex flex-col justify-between">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                이력서 PDF 파일 업로드
              </label>
              <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 text-center bg-slate-50/50 transition-colors">
                <input
                  type="file"
                  accept="application/pdf"
                  id="pdf-upload-input"
                  onChange={handlePdfUpload}
                  className="hidden"
                />
                <label
                  htmlFor="pdf-upload-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                >
                  <Upload className="w-6 h-6 text-indigo-500" />
                  <span className="text-xs sm:text-sm font-semibold text-slate-700">
                    {selectedFileName ? selectedFileName : 'PDF 파일 선택 (최대 10MB)'}
                  </span>
                  <span className="text-[11px] text-slate-600">
                    클릭하여 PDF 문서를 선택하세요
                  </span>
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAutoExtract}
              disabled={isLoading || (!bulkText.trim() && !pdfBase64)}
              className="mt-3 w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Gemini가 이력을 읽고 분석하는 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>내용 읽어서 자동 채우기</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <ApiErrorBox
            error={errorMessage}
            errorDetail={errorDetail}
            onRetry={handleAutoExtract}
            title="이력서 자동 입력 오류"
          />
        )}
        {statusMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Main Resume Form */}
      <form onSubmit={handleSave} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900">상세 이력 항목 (확인 및 수정)</h2>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>복사됨!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>이력 복사</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Target Role */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              희망 직무 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.desiredRole}
              onChange={(e) => setFormData({ ...formData, desiredRole: e.target.value })}
              className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="품질관리">품질관리 (QC / QA / QM)</option>
              <option value="스마트팩토리">스마트팩토리 (MES / 공정데이터분석 / 자동화)</option>
              <option value="생산기술">생산기술 (공정설계 / 라인자동화 / 설비보전)</option>
            </select>
            <p className="text-[11px] text-slate-600 mt-1">제조업 3대 핵심 직무 중 타겟 직무를 선택하세요.</p>
          </div>

          {/* Target Location */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              희망 지역
            </label>
            <input
              type="text"
              value={formData.desiredLocation}
              onChange={(e) => setFormData({ ...formData, desiredLocation: e.target.value })}
              placeholder="예: 경기/화성·평택, 충남/천안·아산, 울산, 전국 등"
              className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <p className="text-[11px] text-slate-600 mt-1">공고 추천 검색 시 우선 반영됩니다.</p>
          </div>

          {/* Major */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              전공 및 학력 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.major}
              onChange={(e) => setFormData({ ...formData, major: e.target.value })}
              placeholder="예: 기계공학과 학사, 산업공학 석사, 전자공학 4학년"
              className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
              required
            />
          </div>

          {/* Language */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              어학 성적
            </label>
            <input
              type="text"
              value={formData.languages}
              onChange={(e) => setFormData({ ...formData, languages: e.target.value })}
              placeholder="예: TOEIC 850, OPIc IM2, 토익스피킹 AL 등"
              className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Certifications */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              보유 자격증 (쉼표로 구분)
            </label>
            <input
              type="text"
              value={formData.certifications}
              onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
              placeholder="예: 품질경영기사, 6시그마 그린벨트(GB), 일반기계기사, 산업안전기사, SQLD"
              className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Tools */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              사용 도구 및 소프트웨어
            </label>
            <input
              type="text"
              value={formData.tools}
              onChange={(e) => setFormData({ ...formData, tools: e.target.value })}
              placeholder="예: Minitab, AutoCAD, CATIA, PLC(XG5000), Excel(피벗/VLOOKUP), Python, SQL"
              className="w-full text-sm p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <p className="text-[11px] text-slate-600 mt-1">공고의 우대 툴 및 통계/CAD/자동화 툴과 비교됩니다.</p>
          </div>

          {/* Experience */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              경험 및 프로젝트 (캡스톤, 인턴, 실습, 수상, 부트캠프 등)
            </label>
            <textarea
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              placeholder="구체적으로 수행한 역할, 사용 기술, 측정 지표 및 성과를 적어주세요.&#10;예: 자동차 1차 협력사 하계 실습 2개월 (SPC 관리도 작성 및 Cpk 분석 지원, 프레스 가공 치수 불량률 15% 개선 기여)"
              rows={4}
              className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>

        {/* Submit / Action Bar */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
          <div className="text-xs text-slate-600">
            {formData.updatedAt ? `마지막 저장: ${new Date(formData.updatedAt).toLocaleString('ko-KR')}` : '아직 저장되지 않음'}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setFormData({
                  major: '',
                  certifications: '',
                  languages: '',
                  tools: '',
                  experience: '',
                  desiredRole: '품질관리',
                  desiredLocation: '',
                });
                setBulkText('');
                setSelectedFileName(null);
                setPdfBase64(null);
              }}
              className="px-3 py-2.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>초기화</span>
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-initial px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>내 이력 저장하기</span>
            </button>
          </div>
        </div>
      </form>

      {/* Next Step Guide Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/70 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-blue-950">이력을 저장하셨나요?</h3>
          <p className="text-xs text-blue-800 mt-0.5">
            저장된 이력을 바탕으로 현재 모집 중인 공고를 찾거나, 지원하려는 공고의 적합도를 진단해 보세요.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateToTab('recommend')}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            공고 추천 받기 &rarr;
          </button>
          <button
            type="button"
            onClick={() => onNavigateToTab('diagnose')}
            className="px-4 py-2 bg-white text-blue-900 border border-blue-300 hover:bg-blue-50 text-xs font-bold rounded-xl transition-colors"
          >
            공고 진단하기 &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
