import type { AppState } from './types'

export const STARTER_DECK_IDS = ['deck-ux', 'deck-jp', 'deck-dev'] as const

export const defaultState: AppState = {
  settings: {
    theme: 'dark',
    locale: 'vi',
    showLibrary: true,
    dailyGoal: 30,
  },
  decks: [],
  selectedDeckId: '',
  stats: {
    streakDays: 0,
    reviewsToday: 0,
    minutesToday: 0,
    totalReviews: 0,
  },
  studySessions: {},
}
