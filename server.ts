import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Support up to 15MB for PDF base64 payloads
app.use(express.json({ limit: '15mb' }));

// Helper to get Gemini client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. AI Studio의 Secrets 설정을 확인해 주세요.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Helper to call generateContent with retry and friendly 429 error messages
async function callGeminiWithRetry(ai: GoogleGenAI, params: any, maxRetries = 2): Promise<any> {
  let attempt = 0;
  while (true) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      attempt++;
      const errMsg = err?.message || '';
      const isRateLimit =
        err?.status === 429 ||
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('quota');

      if (isRateLimit && attempt <= maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
        continue;
      }
      if (isRateLimit) {
        throw new Error(
          'Gemini API 호출 한도(429)에 일시적으로 도달했습니다. 약 30초 뒤 다시 시도해 주시거나, AI Studio의 Settings > Secrets 패널에서 유료 결제가 연결된 키를 설정해 주세요.'
        );
      }
      throw err;
    }
  }
}

// 1. Resume Parse Endpoint
app.post('/api/resume/parse', async (req: Request, res: Response) => {
  try {
    const { text, pdfBase64, mimeType } = req.body;
    if (!text && !pdfBase64) {
      res.status(400).json({ error: '이력서 텍스트 또는 PDF 파일을 입력해 주세요.' });
      return;
    }

    const ai = getGeminiClient();
    const parts: any[] = [];

    if (pdfBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'application/pdf',
          data: pdfBase64,
        },
      });
    }

    const promptText = `
당신은 대한민국 제조 직무(품질관리, 스마트팩토리, 생산기술) 채용 전문가입니다.
제공된 이력서/포트폴리오 내용에서 다음 7개 항목을 정확히 추출하여 지정된 JSON 형식으로 반환해 주세요.

[추출 규칙]
1. 전공(major): 학과 및 전공명 (예: 기계공학과, 산업공학과, 전자공학과 등)
2. 자격증(certifications): 취득한 자격증 목록 (쉼표 구분, 예: 품질경영기사, 6시그마 그린벨트, 일반기계기사 등)
3. 어학(languages): 어학 성적 (쉼표 구분, 예: TOEIC 850점, OPIC IM2, 토익스피킹 AL 등)
4. 사용 도구(tools): 활용 가능한 툴 및 소프트웨어 (쉼표 구분, 예: Minitab, AutoCAD, CATIA, PLC, MES, Excel 피벗, Python 등)
5. 경험(experience): 캡스톤 프로젝트, 인턴, 실습, 수상, 학부연구생 등 제조/공학 관련 핵심 경험 요약
6. 희망 직무(desiredRole): 이력 내용상 가장 적합한 직무 ('품질관리', '스마트팩토리', '생산기술' 중 하나 선택 또는 이력서에 명시된 직무)
7. 희망 지역(desiredLocation): 이력서에 기재된 희망 근무지 또는 거주지 기반 지역 (확인되지 않으면 빈 문자열)
8. 이력서에 직접 명시되지 않은 내용은 절대 임의로 지어내지 말고 빈 문자열('')로 두세요.

${text ? `\n\n[입력된 이력서 텍스트]:\n${text}` : ''}
`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            major: { type: Type.STRING, description: '전공' },
            certifications: { type: Type.STRING, description: '자격증' },
            languages: { type: Type.STRING, description: '어학' },
            tools: { type: Type.STRING, description: '사용 도구' },
            experience: { type: Type.STRING, description: '경험 및 프로젝트 요약' },
            desiredRole: { type: Type.STRING, description: '희망 직무 (품질관리, 스마트팩토리, 생산기술 등)' },
            desiredLocation: { type: Type.STRING, description: '희망 지역' },
          },
          required: ['major', 'certifications', 'languages', 'tools', 'experience', 'desiredRole', 'desiredLocation'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Resume parse error:', error);
    res.status(500).json({
      error: `이력서 분석 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`,
    });
  }
});

// Helper to format today's date in Korean
function getTodayString(): { todayStr: string; currentYear: number; dateIso: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const dateIso = now.toISOString().split('T')[0];
  const todayStr = `${currentYear}년 ${month}월 ${day}일`;
  return { todayStr, currentYear, dateIso };
}

