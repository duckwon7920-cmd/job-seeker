export interface ResumeData {
  major: string; // 전공
  certifications: string; // 자격증
  languages: string; // 어학
  tools: string; // 사용 도구
  experience: string; // 경험 및 프로젝트
  desiredRole: '품질관리' | '스마트팩토리' | '생산기술' | string; // 희망 직무
  desiredLocation: string; // 희망 지역
  updatedAt?: string;
}

export interface RecommendedJob {
  company: string;
  role: string;
  type: '신입 채용' | '인턴' | '기업 연계 교육';
  location: string;
  deadline: string; // '확인 필요' if unknown
  recommendationReason: string;
  matchingPoints: string;
  gaps: string;
  sourceUrl: string;
}

export interface ZeroResultFallback {
  recommendedRoles: string[];
  recommendedKeywords: string[];
  externalLinks: Array<{ name: string; url: string; platform: string }>;
}

export interface RecommendJobResponse {
  success: boolean;
  queriesUsed: string[];
  jobs: RecommendedJob[];
  fallback?: ZeroResultFallback;
  error?: string;
}

export interface ComparisonTableRow {
  category: '필수 요건' | '우대사항' | '주요 업무 요건' | string;
  requirement: string;
  verdict: '충족' | '부분 충족' | '미충족' | '확인 필요';
  exactQuote: string;
  resumeEvidence: string;
  actionItem: string;
}

export interface ImprovementPlanItem {
  priority: '높음' | '보통' | '낮음';
  unmetRequirement: string;
  exactQuote: string;
  gapReason: string;
  concreteAction: string;
}

export interface JobDiagnosisResult {
  id: string;
  createdAt: string;
  company: string;
  role: string;
  jobPostingUrl?: string;
  jobPostingText: string;
  summary: {
    responsibilities: string[];
    requiredQualifications: string[];
    preferredQualifications: string[];
    keywords: string[];
  };
  comparisonTable: ComparisonTableRow[];
  improvementPlan: ImprovementPlanItem[];
}

export interface InterviewQuestionItem {
  question: string;
  intent: string;
  answerTip: string;
}

export interface TrendAnalysisResult {
  id: string;
  createdAt: string;
  title: string;
  date: string;
  link: string;
  articleText: string;
  desiredRole: string;
  threeLineSummary: string[];
  roleRelevance: string;
  selfIntroMaterials: string[];
  interviewQuestions: InterviewQuestionItem[];
}

export interface ManufacturingIssue {
  id: string;
  title: string;
  domain: string;
  date: string;
  threeLineSummary: string[];
  whyItMatters: string;
  roleRelevance: string;
  selfIntroMaterial: string;
  interviewQuestions: InterviewQuestionItem[];
  sourceUrls: Array<{
    title: string;
    url: string;
  }>;
}

export interface SavedIssuesState {
  lastSearchedAt: string;
  targetRole: string;
  queriesUsed: string[];
  issues: ManufacturingIssue[];
}

export interface CompetencyCluster {
  competencyName: string;
  count: number;
  relatedRequirements: string[];
}

export interface TopCompetency {
  rank: number;
  competencyName: string;
  frequencyText: string;
  nextAction: string;
  recommendedResources: string[];
}

export interface ComparisonClusterResult {
  clusters: CompetencyCluster[];
  topCompetencies: TopCompetency[];
}
