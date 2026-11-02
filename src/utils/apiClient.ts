export interface ApiErrorDetail {
  status: number;
  url: string;
  isJson: boolean;
  rawPreview?: string;
  message: string;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  errorDetail?: ApiErrorDetail;
}

/**
 * Safely fetches a URL and guarantees that non-JSON responses (e.g. 502/504 HTML pages)
 * do not throw "Unexpected token T, <..." SyntaxErrors.
 * Strictly verifies HTTP status and Content-Type before parsing JSON.
 */
export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, options);
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const isJson = contentType.includes('application/json');

    if (!isJson) {
      // Non-JSON response (e.g., HTML error page like "The page cannot be found" or 502 Bad Gateway)
      let rawText = '';
      try {
        rawText = await response.text();
      } catch (readErr) {
        rawText = '(본문 읽기 실패)';
      }

      // Grab first 200 characters for error detail
      const preview = rawText.slice(0, 200).trim();

      // Log to server/browser console as required
      console.error(`[API Error] Non-JSON response from ${url} (HTTP ${response.status}):`, preview);

      return {
        ok: false,
        error: '서버 응답을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        errorDetail: {
          status: response.status,
          url,
          isJson: false,
          rawPreview: preview || '(응답 내용 없음)',
          message: `서버가 JSON이 아닌 형식(${contentType || '알 수 없음'})으로 응답했습니다.`,
        },
      };
    }

    // JSON response
    const parsed = await response.json();

    if (!response.ok) {
      const errorMsg =
        parsed.error || parsed.message || `서버 오류가 발생했습니다. (HTTP ${response.status})`;
      return {
        ok: false,
        error: errorMsg,
        errorDetail: {
          status: response.status,
          url,
          isJson: true,
          rawPreview: JSON.stringify(parsed).slice(0, 200),
          message: errorMsg,
        },
      };
    }

    // Handle payload-level failure if { success: false, error: ... }
    if (parsed.success === false) {
      const errorMsg = parsed.error || '요청 처리에 실패했습니다.';
      return {
        ok: false,
        error: errorMsg,
        errorDetail: {
          status: response.status,
          url,
          isJson: true,
          rawPreview: JSON.stringify(parsed).slice(0, 200),
          message: errorMsg,
        },
      };
    }

    return {
      ok: true,
      data: parsed,
    };
  } catch (netErr: any) {
    console.error(`[Network Error] Failed to fetch ${url}:`, netErr);
    return {
      ok: false,
      error: '네트워크 연결 또는 서버 통신에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      errorDetail: {
        status: 0,
        url,
        isJson: false,
        rawPreview: netErr.message || String(netErr),
        message: '클라이언트와 서버 간의 네트워크 통신 오류가 발생했습니다.',
      },
    };
  }
}