// 2. Job Recommendation Endpoint with 2-Stage Google Search
app.post('/api/jobs/recommend', async (req: Request, res: Response) => {
  try {
    const { resume, filterRole, filterLocation } = req.body;
    if (!resume) {
      res.status(400).json({ error: '이력 정보가 필요합니다.' });
      return;
    }

    const ai = getGeminiClient();
    const { todayStr, currentYear } = getTodayString();

    const targetRole = filterRole || resume.desiredRole || '품질관리';
    const targetLocation = (filterLocation || resume.desiredLocation || '').trim();
    const locKeyword = targetLocation && targetLocation !== '전국' ? targetLocation : '';

    // Step 1: Formulate at least 3 job-centric search queries with location and current year
    const queries: string[] = [];
    if (targetRole.includes('품질')) {
      queries.push(`${currentYear} 품질관리 신입 채용 ${locKeyword}`.trim());
      queries.push(`${currentYear} 품질보증 QA QC 신입 채용`.trim());
      queries.push(`${currentYear} 생산기술 품질 엔지니어 인턴 채용 ${locKeyword}`.trim());
    } else if (targetRole.includes('스마트')) {
      queries.push(`${currentYear} 스마트팩토리 신입 채용 ${locKeyword}`.trim());
      queries.push(`${currentYear} 스마트공장 MES 공정데이터 신입 채용`.trim());
      queries.push(`${currentYear} 제조 자동화 PLC 인턴 기업 연계 교육`.trim());
    } else if (targetRole.includes('생산')) {
      queries.push(`${currentYear} 생산기술 신입 채용 ${locKeyword}`.trim());
      queries.push(`${currentYear} 공정설계 라인엔지니어 신입 채용 ${locKeyword}`.trim());
      queries.push(`${currentYear} 제조 설비보전 생산기술 인턴 채용`.trim());
    } else {
      queries.push(`${currentYear} 품질관리 신입 채용 ${locKeyword}`.trim());
      queries.push(`${currentYear} 스마트팩토리 신입 채용 ${locKeyword}`.trim());
      queries.push(`${currentYear} 생산기술 신입 채용 ${locKeyword}`.trim());
    }

    // Include major or cert keyword if available to strengthen query relevance
    if (resume.certifications && resume.certifications.trim()) {
      const topCert = resume.certifications.split(',')[0].trim();
      queries.push(`${currentYear} ${topCert} 우대 신입 채용`.trim());
    }

    // Step 2: 1단계 (Stage 1) - Call Gemini with googleSearch tool, plain text only, NO JSON schema/responseMimeType!
    const targetQueries = queries.slice(0, 3);
    const stage1Results: Array<{ query: string; text: string; groundingLinks: Array<{ title: string; url: string }> }> = [];

    for (const q of targetQueries) {
      try {
        const stage1Prompt = `
오늘 날짜: ${todayStr} (현재 연도: ${currentYear}년)
검색 키워드: "${q}"

대한민국 제조기업(대기업, 중견기업, 공공기관 등)에서 현재 모집 중인 최신 신입 채용공고, 인턴십, 또는 기업 연계 교육(부트캠프) 정보를 Google 검색으로 찾아 상세히 알려주세요.
각 공고의 회사명, 직무명, 활동 유형, 근무지, 마감일, 주요 자격요건을 본문에 자세히 서술해 주세요.
`;
        const response = await callGeminiWithRetry(ai, {
          model: 'gemini-3.8-flash',
          contents: stage1Prompt,
          config: {
            tools: [{ googleSearch: {} }],
            // Strict rule: NO responseMimeType, NO responseSchema here!
          },
        });

        const text = response.text || '';
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const groundingLinks: Array<{ title: string; url: string }> = [];

        chunks.forEach((chunk: any) => {
          const uri = chunk.web?.uri;
          const title = chunk.web?.title || '';
          if (uri && (uri.startsWith('http://') || uri.startsWith('https://'))) {
            groundingLinks.push({ title, url: uri });
          }
        });

        stage1Results.push({ query: q, text, groundingLinks });
      } catch (err: any) {
        console.warn(`Query "${q}" failed:`, err?.message || err);
      }
    }

    // Aggregate Stage 1 texts and unique grounding URLs
    let combinedStage1Text = '';
    const allLinksMap = new Map<string, string>(); // url -> title
    const executedQueries: string[] = [];

    stage1Results.forEach((data) => {
      executedQueries.push(data.query);
      combinedStage1Text += `\n--- [검색어: "${data.query}"] ---\n${data.text}\n`;
      data.groundingLinks.forEach((l) => {
        if (!allLinksMap.has(l.url)) {
          allLinksMap.set(l.url, l.title);
        }
      });
    });

    const uniqueGroundingLinks = Array.from(allLinksMap.entries()).map(([url, title]) => ({
      title,
      url,
    }));

    const queriesUsedToReturn = targetQueries;

    // Step 3: 2단계 (Stage 2) - Call Gemini WITHOUT search tool to format into structured JSON
    let verifiedJobs: any[] = [];

    if (uniqueGroundingLinks.length > 0 && combinedStage1Text.trim().length > 0) {
      const stage2Prompt = `
당신은 대한민국 제조 직무(품질관리, 스마트팩토리, 생산기술) 채용 전문 컨설턴트입니다.
오늘 날짜는 ${todayStr}입니다.

아래는 1단계 Google 실시간 검색을 통해 수집된 채용공고 텍스트와, 검색 시스템(groundingChunks)에서 확인된 실제 출처 웹 링크 목록입니다.

[지원자 이력]
- 희망 직무: ${targetRole}
- 희망 지역: ${targetLocation || '전국'}
- 전공: ${resume.major || '미입력'}
- 자격증: ${resume.certifications || '미입력'}
- 어학: ${resume.languages || '미입력'}
- 사용 도구: ${resume.tools || '미입력'}
- 경험: ${resume.experience || '미입력'}

[1단계 검색 결과 본문]
${combinedStage1Text}

[검증된 실제 출처 웹 링크 목록 (groundingChunks)]
${JSON.stringify(uniqueGroundingLinks, null, 2)}

[2단계 구조화 및 검증 규칙 - 절대 준수]
1. 링크(sourceUrl)는 위 [검증된 실제 출처 웹 링크 목록]에 실제로 존재하는 URL만 사용해야 합니다. 목록에 없는 링크를 지어내거나 변형하지 마세요.
2. 위 출처 링크와 직접 연계된 공고만 최대 5건을 선별하세요.
3. 마감일을 검색 결과에서 명확히 찾지 못하더라도 출처 링크가 유효하다면 카드에 포함하고, 마감일은 '확인 필요'로 적어주세요.
4. 근무지를 명확히 확인하지 못하면 '확인 필요'로 적어주세요.
5. 여러 검색 결과에서 중복된 공고는 하나로 통합(Deduplicate)하세요.
6. 지원자의 이력과 공고 요건을 비교하여:
   - recommendationReason: 추천 이유 (1~2문장)
   - matchingPoints: 지원자 이력과 일치하는 강점
   - gaps: 부족하거나 확인이 필요한 점
7. 만약 출처 링크와 매칭되는 유효한 공고가 없다면 빈 배열([])을 반환하세요.
`;

      const stage2Response = await callGeminiWithRetry(ai, {
        model: 'gemini-3.8-flash',
        contents: stage2Prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                company: { type: Type.STRING, description: '회사명' },
                role: { type: Type.STRING, description: '직무명' },
                type: { type: Type.STRING, description: "'신입 채용' | '인턴' | '기업 연계 교육'" },
                location: { type: Type.STRING, description: "근무지 (불확실 시 '확인 필요')" },
                deadline: { type: Type.STRING, description: "마감일 (불확실 시 '확인 필요')" },
                recommendationReason: { type: Type.STRING, description: '추천 이유' },
                matchingPoints: { type: Type.STRING, description: '이력과 맞는 점' },
                gaps: { type: Type.STRING, description: '부족한 점' },
                sourceUrl: { type: Type.STRING, description: '반드시 groundingChunks 목록에 있는 실제 URL' },
              },
              required: ['company', 'role', 'type', 'location', 'deadline', 'recommendationReason', 'matchingPoints', 'gaps', 'sourceUrl'],
            },
          },
        },
      });

      const parsed = JSON.parse(stage2Response.text || '[]');
      if (Array.isArray(parsed)) {
        // Double-check: ensure URL is in uniqueGroundingLinks
        const validUrlSet = new Set(uniqueGroundingLinks.map((l) => l.url));
        verifiedJobs = parsed
          .filter((job) => job.company && job.role && validUrlSet.has(job.sourceUrl))
          .slice(0, 5)
          .map((job) => ({
            company: job.company,
            role: job.role,
            type: ['신입 채용', '인턴', '기업 연계 교육'].includes(job.type) ? job.type : '신입 채용',
            location: job.location && job.location.trim() ? job.location : '확인 필요',
            deadline: job.deadline && job.deadline.trim() ? job.deadline : '확인 필요',
            recommendationReason: job.recommendationReason,
            matchingPoints: job.matchingPoints,
            gaps: job.gaps,
            sourceUrl: job.sourceUrl,
          }));
      }
    }

    // Step 4: Handle 0 results with fallback recommendations and portal direct links
    const primarySearchWord = `${targetRole} 신입`;
    const fallback = {
      recommendedRoles: [
        '품질관리 / 품질보증(QA) 엔지니어',
        '스마트팩토리 MES / 제조 데이터 엔지니어',
        '생산기술 / 공정설계(PE) 엔지니어',
      ],
      recommendedKeywords: [
        `${targetRole} 신입 채용`,
        `${targetRole} ${targetLocation || '수도권'} 채용`,
        resume.certifications ? `${resume.certifications.split(',')[0]} 우대 채용` : `${targetRole} 인턴`,
      ],
      externalLinks: [
        {
          platform: '사람인',
          name: `사람인에서 '${primarySearchWord}' 공고 검색`,
          url: `https://www.saramin.co.kr/zf_user/search?searchword=${encodeURIComponent(primarySearchWord)}`,
        },
        {
          platform: '잡코리아',
          name: `잡코리아에서 '${primarySearchWord}' 공고 검색`,
          url: `https://www.jobkorea.co.kr/Search/?stext=${encodeURIComponent(primarySearchWord)}`,
        },
        {
          platform: '고용24',
          name: `고용24에서 '${primarySearchWord}' 일자리 검색`,
          url: `https://www.work24.go.kr/wk/a/b/1200/retriveEmpSrchList.do?keyword=${encodeURIComponent(primarySearchWord)}`,
        },
      ],
    };

    res.json({
      success: true,
      queriesUsed: queriesUsedToReturn,
      jobs: verifiedJobs,
      fallback: verifiedJobs.length === 0 ? fallback : undefined,
    });
  } catch (error: any) {
    console.error('Job recommendation error:', error);
    res.status(500).json({
      error: `공고 추천 중 서버 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`,
    });
  }
});

