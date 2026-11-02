import { ResumeData, JobDiagnosisResult, TrendAnalysisResult, SavedIssuesState } from '../types';

const RESUME_KEY = 'mfg_job_diagnostic_resume_v1';
const DIAGNOSES_KEY = 'mfg_job_diagnostic_diagnoses_v1';
const TRENDS_KEY = 'mfg_job_diagnostic_trends_v1';
const ISSUES_KEY = 'mfg_job_diagnostic_issues_v1';

export function loadResume(): ResumeData {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) {
      return {
        major: '',
        certifications: '',
        languages: '',
        tools: '',
        experience: '',
        desiredRole: '품질관리',
        desiredLocation: '',
      };
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load resume from localStorage', e);
    return {
      major: '',
      certifications: '',
      languages: '',
      tools: '',
      experience: '',
      desiredRole: '품질관리',
      desiredLocation: '',
    };
  }
}

export function saveResume(resume: ResumeData): void {
  try {
    const toSave = { ...resume, updatedAt: new Date().toISOString() };
    localStorage.setItem(RESUME_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('Failed to save resume to localStorage', e);
  }
}

export function isResumeEmpty(resume: ResumeData | null | undefined): boolean {
  if (!resume) return true;
  return (
    !resume.major.trim() &&
    !resume.certifications.trim() &&
    !resume.languages.trim() &&
    !resume.tools.trim() &&
    !resume.experience.trim()
  );
}

export function loadDiagnoses(): JobDiagnosisResult[] {
  try {
    const raw = localStorage.getItem(DIAGNOSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load diagnoses from localStorage', e);
    return [];
  }
}

export function saveDiagnosis(diagnosis: JobDiagnosisResult): JobDiagnosisResult[] {
  try {
    const current = loadDiagnoses();
    // Replace if id exists or add to front
    const updated = [diagnosis, ...current.filter((d) => d.id !== diagnosis.id)];
    localStorage.setItem(DIAGNOSES_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save diagnosis to localStorage', e);
    return [];
  }
}

export function deleteDiagnosis(id: string): JobDiagnosisResult[] {
  try {
    const current = loadDiagnoses();
    const updated = current.filter((d) => d.id !== id);
    localStorage.setItem(DIAGNOSES_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to delete diagnosis from localStorage', e);
    return [];
  }
}

export function loadTrends(): TrendAnalysisResult[] {
  try {
    const raw = localStorage.getItem(TRENDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load trends from localStorage', e);
    return [];
  }
}

export function saveTrend(trend: TrendAnalysisResult): TrendAnalysisResult[] {
  try {
    const current = loadTrends();
    const updated = [trend, ...current.filter((t) => t.id !== trend.id)];
    localStorage.setItem(TRENDS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save trend to localStorage', e);
    return [];
  }
}

export function deleteTrend(id: string): TrendAnalysisResult[] {
  try {
    const current = loadTrends();
    const updated = current.filter((t) => t.id !== id);
    localStorage.setItem(TRENDS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to delete trend from localStorage', e);
    return [];
  }
}

export function loadSavedIssues(): SavedIssuesState | null {
  try {
    const raw = localStorage.getItem(ISSUES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Failed to load saved issues from localStorage', e);
    return null;
  }
}

export function saveSavedIssues(state: SavedIssuesState): void {
  try {
    localStorage.setItem(ISSUES_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save issues to localStorage', e);
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
}
