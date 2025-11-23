export interface UploadedFile {
  file: File;
  previewUrl: string;
}

export interface GeneratedPage {
  imageUrl: string;
  pageNumber: number;
}

export enum ProcessingStep {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SOLVING = 'SOLVING',
  GENERATING_PAGES = 'GENERATING_PAGES',
  VALIDATING = 'VALIDATING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface ProcessingState {
  step: ProcessingStep;
  message: string;
  progress: number; // 0 to 100
}