// 3. Job Diagnostic (Fit Analysis) Endpoint
app.post('/api/jobs/diagnose', async (req: Request, res: Response) => {
  try {
    const { company, role, jobPostingText, resume } = req.body;
    if (!company || !role || !jobPostingText) {
      res.status(400).json({ error: '회사명, 직무명, 공고 본문을 모두 입력해 주세요.' });
      return;
    }
    if (!resume || (!resume.major && !resume.tools && !resume.experience)) {
      res.status(400).json({ error: '먼저 [내 이력] 탭에서 이력을 입력하고 저장해 주세요.' });
      return;
    }

    const ai = getGeminiClient();

    const prompt = `
당신은 대한민국 제조 직무(품질관리, 스마트팩토리, 생산기술) 채용 평가 전문가입니다.
사용자가 입력한 공고 본문과 지원자의 이력을 객관적으로 정밀 비교 분석해 주세요.

[반드시 준수해야 하는 규칙]
1. 공고 및 이력에 직접 명시되지 않은 내용은 절대 추측하지 말고 '확인 필요'로 표시하세요.
2. 지원자의 이력에 직접 적힌 명확한 근거가 없으면 절대로 '충족'으로 판정하지 마세요. (미충족 또는 부분 충족 또는 확인 필요로 판정)
3. 합격 가능성이나 점수(예: 80점, 합격 확률 70% 등)는 일체 표기하지 마세요.
4. "exactQuote"(공고 원문 문구)는 반드시 아래 제공된 [공고 본문]에 실제로 존재하는 문장 또는 구문이어야 합니다. 없는 문장을 지어내지 마세요.
5. 판정(verdict)은 반드시 4가지 중 하나여야 합니다: '충족', '부분 충족', '미충족', '확인 필요'
6. 미충족/부분충족 항목들을 우선순위(중요도순: '높음', '보통', '낮음')로 정렬하여 구체적인 보완 계획(다음에 할 일)을 도출하세요.

[회사명]: ${company}
[직무명]: ${role}

[지원자 이력]
- 전공: ${resume.major || '없음'}
- 자격증: ${resume.certifications || '없음'}
- 어학: ${resume.languages || '없음'}
- 사용 도구: ${resume.tools || '없음'}
- 경험 및 프로젝트: ${resume.experience || '없음'}
- 희망 직무: ${resume.desiredRole || '없음'}
- 희망 지역: ${resume.desiredLocation || '없음'}

[공고 본문]:
${jobPostingText}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.OBJECT,
              properties: {
                responsibilities: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '공고의 주요 업무 요약 리스트',
                },
                requiredQualifications: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '공고의 필수 요건 리스트',
                },
                preferredQualifications: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '공고의 우대사항 리스트',
                },
                keywords: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '공고의 핵심 키워드 리스트 (예: SPC, Minitab, PLC, 공정개선 등)',
                },
              },
              required: ['responsibilities', 'requiredQualifications', 'preferredQualifications', 'keywords'],
            },
            comparisonTable: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: {
                    type: Type.STRING,
                    description: "'필수 요건' 또는 '우대사항' 또는 '주요 업무 요건'",
                  },
                  requirement: {
                    type: Type.STRING,
                    description: '평가 대상 요건 명칭',
                  },
                  verdict: {
                    type: Type.STRING,
                    description: "'충족' | '부분 충족' | '미충족' | '확인 필요'",
                  },
                  exactQuote: {
                    type: Type.STRING,
                    description: '공고 원문에 실제로 존재하는 문장',
                  },
                  resumeEvidence: {
                    type: Type.STRING,
                    description: '이력서에서 직접 확인된 구체적 근거 또는 이력에 언급 없음',
                  },
                  actionItem: {
                    type: Type.STRING,
                    description: '다음에 할 일 (구체적인 실행 과제)',
                  },
                },
                required: ['category', 'requirement', 'verdict', 'exactQuote', 'resumeEvidence', 'actionItem'],
              },
            },
            improvementPlan: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  priority: {
                    type: Type.STRING,
                    description: "'높음' | '보통' | '낮음'",
                  },
                  unmetRequirement: {
                    type: Type.STRING,
                    description: '보완이 필요한 항목',
                  },
                  exactQuote: {
                    type: Type.STRING,
                    description: '공고 원문 근거 문장',
                  },
                  gapReason: {
                    type: Type.STRING,
                    description: '부족 원인 분석',
                  },
                  concreteAction: {
                    type: Type.STRING,
                    description: '구체적인 보완 실행 방안 (자격증, 실습, 포트폴리오 준비 등)',
                  },
                },
                required: ['priority', 'unmetRequirement', 'exactQuote', 'gapReason', 'concreteAction'],
              },
            },
          },
          required: ['summary', 'comparisonTable', 'improvementPlan'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error('Job diagnosis error:', error);
    res.status(500).json({
      error: `공고 진단 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`,
    });
  }
});

// 4-1. Fetch Today's Hot Manufacturing Issues with 2-Stage Google Search
app.post('/api/trends/fetch-hot-issues', async (req: Request, res: Response) => {
  try {
    const { targetRole } = req.body;
    const role = targetRole || '품질관리, 스마트팩토리, 생산기술';
    const ai = getGeminiClient();
    const { todayStr, currentYear } = getTodayString();

    const searchQuery = `${currentYear}년 최근 한국 제조업 뉴스 스마트팩토리 제조AI 품질 배터리 반도체 조선 방산 공급망`;
    const queriesUsed = [searchQuery];

    // Stage 1: Google Search, plain text only, NO JSON schema / responseMimeType
    const stage1Prompt = `
오늘 날짜: ${todayStr} (${currentYear}년)
최근 30일 동안의 대한민국 제조업 핵심 산업 뉴스를 Google 검색으로 찾아주세요.
주요 검색 분야: 스마트팩토리, 제조 AI, 품질 및 인증 규제, 전기차 및 배터리, 반도체 제조 공정, 조선/해양, 방산, 글로벌 관세 및 공급망 이슈.

최근 언론 및 포털에서 반복적으로 다루어진 핫이슈와 주요 제조기업(현대차, 삼성, LG, 포스코, 한화 등)의 기술/투자 동향을 본문 텍스트로 자세히 정리해 주세요.
`;

    const stage1Response = await callGeminiWithRetry(ai, {
      model: 'gemini-3.8-flash',
      contents: stage1Prompt,
      config: {
        tools: [{ googleSearch: {} }],
        // Strict: NO responseMimeType, NO responseSchema here!
      },
    });

    const stage1Text = stage1Response.text || '';
    const chunks = stage1Response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundingLinks: Array<{ title: string; url: string }> = [];

    chunks.forEach((chunk: any) => {
      const uri = chunk.web?.uri;
      const title = chunk.web?.title || '';
      if (uri && (uri.startsWith('http://') || uri.startsWith('https://'))) {
        groundingLinks.push({ title, url: uri });
      }
    });

    const uniqueLinks = Array.from(
      new Map(groundingLinks.map((l) => [l.url, l])).values()
    );

    let issues: any[] = [];

    // Stage 2: Call Gemini WITHOUT search tool to structure into top 5 hot issues with responseMimeType: 'application/json'
    if (uniqueLinks.length > 0 && stage1Text.trim().length > 0) {
      const stage2Prompt = `
당신은 대한민국 제조업 취업 멘토이자 산업 분석가입니다.
오늘 날짜는 ${todayStr}입니다.
지원자의 희망 직무는 '${role}'입니다.

아래는 1단계 Google 실시간 검색을 통해 수집된 최근 30일 제조업 뉴스 텍스트와, 검색 시스템(groundingChunks)에서 확인된 실제 출처 기사 웹 링크 목록입니다.

[1단계 검색 결과 본문]
${stage1Text}

[검증된 실제 출처 기사 링크 목록 (groundingChunks)]
${JSON.stringify(uniqueLinks, null, 2)}

[엄격한 2단계 구조화 규칙 - 절대 준수]
1. 여러 언론 및 출처에서 반복적으로 다루어진 핵심 핫이슈를 우선하여 최대 5개를 선정하세요.
2. 각 이슈에는 반드시 위 [검증된 실제 출처 기사 링크 목록]에 실제로 존재하는 출처 링크를 1개 이상 "sourceUrls" 배열에 포함해야 합니다.
   - 출처 링크 목록에 없는 임의의 링크를 만들지 마세요.
   - 출처 링크가 없는 이슈는 절대로 보여주지 마세요 (출처 없는 이슈는 목록에서 완전 제외).
3. 보도 날짜(date)를 본문에서 명확히 확인하지 못하면 '확인 필요'로 표기하세요.
4. 각 이슈마다 다음 항목을 충실히 작성하세요:
   - title: 이슈 제목
   - domain: 분야 ('스마트팩토리' | '제조 AI' | '품질' | '전기차/배터리' | '반도체' | '조선' | '방산' | '관세/공급망' 등)
   - date: 보도 날짜 (미확인 시 '확인 필요')
   - threeLineSummary: 핵심 내용 3줄 요약 (문자열 3개 배열)
   - whyItMatters: 제조업계 관점에서 왜 중요한지
   - roleRelevance: 지원자의 희망 직무('${role}') 관점에서의 구체적인 관련성
   - selfIntroMaterial: 자기소개서 지원동기 및 직무역량 문항에 활용할 수 있는 구체적인 소재
   - interviewQuestions: 면접관이 물어볼 수 있는 예상 면접 질문 3개 (question, intent, answerTip)
   - sourceUrls: [{ title, url }] (반드시 groundingChunks 목록에 있는 링크)
`;

      const stage2Response = await callGeminiWithRetry(ai, {
        model: 'gemini-3.8-flash',
        contents: stage2Prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: '이슈 제목' },
                domain: { type: Type.STRING, description: '분야' },
                date: { type: Type.STRING, description: "보도 날짜 (미확인 시 '확인 필요')" },
                threeLineSummary: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '핵심 내용 3줄',
                },
                whyItMatters: { type: Type.STRING, description: '왜 중요한지' },
                roleRelevance: { type: Type.STRING, description: '희망 직무와의 관련성' },
                selfIntroMaterial: { type: Type.STRING, description: '자기소개서 작성 소재' },
                interviewQuestions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING, description: '예상 질문' },
                      intent: { type: Type.STRING, description: '질문 의도' },
                      answerTip: { type: Type.STRING, description: '답변 팁' },
                    },
                    required: ['question', 'intent', 'answerTip'],
                  },
                  description: '예상 질문 3개',
                },
                sourceUrls: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      url: { type: Type.STRING },
                    },
                    required: ['title', 'url'],
                  },
                  description: '반드시 groundingChunks 목록에 있는 출처 링크 1개 이상',
                },
              },
              required: [
                'title',
                'domain',
                'date',
                'threeLineSummary',
                'whyItMatters',
                'roleRelevance',
                'selfIntroMaterial',
                'interviewQuestions',
                'sourceUrls',
              ],
            },
          },
        },
      });

      const parsed = JSON.parse(stage2Response.text || '[]');
      if (Array.isArray(parsed)) {
        const validUrlSet = new Set(uniqueLinks.map((l) => l.url));
        issues = parsed
          .filter((item) => {
            const verifiedSources = (item.sourceUrls || []).filter((s: any) => validUrlSet.has(s.url));
            return item.title && verifiedSources.length > 0;
          })
          .slice(0, 5)
          .map((item, idx) => ({
            id: `issue_${Date.now()}_${idx}`,
            title: item.title,
            domain: item.domain || '제조 혁신',
            date: item.date && item.date.trim() ? item.date : '확인 필요',
            threeLineSummary: Array.isArray(item.threeLineSummary) ? item.threeLineSummary : [],
            whyItMatters: item.whyItMatters || '',
            roleRelevance: item.roleRelevance || '',
            selfIntroMaterial: item.selfIntroMaterial || '',
            interviewQuestions: Array.isArray(item.interviewQuestions) ? item.interviewQuestions : [],
            sourceUrls: (item.sourceUrls || []).filter((s: any) => validUrlSet.has(s.url)),
          }));
      }
    }

    res.json({
      success: true,
      queriesUsed,
      targetRole: role,
      searchDate: todayStr,
      issues,
    });
  } catch (error: any) {
    console.error('Fetch hot issues error:', error);
    res.status(500).json({
      error: `제조업 핫이슈 검색 중 서버 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`,
    });
  }
});

// 4-2. Industry Trends Direct Article Analysis Endpoint
app.post('/api/trends/analyze', async (req: Request, res: Response) => {
  try {
    const { title, date, link, articleText, desiredRole } = req.body;
    if (!title || !articleText) {
      res.status(400).json({ error: '기사 제목과 본문을 입력해 주세요.' });
      return;
    }

    const ai = getGeminiClient();

    const prompt = `
당신은 대한민국 제조 직무(품질관리, 스마트팩토리, 생산기술) 취업 멘토입니다.
제공된 산업 기사 본문만을 바탕으로, 취업준비생의 면접과 자기소개서 대비를 위한 분석을 수행해 주세요.

[엄격한 분석 규칙]
1. 분석은 오직 입력된 기사 본문의 내용만을 근거로 삼아야 합니다.
2. 기사에 없는 내용은 절대 자의적으로 추측하지 말고, 정보가 불충분하면 '확인 필요'로 표기하세요.
3. 지원자의 희망 직무(${desiredRole || '제조 직무 - 품질관리/스마트팩토리/생산기술'}) 관점에서 다음 4가지를 정확히 작성하세요:
   - 핵심 내용 3줄 요약
   - 희망 직무와의 구체적 관련성
   - 자기소개서 활용 소재 (어떤 문항에 어떻게 녹여낼 수 있는지)
   - 예상 면접 질문 3개 및 답변 착안점

[기사 제목]: ${title}
[기사 날짜]: ${date || '확인 필요'}
[기사 링크]: ${link || '확인 필요'}

[기사 본문]:
${articleText}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            threeLineSummary: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '기사 핵심 내용 3줄',
            },
            roleRelevance: {
              type: Type.STRING,
              description: '희망 직무와의 관련성 설명',
            },
            selfIntroMaterials: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '자기소개서 작성 시 활용 가능한 구체적 소재 및 논리',
            },
            interviewQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING, description: '예상 면접 질문' },
                  intent: { type: Type.STRING, description: '면접관의 질문 의도' },
                  answerTip: { type: Type.STRING, description: '답변 핵심 포인트' },
                },
                required: ['question', 'intent', 'answerTip'],
              },
              description: '예상 면접 질문 3개',
            },
          },
          required: ['threeLineSummary', 'roleRelevance', 'selfIntroMaterials', 'interviewQuestions'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      success: true,
      data: {
        title,
        date: date || '확인 필요',
        link: link || '확인 필요',
        ...parsed,
      },
    });
  } catch (error: any) {
    console.error('Trend analysis error:', error);
    res.status(500).json({
      error: `산업 동향 분석 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`,
    });
  }
});

