import React, { useState } from 'react';
import { ApiErrorDetail } from '../utils/apiClient';
import { AlertOctagon, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

interface ApiErrorBoxProps {
  error: string | null;
  errorDetail?: ApiErrorDetail | null;
  onRetry?: () => void;
  title?: string;
}

export const ApiErrorBox: React.FC<ApiErrorBoxProps> = ({
  error,
  errorDetail,
  onRetry,
  title = '요청 처리 중 오류가 발생했습니다',
}) => {
  const [showDetail, setShowDetail] = useState(false);

  if (!error && !errorDetail) return null;

  return (
    <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl text-xs sm:text-sm text-red-900 space-y-2.5 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold text-red-950">
          <AlertOctagon className="w-5 h-5 text-red-600 shrink-0" />
          <span>{title}</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>다시 시도</span>
          </button>
        )}
      </div>

      <p className="text-red-800 leading-relaxed font-medium">
        {error || '서버 응답을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'}
      </p>

      {/* Collapsible Error Details */}
      {errorDetail && (
        <div className="pt-1 border-t border-red-200/80">
          <button
            type="button"
            onClick={() => setShowDetail(!showDetail)}
            className="text-xs font-bold text-red-700 hover:text-red-950 inline-flex items-center gap-1 transition-colors py-0.5"
          >
            <span>오류 상세 {showDetail ? '접기' : '보기'}</span>
            {showDetail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showDetail && (
            <div className="mt-2 p-3 bg-white/90 border border-red-200 rounded-xl space-y-2 text-xs text-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 font-sans font-semibold">요청 API 주소: </span>
                  <span className="text-red-700 font-bold">{errorDetail.url || '알 수 없음'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans font-semibold">HTTP 상태 코드: </span>
                  <span className="font-bold text-slate-900">
                    {errorDetail.status ? `${errorDetail.status}` : '네트워크 오류 (0)'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-0.5">상세 원인:</span>
                <p className="text-slate-700 leading-relaxed">{errorDetail.message}</p>
              </div>

              {errorDetail.rawPreview && (
                <div>
                  <span className="text-slate-500 font-semibold block mb-1">
                    응답 본문 앞부분 (최대 200자):
                  </span>
                  <pre className="p-2.5 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-36">
                    {errorDetail.rawPreview}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
