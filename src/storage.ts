import { defaultState, STARTER_DECK_IDS } from './data'
import type { AppState, Deck, ReviewRating } from './types'

const STORAGE_KEY = 'memu-local-app-state'
const starterDeckIds = new Set<string>(STARTER_DECK_IDS)

const safeJsonParse = (value: string): AppState | null => {
  try {
    return JSON.parse(value) as AppState
  } catch {
    return null
  }
}

const sanitizeState = (state: AppState): AppState => {
  const decks = state.decks
    .filter((deck) => !starterDeckIds.has(deck.id))
    .map(normalizeDeck)
  const deckIds = new Set(decks.map((deck) => deck.id))
  const studySessions = Object.fromEntries(
    Object.entries(state.studySessions ?? {}).filter(([deckId, session]) => {
      if (!deckIds.has(deckId)) return false
      if (!session || typeof session !== 'object') return false
      return session.deckId === deckId
    }),
  )

  const selectedDeckId =
    decks.find((deck) => deck.id === state.selectedDeckId)?.id ??
    decks[0]?.id ??
    ''

  return {
    ...state,
    decks,
    selectedDeckId,
    studySessions,
  }
}

export const loadState = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return defaultState
  const parsed = safeJsonParse(stored)
  return parsed ? sanitizeState(parsed) : defaultState
}

export const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const resetState = (): AppState => defaultState

const normalizeCard = (deckId: string, card: Deck['cards'][number], index: number): Deck['cards'][number] => ({
  id: card.id || `${deckId}-card-${index}-${crypto.randomUUID()}`,
  front: card.front ?? '',
  back: card.back ?? '',
  tags: Array.isArray(card.tags) ? card.tags : [],
  lastReviewedAt: card.lastReviewedAt,
  dueAt: card.dueAt,
  ease: typeof card.ease === 'number' ? card.ease : 2.5,
  interval: typeof card.interval === 'number' ? card.interval : 1,
  step: typeof card.step === 'number' ? card.step : 0,
})

const normalizeDeck = (deck: Deck, index: number): Deck => {
  const deckId = deck.id || `deck-import-${index}-${crypto.randomUUID()}`

  return {
    id: deckId,
    name: deck.name?.trim() || `Imported deck ${index + 1}`,
    description: deck.description ?? '',
    language: deck.language ?? 'Imported',
    category: deck.category ?? 'Imported',
    createdAt: deck.createdAt ?? new Date().toISOString(),
    lastStudiedAt: deck.lastStudiedAt,
    cards: Array.isArray(deck.cards) ? deck.cards.map((card, cardIndex) => normalizeCard(deckId, card, cardIndex)) : [],
  }
}

export const createDeck = (
  state: AppState,
  deck: Pick<Deck, 'name' | 'description' | 'language' | 'category'>,
): AppState => {
  const nextDeck: Deck = {
    id: `deck-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    cards: [],
    ...deck,
  }

  return {
    ...state,
    decks: [nextDeck, ...state.decks],
    selectedDeckId: nextDeck.id,
  }
}

export const importDecks = (state: AppState, payload: Deck[] | AppState): AppState => {
  if (Array.isArray(payload)) {
    const decks = payload.map(normalizeDeck)

    return sanitizeState({
      ...state,
      decks: [...decks, ...state.decks],
      selectedDeckId: decks[0]?.id ?? state.selectedDeckId,
      studySessions: state.studySessions ?? {},
    })
  }

  return sanitizeState({
    ...payload,
    decks: Array.isArray(payload.decks) ? payload.decks.map(normalizeDeck) : state.decks,
    selectedDeckId: payload.selectedDeckId || payload.decks[0]?.id || state.selectedDeckId,
    studySessions: payload.studySessions ?? state.studySessions ?? {},
  })
}

const multipliers: Record<ReviewRating, number> = {
  again: 0.5,
  hard: 1.2,
  good: 1.8,
  easy: 2.4,
}

export const reviewCard = (state: AppState, deckId: string, cardId: string, rating: ReviewRating): AppState => {
  const decks = state.decks.map((deck) => {
    if (deck.id !== deckId) return deck

    const cards = deck.cards.map((card) => {
      if (card.id !== cardId) return card

      const nextInterval = Math.max(1, Math.round(card.interval * multipliers[rating]))
      const nextDue = new Date(Date.now() + nextInterval * 24 * 60 * 60 * 1000).toISOString()

      return {
        ...card,
        interval: nextInterval,
        ease: rating === 'again' ? Math.max(1.3, card.ease - 0.2) : Math.min(3.2, card.ease + 0.1),
        step: rating === 'again' ? 0 : card.step + 1,
        lastReviewedAt: new Date().toISOString(),
        dueAt: nextDue,
      }
    })

    return {
      ...deck,
      cards,
      lastStudiedAt: new Date().toISOString(),
    }
  })

  return {
    ...state,
    decks,
    stats: {
      ...state.stats,
      reviewsToday: state.stats.reviewsToday + 1,
      totalReviews: state.stats.totalReviews + 1,
      minutesToday: state.stats.minutesToday + 1,
    },
  }
}

export const resetDeckProgress = (state: AppState, deckId: string): AppState => {
  const decks = state.decks.map((deck) => {
    if (deck.id !== deckId) return deck

    return {
      ...deck,
      lastStudiedAt: undefined,
      cards: deck.cards.map((card) => ({
        ...card,
        interval: 1,
        ease: 2.5,
        step: 0,
        lastReviewedAt: undefined,
        dueAt: new Date().toISOString(),
      })),
    }
  })

  return {
    ...state,
    decks,
    studySessions: {
      ...state.studySessions,
      [deckId]: {
        deckId,
        total: decks.find((deck) => deck.id === deckId)?.cards.length ?? 0,
        reviewed: 0,
        currentIndex: 0,
        updatedAt: new Date().toISOString(),
      },
    },
  }
}

export const deleteDeck = (state: AppState, deckId: string): AppState =>
  sanitizeState({
    ...state,
    decks: state.decks.filter((deck) => deck.id !== deckId),
    studySessions: Object.fromEntries(Object.entries(state.studySessions ?? {}).filter(([id]) => id !== deckId)),
  })
