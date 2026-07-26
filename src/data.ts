import type { AppState } from './types'
import { FLUTTER_QUIZ_DECK_ID, flutterQuizDeck } from './flutterQuizDeck'

export const STARTER_DECK_IDS = ['deck-ux', 'deck-jp', 'deck-dev'] as const

export const defaultState: AppState = {
  settings: {
    theme: 'dark',
    locale: 'vi',
    showLibrary: true,
    dailyGoal: 30,
    ai: {
      enabled: false,
      apiKey: '',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
    },
  },
  decks: [flutterQuizDeck],
  selectedDeckId: FLUTTER_QUIZ_DECK_ID,
  stats: {
    streakDays: 0,
    reviewsToday: 0,
    minutesToday: 0,
    totalReviews: 0,
  },
  studySessions: {},
}