// 5. Job Comparison & Competency Clustering Endpoint
app.post('/api/comparison/cluster', async (req: Request, res: Response) => {
  try {
    const { diagnoses } = req.body;
    if (!diagnoses || !Array.isArray(diagnoses) || diagnoses.length === 0) {
      res.status(400).json({ error: '비교할 진단 결과가 없습니다.' });
      return;
    }

    // Extract all unmet / partially met items across all saved postings
    const unmetItems: Array<{ company: string; role: string; requirement: string; category: string; action: string }> = [];
    
    diagnoses.forEach((diag: any) => {
      const comp = diag.company || '미지정';
      const role = diag.role || '미지정';
      (diag.comparisonTable || []).forEach((row: any) => {
        if (row.verdict === '미충족' || row.verdict === '부분 충족') {
          unmetItems.push({
            company: comp,
            role,
            requirement: row.requirement,
            category: row.category,
            action: row.actionItem,
          });
        }
      });
      // Also include items from improvementPlan
      (diag.improvementPlan || []).forEach((plan: any) => {
        if (!unmetItems.some(item => item.requirement === plan.unmetRequirement && item.company === comp)) {
          unmetItems.push({
            company: comp,
            role,
            requirement: plan.unmetRequirement,
            category: '보완 항목',
            action: plan.concreteAction,
          });
        }
      });
    });

    if (unmetItems.length === 0) {
      res.json({
        success: true,
        data: {
          clusters: [],
          topCompetencies: [],
        },
      });
      return;
    }

    const ai = getGeminiClient();

    const prompt = `
당신은 대한민국 제조 직무(품질관리, 스마트팩토리, 생산기술) 역량 분석 전문가입니다.
사용자가 진단한 공고들에서 나타난 미충족/부분충족 요건 리스트입니다.
이 요건들을 비슷한 역량군(예: "SPC / 통계적 품질관리(Minitab)", "PLC 제어 및 설비 자동화", "품질경영기사 / 산업안전 자격", "공정 데이터 분석 / Python / SQL", "MES / 스마트공장 시스템 운영", "CAD / 도면 설계 및 3D 모델링", "ISO 9001 / IATF 16949 규격 이해" 등)으로 군집화(Clustering)하고 빈도수를 집계해 주세요.

[미충족/부분충족 항목 리스트]:
${JSON.stringify(unmetItems, null, 2)}

[요청 사항]
1. 군집화된 역량 목록(clusters)을 빈도수(count)가 높은 순서대로 정렬해 주세요.
2. 가장 많이 나온 역량 상위 3개(topCompetencies)를 선정하고, 각 역량별로 제조 취준생이 지금 당장 실행할 수 있는 구체적인 '다음에 할 일'(추천 자격증, 학습 코스, 포트폴리오 제작 팁)을 제시해 주세요.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            clusters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  competencyName: { type: Type.STRING, description: '역량명 (예: 통계적 공정관리(SPC)/Minitab)' },
                  count: { type: Type.INTEGER, description: '해당 역량이 미충족된 빈도수' },
                  relatedRequirements: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: '포함된 실제 공고 요건 목록',
                  },
                },
                required: ['competencyName', 'count', 'relatedRequirements'],
              },
              description: '빈도수 순으로 정렬된 역량 군집 목록',
            },
            topCompetencies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  rank: { type: Type.INTEGER, description: '순위 (1, 2, 3)' },
                  competencyName: { type: Type.STRING, description: '역량명' },
                  frequencyText: { type: Type.STRING, description: '공고 출현 빈도 설명 (예: 진단한 공고 중 N건에서 요구)' },
                  nextAction: { type: Type.STRING, description: '구체적인 다음에 할 일 및 보완 가이드' },
                  recommendedResources: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: '추천 자격증, 강의, 학습 자료 목록',
                  },
                },
                required: ['rank', 'competencyName', 'frequencyText', 'nextAction', 'recommendedResources'],
              },
              description: '가장 많이 나온 역량 3개와 구체적 실행 방안',
            },
          },
          required: ['clusters', 'topCompetencies'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      success: true,
      data: parsed,
    });
  } catch (error: any) {
    console.error('Comparison clustering error:', error);
    res.status(500).json({
      error: `역량 비교 분석 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`,
    });
  }
});

// Dev mode with Vite middleware or Production static files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on http://0.0.0.0:${PORT}`);
  });
}

startServer();
