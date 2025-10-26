export enum Author {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
}

export interface TranscriptionEntry {
  author: Author;
  text: string;
}

export enum AppView {
  COACH = 'coach',
  RESUME = 'resume',
  TECHNICAL = 'technical',
  MOCK = 'mock',
}
