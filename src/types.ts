export type ThemeMode = 'dark' | 'light'

export type Locale = 'en' | 'vi'

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

export interface Card {
  id: string
  front: string
  back: string
  tags: string[]
  lastReviewedAt?: string
  dueAt?: string
  ease: number
  interval: number
  step: number
}

export interface Deck {
  id: string
  name: string
  description: string
  language: string
  category: string
  cards: Card[]
  lastStudiedAt?: string
  createdAt: string
}

export interface StudyStats {
  streakDays: number
  reviewsToday: number
  minutesToday: number
  totalReviews: number
}

export interface StudySession {
  deckId: string
  total: number
  reviewed: number
  currentIndex: number
  updatedAt: string
}

export interface AppSettings {
  theme: ThemeMode
  locale: Locale
  showLibrary: boolean
  dailyGoal: number
  ai: AiSettings
}

export interface AiSettings {
  enabled: boolean
  apiKey: string
  endpoint: string
  model: string
}

export interface AppState {
  settings: AppSettings
  decks: Deck[]
  selectedDeckId: string
  stats: StudyStats
  studySessions: Record<string, StudySession>
}
