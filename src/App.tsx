import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  Download,
  FolderClosed,
  Home,
  LibraryBig,
  Maximize2,
  Minimize2,
  MoonStar,
  Search,
  Settings,
  Sparkles,
  SunMedium,
  Trash2,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { canUseAi, requestAnswerFeedback } from './ai'
import { parseImportFile } from './importers'
import { createDeck, deleteDeck, importDecks, loadState, resetDeckProgress, resetState, reviewCard, saveState } from './storage'
import type { AiSettings, AppState, Card, Deck, ReviewRating, StudySession, ThemeMode } from './types'

const navItems = [
  { key: 'home', icon: Home },
  { key: 'decks', icon: FolderClosed },
  { key: 'study', icon: BookOpen },
  { key: 'exam', icon: ClipboardCheck },
  { key: 'library', icon: LibraryBig },
  { key: 'stats', icon: BarChart3 },
  { key: 'settings', icon: Settings },
] as const

const routeMap = {
  home: '/',
  decks: '/decks',
  study: '/study',
  exam: '/exam',
  library: '/library',
  stats: '/stats',
  settings: '/settings',
} as const

function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { i18n, t } = useTranslation()

  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme
    document.documentElement.lang = state.settings.locale
    void i18n.changeLanguage(state.settings.locale)
    saveState(state)
  }, [i18n, state])

  const selectedDeck = useMemo(
    () => state.decks.find((deck) => deck.id === state.selectedDeckId) ?? state.decks[0],
    [state.decks, state.selectedDeckId],
  )

  const dueCount = useMemo(() => getDueCards(selectedDeck).length, [selectedDeck])

  const updateTheme = (theme: ThemeMode) =>
    setState((current) => ({ ...current, settings: { ...current.settings, theme } }))

  const updateLocale = (locale: AppState['settings']['locale']) =>
    setState((current) => ({ ...current, settings: { ...current.settings, locale } }))

  const updateLibrary = (showLibrary: boolean) =>
    setState((current) => ({ ...current, settings: { ...current.settings, showLibrary } }))

  const updateDailyGoal = (dailyGoal: number) =>
    setState((current) => ({ ...current, settings: { ...current.settings, dailyGoal } }))

  const updateAiSettings = (ai: AiSettings) =>
    setState((current) => ({ ...current, settings: { ...current.settings, ai } }))

  const addDeck = (deck: Pick<Deck, 'name' | 'description' | 'language' | 'category'>) =>
    setState((current) => createDeck(current, deck))

  const selectDeck = (deckId: string) =>
    setState((current) => ({ ...current, selectedDeckId: deckId }))

  const handleReview = (cardId: string, rating: ReviewRating) => {
    if (!selectedDeck) return
    setState((current) => reviewCard(current, selectedDeck.id, cardId, rating))
  }

  const handleStudySessionChange = (deckId: string, session: StudySession) => {
    setState((current) => ({
      ...current,
      studySessions: {
        ...current.studySessions,
        [deckId]: session,
      },
    }))
  }

  const handleResetDeck = () => {
    if (!selectedDeck) return
    setState((current) => resetDeckProgress(current, selectedDeck.id))
  }

  const handleDeleteDeck = (deck: Deck) => {
    if (!window.confirm(t('decks.deleteConfirm', { name: deck.name }))) return
    setState((current) => deleteDeck(current, deck.id))
  }

  const handleImport = async (file: File) => {
    try {
      const result = await parseImportFile(file)
      setState((current) => importDecks(current, result.payload))
      setImportFeedback({ type: 'success', message: result.summary })
    } catch (error) {
      const message = error instanceof Error ? error.message : t('import.error')
      setImportFeedback({ type: 'error', message })
    }
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'memu-noir-export.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleReset = () => setState(resetState())

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed((current) => !current)}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className="brand-block">
          <div className="brand-mark">M</div>
          <div className={`brand-copy ${sidebarCollapsed ? 'hidden' : ''}`}>
            <p className="eyebrow">{t('misc.privacyBadge')}</p>
            <h1>{t('brand')}</h1>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary">
          {navItems
            .filter((item) => item.key !== 'library' || state.settings.showLibrary)
            .map((item) => (
              <NavLink
                key={item.key}
                to={routeMap[item.key]}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}
                end={item.key === 'home'}
                title={t(`nav.${item.key}`)}
              >
                <item.icon size={18} />
                <span className={sidebarCollapsed ? 'hidden' : ''}>{t(`nav.${item.key}`)}</span>
              </NavLink>
            ))}
        </nav>

        <div className={`sidebar-footer ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <p>{t('misc.dueCards')}</p>
          <strong>{dueCount}</strong>
        </div>
      </aside>

      <main className="main-panel">
        <TopBar
          state={state}
          onThemeChange={updateTheme}
          onLocaleChange={updateLocale}
          onImport={handleImport}
          onExport={handleExport}
        />

        {importFeedback && (
          <div className={`feedback-banner ${importFeedback.type}`}>
            <span>{importFeedback.message}</span>
            <button className="ghost-button small" onClick={() => setImportFeedback(null)}>
              {t('import.dismiss')}
            </button>
          </div>
        )}

        <Routes>
          <Route path="/" element={<HomePage state={state} selectedDeck={selectedDeck} />} />
          <Route
            path="/decks"
            element={
              <DecksPage
                state={state}
                onAddDeck={addDeck}
                onDeleteDeck={handleDeleteDeck}
                onSelectDeck={selectDeck}
                selectedDeckId={selectedDeck?.id ?? ''}
              />
            }
          />
          <Route
            path="/study"
            element={
              <StudyPage
                deck={selectedDeck}
                stats={state.stats}
                onReview={handleReview}
                onDeleteDeck={() => selectedDeck && handleDeleteDeck(selectedDeck)}
                onResetDeck={handleResetDeck}
                studySession={selectedDeck ? state.studySessions[selectedDeck.id] : undefined}
                onStudySessionChange={handleStudySessionChange}
                aiSettings={state.settings.ai}
              />
            }
          />
          <Route path="/exam" element={<ExamPage deck={selectedDeck} />} />
          {state.settings.showLibrary && <Route path="/library" element={<LibraryPage />} />}
          <Route path="/stats" element={<StatsPage state={state} />} />
          <Route
            path="/settings"
            element={
              <SettingsPage
                state={state}
                onThemeChange={updateTheme}
                onLocaleChange={updateLocale}
                onToggleLibrary={updateLibrary}
                onDailyGoalChange={updateDailyGoal}
                onAiSettingsChange={updateAiSettings}
                onReset={handleReset}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function TopBar({
  state,
  onThemeChange,
  onLocaleChange,
  onImport,
  onExport,
}: {
  state: AppState
  onThemeChange: (theme: ThemeMode) => void
  onLocaleChange: (locale: AppState['settings']['locale']) => void
  onImport: (file: File) => Promise<void>
  onExport: () => void
}) {
  const { t } = useTranslation()

  return (
    <header className="topbar">
      <label className="search-box">
        <Search size={18} />
        <input placeholder={t('misc.search')} />
      </label>

      <div className="topbar-actions">
        <label
          className="ghost-button import-file-trigger"
          htmlFor="deck-import-input"
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              document.getElementById('deck-import-input')?.click()
            }
          }}
        >
          <Upload size={16} />
          {t('actions.importDeck')}
        </label>
        <button className="ghost-button" onClick={onExport}>
          <Download size={16} />
          {t('actions.exportData')}
        </button>
        <div className="segmented">
          <button
            className={state.settings.theme === 'dark' ? 'active' : ''}
            onClick={() => onThemeChange('dark')}
            aria-label={t('settings.dark')}
          >
            <MoonStar size={16} />
          </button>
          <button
            className={state.settings.theme === 'light' ? 'active' : ''}
            onClick={() => onThemeChange('light')}
            aria-label={t('settings.light')}
          >
            <SunMedium size={16} />
          </button>
        </div>
        <select
          className="locale-select"
          value={state.settings.locale}
          onChange={(event) => onLocaleChange(event.target.value as AppState['settings']['locale'])}
          aria-label={t('settings.language')}
        >
          <option value="vi">VI</option>
          <option value="en">EN</option>
        </select>
      </div>

      <input
        id="deck-import-input"
        className="file-input-visually-hidden"
        type="file"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void onImport(file)
          }
          event.currentTarget.value = ''
        }}
      />
    </header>
  )
}

function HomePage({
  state,
  selectedDeck,
}: {
  state: AppState
  selectedDeck?: Deck
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dueCards = getDueCards(selectedDeck).length
  const hasDecks = state.decks.length > 0

  return (
    <section className="page-grid">
      <div className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">{t('home.localOnly')}</p>
          <h2>{t('home.title')}</h2>
          <p>{t('home.subtitle')}</p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" onClick={() => navigate(hasDecks ? '/study' : '/decks')}>
            {hasDecks ? t('actions.continue') : t('actions.createDeck')}
          </button>
          <button className="ghost-button" onClick={() => navigate('/decks')}>
            {t('nav.decks')}
          </button>
        </div>
      </div>

      <div className="stats-row">
        <MetricCard label={t('home.dueToday')} value={String(totalDueCards(state.decks))} />
        <MetricCard label={t('home.activeDecks')} value={String(state.decks.length)} />
        <MetricCard label={t('home.streak')} value={String(state.stats.streakDays)} />
        <MetricCard label={t('stats.minutesToday')} value={`${state.stats.minutesToday}m`} />
      </div>

      <div className="content-columns">
        <article className="panel">
          <div className="panel-header">
            <h3>{t('home.focus')}</h3>
            <span>{selectedDeck ? selectedDeck.name : t('home.noDeckBadge')}</span>
          </div>
          <p>{selectedDeck ? t('home.focusText') : t('home.emptyText')}</p>

          {selectedDeck ? (
            <div className="focus-card">
              <div>
                <strong>{dueCards}</strong>
                <span>{t('misc.dueCards')}</span>
              </div>
              <div>
                <strong>{selectedDeck.cards.length}</strong>
                <span>{t('decks.cards')}</span>
              </div>
              <div>
                <strong>{selectedDeck.language}</strong>
                <span>{t('misc.deckLanguage')}</span>
              </div>
            </div>
          ) : (
            <div className="empty-card-actions">
              <button className="primary-button" onClick={() => navigate('/decks')}>
                {t('actions.createDeck')}
              </button>
              <span>{t('home.emptyHint')}</span>
            </div>
          )}
        </article>

        <article className="panel guide-panel">
          <div className="panel-header">
            <h3>{t('home.guideTitle')}</h3>
          </div>
          <div className="guide-list">
            <GuideStep number="1" title={t('home.guideStep1Title')} text={t('home.guideStep1Text')} />
            <GuideStep number="2" title={t('home.guideStep2Title')} text={t('home.guideStep2Text')} />
            <GuideStep number="3" title={t('home.guideStep3Title')} text={t('home.guideStep3Text')} />
          </div>
        </article>
      </div>

      {state.settings.showLibrary && (
        <article className="panel">
          <div className="panel-header">
            <h3>{t('home.optionalLibrary')}</h3>
          </div>
          <p>{t('home.optionalLibraryText')}</p>
        </article>
      )}
    </section>
  )
}

function DecksPage({
  state,
  onAddDeck,
  onDeleteDeck,
  onSelectDeck,
  selectedDeckId,
}: {
  state: AppState
  onAddDeck: (deck: Pick<Deck, 'name' | 'description' | 'language' | 'category'>) => void
  onDeleteDeck: (deck: Deck) => void
  onSelectDeck: (deckId: string) => void
  selectedDeckId: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    description: '',
    language: 'English',
    category: 'General',
  })

  return (
    <section className="page-grid">
      <div className="section-head">
        <div>
          <h2>{t('decks.title')}</h2>
          <p>{t('decks.subtitle')}</p>
        </div>
      </div>

      <div className="content-columns decks-layout">
        <article className="panel">
          <div className="panel-header">
            <h3>{t('decks.createTitle')}</h3>
          </div>

          <div className="form-grid">
            <label>
              <span>{t('decks.name')}</span>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label>
              <span>{t('decks.description')}</span>
              <input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </label>
            <label>
              <span>{t('decks.language')}</span>
              <input
                value={form.language}
                onChange={(event) => setForm({ ...form, language: event.target.value })}
              />
            </label>
            <label>
              <span>{t('decks.category')}</span>
              <input
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              />
            </label>
          </div>

          <button
            className="primary-button"
            onClick={() => {
              if (!form.name.trim()) return
              onAddDeck(form)
              setForm({ name: '', description: '', language: 'English', category: 'General' })
            }}
          >
            {t('actions.createDeck')}
          </button>
        </article>

        <article className="deck-browser">
          <div className="deck-list">
            {state.decks.length === 0 ? (
              <div className="panel empty-state">
                <h3>{t('decks.emptyTitle')}</h3>
                <p>{t('decks.empty')}</p>
              </div>
            ) : (
              state.decks.map((deck) => {
                const isActive = deck.id === selectedDeckId
                const dueCards = getDueCards(deck).length

                return (
                  <article key={deck.id} className={`deck-card ${isActive ? 'active' : ''}`}>
                    <button
                      className="deck-card-main"
                      onClick={() => {
                        onSelectDeck(deck.id)
                      }}
                    >
                      <div className="deck-card-copy">
                        <div className="deck-card-top">
                          <span className="pill">{deck.category}</span>
                          <span>{deck.language}</span>
                          {isActive && <span className="selected-label">{t('decks.selected')}</span>}
                        </div>
                        <h3>{deck.name}</h3>
                        <p>{deck.description}</p>
                      </div>
                      <div className="deck-card-meta">
                        <span>
                          <strong>{deck.cards.length}</strong> {t('decks.cards')}
                        </span>
                        <span>
                          <strong>{dueCards}</strong> {t('decks.due')}
                        </span>
                      </div>
                    </button>
                    <div className="deck-card-actions">
                      <button
                        className="primary-button small"
                        onClick={() => {
                          onSelectDeck(deck.id)
                          navigate('/study')
                        }}
                      >
                        <BookOpen size={14} />
                        {t('actions.studyDeck')}
                      </button>
                      <button className="ghost-button small danger-button icon-only" onClick={() => onDeleteDeck(deck)} title={t('actions.deleteDeck')}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </article>
      </div>
    </section>
  )
}

function StudyPage({
  deck,
  stats,
  onReview,
  onDeleteDeck,
  onResetDeck,
  studySession,
  onStudySessionChange,
  aiSettings,
}: {
  deck?: Deck
  stats: AppState['stats']
  onReview: (cardId: string, rating: ReviewRating) => void
  onDeleteDeck: () => void
  onResetDeck: () => void
  studySession?: StudySession
  onStudySessionChange: (deckId: string, session: StudySession) => void
  aiSettings: AiSettings
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dueCards = getDueCards(deck)
  const savedStudySession = studySession?.deckId === deck?.id ? studySession : undefined
  const [revealed, setRevealed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [aiFeedback, setAiFeedback] = useState('')
  const [aiFeedbackStatus, setAiFeedbackStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(savedStudySession?.currentIndex ?? 0, Math.max(dueCards.length - 1, 0)),
  )
  const [jumpValue, setJumpValue] = useState('')
  const [sessionProgress, setSessionProgress] = useState<StudySession>(() =>
    savedStudySession ?? {
      deckId: deck?.id ?? '',
      total: dueCards.length,
      reviewed: 0,
      currentIndex: 0,
      updatedAt: new Date().toISOString(),
    },
  )
  const activeIndex = dueCards.length > 0 ? Math.min(currentIndex, dueCards.length - 1) : 0
  const activeCard = dueCards[activeIndex]
  const sessionTotal =
    sessionProgress.deckId === deck?.id
      ? Math.max(sessionProgress.total, sessionProgress.reviewed + dueCards.length)
      : dueCards.length
  const sessionCurrent = activeCard ? Math.min(sessionProgress.reviewed + activeIndex + 1, Math.max(sessionTotal, 1)) : sessionTotal
  const completedCards = Math.min(sessionProgress.reviewed, Math.max(sessionTotal, 0))
  const progressPercent = sessionTotal > 0 ? Math.round((completedCards / sessionTotal) * 100) : 0
  const formattedFront = useMemo(() => formatStudyText(activeCard?.front ?? ''), [activeCard?.front])
  const formattedBack = useMemo(() => formatAnswerText(activeCard?.back ?? ''), [activeCard?.back])
  const frontHasHtml = useMemo(() => hasRichMarkup(activeCard?.front ?? ''), [activeCard?.front])
  const backHasHtml = useMemo(() => hasRichMarkup(activeCard?.back ?? ''), [activeCard?.back])

  const moveToCard = (nextIndex: number) => {
    if (dueCards.length === 0) return
    const clampedIndex = Math.min(Math.max(nextIndex, 0), dueCards.length - 1)
    setCurrentIndex(clampedIndex)

    if (deck) {
      const nextSession = {
        ...sessionProgress,
        deckId: deck.id,
        total: sessionTotal,
        currentIndex: clampedIndex,
        updatedAt: new Date().toISOString(),
      }

      setSessionProgress(nextSession)
      onStudySessionChange(deck.id, nextSession)
    }
  }

  const handleJumpToCard = (value: string) => {
    const targetNumber = Number(value)

    if (!Number.isFinite(targetNumber)) return

    moveToCard(Math.trunc(targetNumber) - 1)
    setJumpValue('')
  }

  const reviewCurrentCard = (rating: ReviewRating, nextIndex: number) => {
    if (!activeCard || !deck) return

    const nextRemaining = dueCards.length - 1
    const clampedNextIndex = Math.min(Math.max(nextIndex, 0), Math.max(nextRemaining - 1, 0))

    onReview(activeCard.id, rating)
    setSessionProgress((current) => {
      const reviewedBase = current.deckId === deck.id ? current.reviewed : 0
      const baseTotal = current.deckId === deck.id ? current.total : dueCards.length
      const total = Math.max(baseTotal, reviewedBase + dueCards.length)
      const reviewed = Math.min(reviewedBase + 1, Math.max(total, 1))

      const nextSession = {
        deckId: deck.id,
        total,
        reviewed,
        currentIndex: clampedNextIndex,
        updatedAt: new Date().toISOString(),
      }

      onStudySessionChange(deck.id, nextSession)
      return nextSession
    })
    setCurrentIndex(clampedNextIndex)
    setRevealed(false)
  }

  const handleNavigateWithReview = (targetIndex: number, rating: ReviewRating) => {
    if (!activeCard || !deck) {
      moveToCard(targetIndex)
      return
    }

    const shiftedTargetIndex = targetIndex > activeIndex ? targetIndex - 1 : targetIndex
    reviewCurrentCard(rating, shiftedTargetIndex)
  }

  const handleRateCard = (rating: ReviewRating) => {
    if (!activeCard || !deck) return

    const nextRemaining = dueCards.length - 1
    const nextIndex = Math.min(activeIndex, Math.max(nextRemaining - 1, 0))

    reviewCurrentCard(rating, nextIndex)
  }

  const handleResetDeckClick = () => {
    if (!deck) return

    onResetDeck()
    const nextSession = {
      deckId: deck.id,
      total: deck.cards.length,
      reviewed: 0,
      currentIndex: 0,
      updatedAt: new Date().toISOString(),
    }

    setSessionProgress(nextSession)
    onStudySessionChange(deck.id, nextSession)
    setCurrentIndex(0)
    setRevealed(false)
  }

  const handleRequestAiFeedback = async () => {
    if (!activeCard) return

    setAiFeedbackStatus('loading')
    setAiFeedback('')

    try {
      const feedback = await requestAnswerFeedback(aiSettings, activeCard)
      setAiFeedback(feedback)
      setAiFeedbackStatus('idle')
    } catch (error) {
      setAiFeedback(error instanceof Error ? error.message : t('ai.error'))
      setAiFeedbackStatus('error')
    }
  }

  useEffect(() => {
    setRevealed(false)
    setExpanded(false)
    setAiFeedback('')
    setAiFeedbackStatus('idle')
  }, [activeCard?.id, deck?.id])

  useEffect(() => {
    const restoredSession =
      deck && studySession?.deckId === deck.id
        ? studySession
        : {
            deckId: deck?.id ?? '',
            total: getDueCards(deck).length,
            reviewed: 0,
            currentIndex: 0,
            updatedAt: new Date().toISOString(),
          }

    setCurrentIndex(Math.min(restoredSession.currentIndex, Math.max(getDueCards(deck).length - 1, 0)))
    setSessionProgress(restoredSession)
  }, [deck?.id])

  useEffect(() => {
    if (currentIndex > 0 && currentIndex >= dueCards.length) {
      setCurrentIndex(Math.max(dueCards.length - 1, 0))
    }
  }, [currentIndex, dueCards.length])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable

      if (isTyping || !activeCard) return

      if (event.code === 'Space') {
        event.preventDefault()
        setRevealed((current) => !current)
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        moveToCard(activeIndex - 1)
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleNavigateWithReview(activeIndex + 1, 'easy')
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveToCard(0)
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        handleNavigateWithReview(dueCards.length - 1, 'easy')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeCard, activeIndex, dueCards.length])

  if (!deck) {
    return (
      <section className="page-grid study-page">
        <div className="study-toolbar">
          <div className="back-row">
            <button className="ghost-button" onClick={() => navigate('/')}>
              <ArrowLeft size={16} />
              {t('actions.backHome')}
            </button>
          </div>
        </div>

        <article className="panel empty-state">
          <h3>{t('study.noDeckTitle')}</h3>
          <p>{t('study.noDeckText')}</p>
          <div className="empty-card-actions">
            <button className="primary-button" onClick={() => navigate('/decks')}>
              {t('actions.createDeck')}
            </button>
          </div>
        </article>
      </section>
    )
  }

  return (
    <section className="page-grid study-page">
      <div className="study-toolbar">
        <div className="back-row">
          <button className="ghost-button" onClick={() => navigate('/')}>
            <ArrowLeft size={16} />
            {t('actions.backHome')}
          </button>
          <button className="ghost-button" onClick={() => navigate('/decks')}>
            {t('actions.changeDeck')}
          </button>
          <button className="ghost-button" onClick={handleResetDeckClick}>
            {t('actions.resetDeck')}
          </button>
          <button className="ghost-button danger-button" onClick={onDeleteDeck}>
            <Trash2 size={16} />
            {t('actions.deleteDeck')}
          </button>
        </div>

        <div className="study-summary">
          <MetricCard label={t('study.remaining')} value={String(dueCards.length)} />
          <MetricCard label={t('study.reviewedToday')} value={String(stats.reviewsToday)} />
        </div>
      </div>

      <div className="section-head">
        <div>
          <h2>{t('study.title')}</h2>
          <p>{deck.name}</p>
        </div>
      </div>

      <div className="study-progress-card" aria-label={`Tiến trình học ${progressPercent}%`}>
        <div className="study-progress-copy">
          <span>Tiến trình học</span>
          <strong>{progressPercent}%</strong>
        </div>
        <div className="study-progress-track">
          <div className="study-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="study-progress-meta">
          <span>{completedCards} đã chấm</span>
          <span>{Math.max(sessionTotal - completedCards, 0)} còn lại</span>
        </div>
      </div>

      {!activeCard ? (
        <article className="panel empty-state">
          <h3>{t('study.doneTitle')}</h3>
          <p>{t('study.noCards')}</p>
          <div className="empty-card-actions">
            <button className="ghost-button" onClick={() => navigate('/decks')}>
              {t('actions.changeDeck')}
            </button>
            <button className="primary-button" onClick={() => navigate('/')}>
              {t('actions.backHome')}
            </button>
          </div>
        </article>
      ) : (
        <div className={`content-columns study-layout ${expanded ? 'expanded' : ''}`}>
          <article className={`study-card ${expanded ? 'expanded' : ''}`}>
            <div className="study-card-header">
              <div className="study-card-meta">
                <span className="pill">{deck.language}</span>
                <span>{activeCard.tags.length > 0 ? activeCard.tags.join(' • ') : t('study.noTags')}</span>
              </div>
              <div className="study-card-actions">
                <div className="study-card-nav">
                  <button
                    className="ghost-button icon-only compact"
                    onClick={() => moveToCard(0)}
                    disabled={activeIndex === 0}
                    aria-label={t('actions.firstCard')}
                    title={t('actions.firstCard')}
                  >
                    <ChevronsLeft size={16} />
                  </button>
                  <button
                    className="ghost-button icon-only compact"
                    onClick={() => moveToCard(activeIndex - 1)}
                    disabled={activeIndex === 0}
                    aria-label={t('actions.previousCard')}
                    title={t('actions.previousCard')}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="ghost-button icon-only compact"
                    onClick={() => handleNavigateWithReview(activeIndex + 1, 'easy')}
                    disabled={activeIndex >= dueCards.length - 1}
                    aria-label={t('actions.nextCard')}
                    title={t('actions.nextCard')}
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    className="ghost-button icon-only compact"
                    onClick={() => handleNavigateWithReview(dueCards.length - 1, 'easy')}
                    disabled={activeIndex >= dueCards.length - 1}
                    aria-label={t('actions.lastCard')}
                    title={t('actions.lastCard')}
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
                <JumpToControl
                  value={jumpValue}
                  total={dueCards.length}
                  placeholder={t('study.jumpPlaceholder')}
                  buttonLabel={t('actions.goto')}
                  onChange={setJumpValue}
                  onJump={handleJumpToCard}
                />
                <button
                  className="ghost-button icon-only"
                  onClick={() => setExpanded((current) => !current)}
                  aria-label={expanded ? t('actions.collapse') : t('actions.expand')}
                  title={expanded ? t('actions.collapse') : t('actions.expand')}
                >
                  {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <span className="question-counter">
                  {t('study.cardCounter', { current: sessionCurrent, total: sessionTotal })}
                </span>
              </div>
            </div>

            <div className="question-block">
              <span className="eyebrow">{t('study.question')}</span>
              {frontHasHtml && activeCard ? (
                <div className="paper-preview question-only">
                  <div className="paper-question rich-html">
                    <RichHtmlPreview html={activeCard.front} />
                  </div>
                </div>
              ) : (
                <QuestionPreview formatted={formattedFront} />
              )}
            </div>

            <div className={`answer-panel ${revealed ? 'visible preview-mode' : ''}`}>
              <div className="answer-content">
                <span className="eyebrow">{t('study.answer')}</span>
                {revealed ? (
                  <div className={`paper-preview answer-only ${expanded ? 'expanded' : ''}`}>
                    <div className="paper-answer">
                      {backHasHtml && activeCard ? <RichHtmlPreview html={activeCard.back} /> : <AnswerPreview formatted={formattedBack} />}
                    </div>
                  </div>
                ) : (
                  <p>{t('study.revealHint')}</p>
                )}
              </div>
            </div>

            {revealed && (
              <div className="ai-feedback-panel">
                <div className="ai-feedback-actions">
                  <button
                    className="ghost-button"
                    onClick={() => void handleRequestAiFeedback()}
                    disabled={!canUseAi(aiSettings) || aiFeedbackStatus === 'loading'}
                    title={!canUseAi(aiSettings) ? t('ai.needSetup') : t('ai.explain')}
                  >
                    <Sparkles size={16} />
                    {aiFeedbackStatus === 'loading' ? t('ai.loading') : t('ai.explain')}
                  </button>
                  {!canUseAi(aiSettings) && <span>{t('ai.needSetup')}</span>}
                </div>
                {aiFeedback && (
                  <div className={`ai-feedback-result ${aiFeedbackStatus === 'error' ? 'error' : ''}`}>
                    {aiFeedback}
                  </div>
                )}
              </div>
            )}

            {!revealed ? (
              <button className="primary-button full-width" onClick={() => setRevealed(true)}>
                {t('actions.reveal')}
              </button>
            ) : (
              <div className="rating-row">
                {(['again', 'hard', 'good', 'easy'] as const).map((rating) => (
                  <button key={rating} className="rate-button" onClick={() => handleRateCard(rating)}>
                    {t(`study.${rating}`)}
                  </button>
                ))}
              </div>
            )}
          </article>

          <aside className={`panel guide-panel ${expanded ? 'hidden' : ''}`}>
            <div className="panel-header">
              <h3>{t('study.guideTitle')}</h3>
            </div>
            <div className="guide-list">
              <GuideStep number="1" title={t('study.step1Title')} text={t('study.step1Text')} />
              <GuideStep number="2" title={t('study.step2Title')} text={t('study.step2Text')} />
              <GuideStep number="3" title={t('study.step3Title')} text={t('study.step3Text')} />
            </div>
            <div className="tip-box">
              <strong>{t('study.tipTitle')}</strong>
              <p>{t('study.tipText')}</p>
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}

function ExamPage({ deck }: { deck?: Deck }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const questionBank = useMemo(() => buildExamQuestions(deck), [deck])
  const [questionLimit, setQuestionLimit] = useState<number | 'all'>(10)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [jumpValue, setJumpValue] = useState('')
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const questions = useMemo(() => {
    if (questionLimit === 'all') return questionBank
    return questionBank.slice(0, Math.min(questionLimit, questionBank.length))
  }, [questionBank, questionLimit])
  const activeIndex = questions.length > 0 ? Math.min(currentIndex, questions.length - 1) : 0
  const currentQuestion = questions[activeIndex]
  const answeredCount = questions.filter((question) => (answers[question.id]?.length ?? 0) >= question.requiredAnswerCount).length
  const score = questions.filter((question) => areLabelSetsEqual(answers[question.id], question.correctLabels)).length

  const chooseAnswer = (label: string) => {
    if (!currentQuestion) return
    setAnswers((current) => {
      const selectedLabels = current[currentQuestion.id] ?? []
      const isSelected = selectedLabels.includes(label)
      const requiredCount = Math.max(currentQuestion.requiredAnswerCount, 1)
      const nextLabels = isSelected
        ? selectedLabels.filter((selectedLabel) => selectedLabel !== label)
        : selectedLabels.length >= requiredCount
          ? [...selectedLabels.slice(1), label]
          : [...selectedLabels, label]

      return {
        ...current,
        [currentQuestion.id]: nextLabels,
      }
    })
  }

  const moveToQuestion = (nextIndex: number) => {
    if (questions.length === 0) return
    setCurrentIndex(Math.min(Math.max(nextIndex, 0), questions.length - 1))
  }

  const handleJumpToQuestion = (value: string) => {
    const targetNumber = Number(value)

    if (!Number.isFinite(targetNumber)) return

    moveToQuestion(Math.trunc(targetNumber) - 1)
    setJumpValue('')
  }

  const restartExam = () => {
    setAnswers({})
    setCurrentIndex(0)
    setJumpValue('')
  }

  useEffect(() => {
    setAnswers({})
    setCurrentIndex(0)
  }, [deck?.id, questionLimit])

  useEffect(() => {
    if (currentIndex >= questions.length) {
      setCurrentIndex(Math.max(questions.length - 1, 0))
    }
  }, [currentIndex, questions.length])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable

      if (isTyping || !currentQuestion) return

      const optionIndex = Number(event.key) - 1
      if (optionIndex >= 0 && optionIndex < currentQuestion.options.length) {
        event.preventDefault()
        chooseAnswer(currentQuestion.options[optionIndex].label.replace('.', ''))
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        moveToQuestion(activeIndex - 1)
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        moveToQuestion(activeIndex + 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, currentQuestion])

  if (!deck) {
    return (
      <section className="page-grid">
        <article className="panel empty-state">
          <h3>{t('exam.noDeckTitle')}</h3>
          <p>{t('exam.noDeckText')}</p>
          <button className="primary-button" onClick={() => navigate('/decks')}>
            {t('actions.createDeck')}
          </button>
        </article>
      </section>
    )
  }

  if (questionBank.length === 0) {
    return (
      <section className="page-grid">
        <div className="section-head">
          <div>
            <h2>{t('exam.title')}</h2>
            <p>{deck.name}</p>
          </div>
        </div>
        <article className="panel empty-state">
          <h3>{t('exam.noQuestionsTitle')}</h3>
          <p>{t('exam.noQuestionsText')}</p>
          <button className="ghost-button" onClick={() => navigate('/study')}>
            {t('nav.study')}
          </button>
        </article>
      </section>
    )
  }

  return (
    <section className="page-grid">
      <div className="section-head">
        <div>
          <h2>{t('exam.title')}</h2>
          <p>{deck.name}</p>
        </div>
      </div>

      <div className="stats-row exam-stats">
        <MetricCard label={t('exam.questionCount')} value={String(questions.length)} />
        <MetricCard label={t('exam.answered')} value={`${answeredCount}/${questions.length}`} />
        <MetricCard label={t('exam.score')} value={`${score}/${questions.length}`} />
        <article className="metric-card exam-count-card">
          <span>{t('exam.questionCount')}</span>
          <div className="segmented exam-count-options">
            {[10, 20, 50].map((count) => (
              <button
                key={count}
                className={questionLimit === count ? 'active' : ''}
                onClick={() => setQuestionLimit(count)}
              >
                {count}
              </button>
            ))}
            <button className={questionLimit === 'all' ? 'active' : ''} onClick={() => setQuestionLimit('all')}>
              All
            </button>
          </div>
        </article>
      </div>

      {currentQuestion && (
        <article className="study-card exam-card">
          <div className="study-card-header">
            <div className="study-card-meta">
              <span className="pill">
                {currentQuestion.requiredAnswerCount > 1
                  ? `${t('exam.chooseAnswer')} (${currentQuestion.requiredAnswerCount})`
                  : t('exam.chooseAnswer')}
              </span>
              <span>{t('exam.questionCounter', { current: activeIndex + 1, total: questions.length })}</span>
            </div>
            <div className="study-card-actions">
              <button
                className="ghost-button icon-only compact"
                onClick={() => moveToQuestion(activeIndex - 1)}
                disabled={activeIndex === 0}
                aria-label={t('exam.previous')}
                title={t('exam.previous')}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="ghost-button icon-only compact"
                onClick={() => moveToQuestion(activeIndex + 1)}
                disabled={activeIndex >= questions.length - 1}
                aria-label={t('exam.next')}
                title={t('exam.next')}
              >
                <ChevronRight size={16} />
              </button>
              <JumpToControl
                value={jumpValue}
                total={questions.length}
                placeholder={t('exam.jumpPlaceholder')}
                buttonLabel={t('actions.goto')}
                onChange={setJumpValue}
                onJump={handleJumpToQuestion}
              />
            </div>
          </div>

          <div className="paper-preview question-only exam-question-paper">
            <div className={`paper-question ${currentQuestion.frontHasHtml ? 'rich-html' : ''}`}>
              {currentQuestion.frontHasHtml ? (
                <RichHtmlPreview html={currentQuestion.rawFront} />
              ) : (
                <QuestionPreview formatted={currentQuestion.formattedFront} paper />
              )}
            </div>
          </div>

          <div className="exam-options">
            {currentQuestion.options.map((option) => {
              const label = option.label.replace('.', '')
              const selectedLabels = answers[currentQuestion.id] ?? []
              const isSelected = selectedLabels.includes(label)
              const isCorrect = currentQuestion.correctLabels.includes(label)
              const showResult = selectedLabels.length >= currentQuestion.requiredAnswerCount

              return (
                <button
                  key={`${currentQuestion.id}-${label}`}
                  className={`exam-option ${isSelected ? 'selected' : ''} ${showResult && isCorrect ? 'correct' : ''} ${
                    showResult && isSelected && !isCorrect ? 'incorrect' : ''
                  }`}
                  onClick={() => chooseAnswer(label)}
                >
                  <span className="exam-option-index">{option.label}</span>
                  <span>{option.text}</span>
                </button>
              )
            })}
          </div>

          {(answers[currentQuestion.id]?.length ?? 0) >= currentQuestion.requiredAnswerCount && (
            <div className={`exam-result ${areLabelSetsEqual(answers[currentQuestion.id], currentQuestion.correctLabels) ? 'correct' : 'incorrect'}`}>
              <strong>
                {areLabelSetsEqual(answers[currentQuestion.id], currentQuestion.correctLabels) ? t('exam.correct') : t('exam.incorrect')}
              </strong>
              <span>{t('exam.correctAnswer', { answer: currentQuestion.correctLabels.join(', ') })}</span>
            </div>
          )}

          <div className="exam-actions">
            <button className="ghost-button" onClick={() => moveToQuestion(activeIndex - 1)} disabled={activeIndex === 0}>
              {t('exam.previous')}
            </button>
            <button className="ghost-button" onClick={restartExam}>
              {t('exam.restart')}
            </button>
            <button className="primary-button" onClick={() => moveToQuestion(activeIndex + 1)} disabled={activeIndex >= questions.length - 1}>
              {t('exam.next')}
            </button>
          </div>
        </article>
      )}
    </section>
  )
}

function LibraryPage() {
  const { t } = useTranslation()

  return (
    <section className="page-grid">
      <div className="section-head">
        <div>
          <h2>{t('library.title')}</h2>
          <p>{t('library.subtitle')}</p>
        </div>
      </div>
      <div className="option-list">
        <article className="panel">
          <p>{t('library.option1')}</p>
        </article>
        <article className="panel">
          <p>{t('library.option2')}</p>
        </article>
        <article className="panel">
          <p>{t('library.option3')}</p>
        </article>
      </div>
    </section>
  )
}

function StatsPage({ state }: { state: AppState }) {
  const { t } = useTranslation()

  return (
    <section className="page-grid">
      <div className="section-head">
        <div>
          <h2>{t('stats.title')}</h2>
        </div>
      </div>
      <div className="stats-row">
        <MetricCard label={t('stats.reviewsToday')} value={String(state.stats.reviewsToday)} />
        <MetricCard label={t('stats.minutesToday')} value={String(state.stats.minutesToday)} />
        <MetricCard label={t('stats.totalReviews')} value={String(state.stats.totalReviews)} />
        <MetricCard label={t('stats.streakDays')} value={String(state.stats.streakDays)} />
      </div>
      <article className="panel">
        <div className="deck-grid">
          {state.decks.length === 0 ? (
            <div className="empty-state">
              <h3>{t('stats.emptyTitle')}</h3>
              <p>{t('stats.emptyText')}</p>
            </div>
          ) : (
            state.decks.map((deck) => (
              <div key={deck.id} className="deck-card static">
                <div className="deck-card-top">
                  <span className="pill">{deck.category}</span>
                  <span>{deck.language}</span>
                </div>
                <h3>{deck.name}</h3>
                <p>{deck.description}</p>
                <div className="deck-card-meta">
                  <strong>{getDueCards(deck).length}</strong>
                  <span>{t('misc.dueCards')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  )
}

function SettingsPage({
  state,
  onThemeChange,
  onLocaleChange,
  onToggleLibrary,
  onDailyGoalChange,
  onAiSettingsChange,
  onReset,
}: {
  state: AppState
  onThemeChange: (theme: ThemeMode) => void
  onLocaleChange: (locale: AppState['settings']['locale']) => void
  onToggleLibrary: (value: boolean) => void
  onDailyGoalChange: (value: number) => void
  onAiSettingsChange: (settings: AiSettings) => void
  onReset: () => void
}) {
  const { t } = useTranslation()
  const aiSettings = state.settings.ai
  const updateAi = (partial: Partial<AiSettings>) => onAiSettingsChange({ ...aiSettings, ...partial })

  return (
    <section className="page-grid">
      <div className="section-head">
        <div>
          <h2>{t('settings.title')}</h2>
        </div>
      </div>
      <div className="settings-list">
        <article className="panel settings-panel">
          <div className="setting-row">
            <div>
              <strong>{t('settings.theme')}</strong>
            </div>
            <div className="segmented">
              <button
                className={state.settings.theme === 'dark' ? 'active' : ''}
                onClick={() => onThemeChange('dark')}
              >
                {t('settings.dark')}
              </button>
              <button
                className={state.settings.theme === 'light' ? 'active' : ''}
                onClick={() => onThemeChange('light')}
              >
                {t('settings.light')}
              </button>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <strong>{t('settings.language')}</strong>
            </div>
            <select
              className="locale-select"
              value={state.settings.locale}
              onChange={(event) => onLocaleChange(event.target.value as AppState['settings']['locale'])}
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="setting-row">
            <div>
              <strong>{t('settings.dailyGoal')}</strong>
            </div>
            <input
              className="goal-input"
              type="number"
              min={10}
              max={500}
              value={state.settings.dailyGoal}
              onChange={(event) => onDailyGoalChange(Number(event.target.value))}
            />
          </div>

          <div className="setting-row">
            <div>
              <strong>{t('settings.library')}</strong>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={state.settings.showLibrary}
                onChange={(event) => onToggleLibrary(event.target.checked)}
              />
              <span />
            </label>
          </div>

          <div className="setting-row stacked">
            <div>
              <strong>{t('ai.title')}</strong>
              <p>{t('ai.privacyHint')}</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={aiSettings.enabled}
                onChange={(event) => updateAi({ enabled: event.target.checked })}
              />
              <span />
            </label>
          </div>

          <div className="ai-settings-grid">
            <label>
              <span>{t('ai.apiKey')}</span>
              <input
                type="password"
                value={aiSettings.apiKey}
                placeholder="sk-..."
                autoComplete="off"
                onChange={(event) => updateAi({ apiKey: event.target.value })}
              />
            </label>
            <label>
              <span>{t('ai.endpoint')}</span>
              <input
                value={aiSettings.endpoint}
                placeholder="https://api.openai.com/v1/chat/completions"
                onChange={(event) => updateAi({ endpoint: event.target.value })}
              />
            </label>
            <label>
              <span>{t('ai.model')}</span>
              <input
                value={aiSettings.model}
                placeholder="gpt-4o-mini"
                onChange={(event) => updateAi({ model: event.target.value })}
              />
            </label>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h3>{t('settings.privacy')}</h3>
          </div>
          <p>{t('settings.privacyText')}</p>
          <button className="ghost-button" onClick={onReset}>
            {t('actions.reset')}
          </button>
        </article>
      </div>
    </section>
  )
}

function JumpToControl({
  value,
  total,
  placeholder,
  buttonLabel,
  onChange,
  onJump,
}: {
  value: string
  total: number
  placeholder: string
  buttonLabel: string
  onChange: (value: string) => void
  onJump: (value: string) => void
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onJump(value)
  }

  return (
    <form className="jump-control" onSubmit={handleSubmit}>
      <input
        type="number"
        min={1}
        max={Math.max(total, 1)}
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <button className="ghost-button compact" type="submit" disabled={!value.trim() || total <= 0}>
        {buttonLabel}
      </button>
    </form>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function GuideStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="guide-step">
      <div className="guide-step-number">{number}</div>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  )
}

function RichHtmlPreview({ html }: { html: string }) {
  const sanitized = useMemo(() => sanitizeRichHtml(html), [html])

  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />
}

function QuestionPreview({
  formatted,
  paper = false,
  highlightLabel,
  highlightLabels,
}: {
  formatted: ChoiceContent
  paper?: boolean
  highlightLabel?: string | null
  highlightLabels?: string[]
}) {
  const labelsToHighlight = new Set(highlightLabels ?? (highlightLabel ? [highlightLabel] : []))

  return (
    <div className={`question-preview ${paper ? 'paper' : ''}`}>
      <div className="question-stem">{formatted.stem}</div>
      {formatted.options.length > 0 && (
        <div className="question-options">
          {formatted.options.map((option) => (
            <div
              key={`${option.label}-${option.text}`}
              className={`question-option ${labelsToHighlight.has(option.label.replace('.', '')) ? 'correct' : ''}`}
            >
              <span className="question-option-label">{option.label}</span>
              <span>{option.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AnswerPreview({ formatted }: { formatted: AnswerContent }) {
  const plainAnswerText = useMemo(() => prettifyPlainAnswerText(formatted.content.stem), [formatted.content.stem])

  return (
    <div className={`answer-preview ${formatted.correctLabel ? 'has-key' : ''}`}>
      {formatted.correctLabel && (
        <div className="answer-key-line">
          <strong>{formatted.correctLabel}</strong>
        </div>
      )}

      {formatted.content.options.length > 0 ? (
        <QuestionPreview formatted={formatted.content} paper highlightLabels={formatted.correctLabels} />
      ) : (
        <p className="answer-text">{plainAnswerText}</p>
      )}
    </div>
  )
}

type ChoiceOption = {
  label: string
  text: string
}

type ChoiceContent = {
  stem: string
  options: ChoiceOption[]
}

type AnswerContent = {
  correctLabel: string | null
  correctLabels: string[]
  content: ChoiceContent
}

type ExamQuestion = {
  id: string
  rawFront: string
  frontHasHtml: boolean
  formattedFront: ChoiceContent
  stem: string
  options: ChoiceOption[]
  correctLabels: string[]
  requiredAnswerCount: number
}

const examChoiceOrder = ['a', 'b', 'c', 'd'] as const

function normalizeAnswerLabels(labels: string[]) {
  return [...new Set(labels.map((label) => label.toLowerCase()).filter((label) => examChoiceOrder.includes(label as (typeof examChoiceOrder)[number])))]
}

function areLabelSetsEqual(selectedLabels: string[] | undefined, correctLabels: string[]) {
  const selectedSet = normalizeAnswerLabels(selectedLabels ?? [])
  const correctSet = normalizeAnswerLabels(correctLabels)

  return selectedSet.length === correctSet.length && selectedSet.every((label) => correctSet.includes(label))
}

function getRequiredAnswerCount(questionText: string, correctLabels: string[]) {
  const explicitCountMatch = questionText.match(/chọn\s*(\d+)/iu)
  const explicitCount = explicitCountMatch ? Number(explicitCountMatch[1]) : 0

  return Math.max(correctLabels.length, Number.isFinite(explicitCount) ? explicitCount : 0, 1)
}

function parseLeadingAnswerLabels(normalized: string) {
  const compactLabelsMatch = normalized.match(/^\s*([A-Da-d]{2,4})(?=\s*[\.\)\(:-])/u)
  if (compactLabelsMatch) {
    const matchedText = compactLabelsMatch[0]
    const labels = normalizeAnswerLabels([...compactLabelsMatch[1]])
    return {
      labels,
      contentText: normalized.slice(matchedText.length).replace(/^\s*[\.\)\(:-]?\s*/u, '').replace(/^\)\s*/, '').trim(),
    }
  }

  const separatedLabelsMatch = normalized.match(/^\s*([A-Da-d](?:\s*[,;/&+]\s*[A-Da-d]){1,3})(?=\s*[\.\)\(:-]|\s|$)/u)
  if (separatedLabelsMatch) {
    const matchedText = separatedLabelsMatch[0]
    const labels = normalizeAnswerLabels(separatedLabelsMatch[1].match(/[A-Da-d]/gu) ?? [])
    return {
      labels,
      contentText: normalized.slice(matchedText.length).replace(/^\s*[\.\)\(:-]?\s*/u, '').replace(/^\)\s*/, '').trim(),
    }
  }

  const spacedLabelsMatch = normalized.match(/^\s*([A-Da-d](?:\s+[A-Da-d]){1,3})(?=\s*[\.\)\(:-]|\s*$)/u)
  if (spacedLabelsMatch) {
    const matchedText = spacedLabelsMatch[0]
    const labels = normalizeAnswerLabels(spacedLabelsMatch[1].match(/[A-Da-d]/gu) ?? [])
    return {
      labels,
      contentText: normalized.slice(matchedText.length).replace(/^\s*[\.\)\(:-]?\s*/u, '').replace(/^\)\s*/, '').trim(),
    }
  }

  const singleLabelMatch = normalized.match(/^\s*([A-Da-d])(?=\s*[\.\)\(:-]|$)/u)
  if (singleLabelMatch) {
    const matchedText = singleLabelMatch[0]
    const labels = normalizeAnswerLabels([singleLabelMatch[1]])
    return {
      labels,
      contentText: normalized.slice(matchedText.length).replace(/^\s*[\.\)\(:-]?\s*/u, '').replace(/^\)\s*/, '').trim(),
    }
  }

  return {
    labels: [],
    contentText: normalized,
  }
}

function hasRichMarkup(text: string) {
  return /<\/?[a-z][\s\S]*>/iu.test(text) || /&(?:nbsp|[a-z]{2,}|#\d+);/iu.test(text)
}

function countChoiceMarkers(text: string) {
  const normalized = normalizeChoiceMarkers(text)
  return selectOrderedChoiceMarkers(collectChoiceMarkers(normalized)).length
}

function prettifyPlainAnswerText(text: string) {
  return text
    .replace(/\s*\((Kiểu hỏi khác:)/giu, '\n($1')
    .replace(/([?!)])\s+(?=[A-Da-d][\.\)])/gu, '$1\n')
    .replace(/\s+([A-Da-d])[\.\)]\s+/gu, '\n$1. ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function fieldToPlainText(value: string) {
  if (!hasRichMarkup(value)) return value

  const documentFragment = new DOMParser().parseFromString(value, 'text/html')
  documentFragment.querySelectorAll('br').forEach((node) => node.replaceWith('\n'))
  documentFragment.querySelectorAll('div, p, li').forEach((node) => node.append(document.createTextNode('\n')))

  return (
    documentFragment.body.textContent
      ?.replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() ?? ''
  )
}

function normalizeExamOptions(options: ChoiceOption[]) {
  const optionMap = new Map<string, ChoiceOption>()

  options.forEach((option) => {
    const label = option.label.replace('.', '').toLowerCase()
    if (!examChoiceOrder.includes(label as (typeof examChoiceOrder)[number])) return
    if (!option.text.trim()) return

    if (!optionMap.has(label)) {
      optionMap.set(label, {
        label: `${label}.`,
        text: option.text.trim(),
      })
    }
  })

  return examChoiceOrder
    .map((label) => optionMap.get(label))
    .filter((option): option is ChoiceOption => Boolean(option))
}

function buildExamQuestions(deck?: Deck): ExamQuestion[] {
  if (!deck) return []

  return deck.cards
    .map((card) => {
      const rawFront = card.front
      const frontHasHtml = hasRichMarkup(rawFront)
      const front = parseChoiceContent(fieldToPlainText(rawFront))
      const answer = formatAnswerText(fieldToPlainText(card.back))
      const correctLabels = answer.correctLabels
      const options = normalizeExamOptions(front.options)
      const optionLabels = options.map((option) => option.label.replace('.', ''))

      if (correctLabels.length === 0 || options.length < 2) return null
      if (!correctLabels.every((label) => optionLabels.includes(label))) return null

      return {
        id: card.id,
        rawFront,
        frontHasHtml,
        formattedFront: {
          stem: front.stem,
          options,
        },
        stem: front.stem,
        options,
        correctLabels,
        requiredAnswerCount: getRequiredAnswerCount(front.stem, correctLabels),
      }
    })
    .filter((question): question is ExamQuestion => Boolean(question))
}

function sanitizeRichHtml(html: string) {
  const documentFragment = new DOMParser().parseFromString(html, 'text/html')

  documentFragment.querySelectorAll('script, style, iframe, object, embed').forEach((node) => node.remove())

  documentFragment.querySelectorAll('*').forEach((element) => {
    ;[...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()

      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name)
        return
      }

      if ((name === 'href' || name === 'src') && /^javascript:/iu.test(value)) {
        element.removeAttribute(attribute.name)
      }
    })
  })

  return documentFragment.body.innerHTML.trim()
}

function normalizeChoiceMarkers(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function isChoiceMarkerBoundary(char: string | undefined) {
  if (!char) return true

  const boundaryChars = new Set(['"', "'", '(', '<', '{', '[', ')', ']', '}', '>', ':', ';'])
  const codePoint = char.codePointAt(0)
  const isCurlyQuote =
    codePoint === 0x2018 ||
    codePoint === 0x2019 ||
    codePoint === 0x201c ||
    codePoint === 0x201d

  return /\s/u.test(char) || boundaryChars.has(char) || isCurlyQuote
}

function collectChoiceMarkers(normalized: string) {
  const markers: Array<{ index: number; end: number; label: string }> = []

  for (let index = 0; index < normalized.length - 1; index += 1) {
    const label = normalized[index]?.toLowerCase()
    const marker = normalized[index + 1]

    if (!examChoiceOrder.includes(label as (typeof examChoiceOrder)[number])) continue
    if (marker !== '.' && marker !== ')') continue
    if (!isChoiceMarkerBoundary(normalized[index - 1])) continue

    const tail = normalized.slice(index + 2)
    const spacingLength = tail.match(/^\s*/u)?.[0]?.length ?? 0
    const nextChar = normalized[index + 2 + spacingLength]
    const nextCodePoint = nextChar?.codePointAt(0)
    const nextIsCurlyQuote =
      nextCodePoint === 0x2018 ||
      nextCodePoint === 0x2019 ||
      nextCodePoint === 0x201c ||
      nextCodePoint === 0x201d

    if (
      nextChar &&
      !/[\p{L}\p{N}]/u.test(nextChar) &&
      !new Set(['(', '"', "'"]).has(nextChar) &&
      !nextIsCurlyQuote
    ) {
      continue
    }

    markers.push({
      index,
      end: index + 2 + spacingLength,
      label: `${label}.`,
    })
  }

  return markers
}

function getChoiceLabelIndex(label: string) {
  return examChoiceOrder.indexOf(label.replace('.', '').toLowerCase() as (typeof examChoiceOrder)[number])
}

function selectOrderedChoiceMarkers(markers: Array<{ index: number; end: number; label: string }>) {
  const firstAIndex = markers.findIndex((marker) => marker.label.replace('.', '') === 'a')

  if (firstAIndex >= 0) {
    const sequence: Array<{ index: number; end: number; label: string }> = []
    let expectedLabelIndex = 0

    for (const marker of markers.slice(firstAIndex)) {
      const markerLabelIndex = getChoiceLabelIndex(marker.label)

      if (markerLabelIndex === expectedLabelIndex) {
        sequence.push(marker)
        expectedLabelIndex += 1
      }
    }

    if (sequence.length >= 2) return sequence
  }

  return markers.reduce<Array<{ index: number; end: number; label: string }>>((best, marker, markerIndex) => {
    let expectedLabelIndex = getChoiceLabelIndex(marker.label)

    if (expectedLabelIndex < 0) return best

    const sequence = [marker]

    for (const candidate of markers.slice(markerIndex + 1)) {
      const candidateLabelIndex = getChoiceLabelIndex(candidate.label)

      if (candidateLabelIndex === expectedLabelIndex + 1) {
        sequence.push(candidate)
        expectedLabelIndex = candidateLabelIndex
      }
    }

    return sequence.length > best.length ? sequence : best
  }, [])
}

function parseChoiceContent(text: string): ChoiceContent {
  const normalized = normalizeChoiceMarkers(text)
  const markers = selectOrderedChoiceMarkers(collectChoiceMarkers(normalized))

  if (markers.length < 2) {
    return { stem: normalized, options: [] }
  }

  const firstMarkerIndex = markers[0]?.index ?? -1
  if (firstMarkerIndex <= 0) {
    return { stem: normalized, options: [] }
  }

  const stem = normalized.slice(0, firstMarkerIndex).trim()
  const options = markers
    .map((marker, index) => {
      const nextMarker = markers[index + 1]
      const nextStart = nextMarker ? nextMarker.index : normalized.length

      return {
        label: marker.label,
        text: normalized
          .slice(marker.end, nextStart)
          .trim()
          .replace(/^["'“”]+|["'“”]+$/g, ''),
      }
    })
    .filter((option) => option.text.length > 0)

  if (options.length < 2) {
    return { stem: normalized, options: [] }
  }

  return { stem, options }
}

function formatStudyText(text: string) {
  return parseChoiceContent(text)
}

function formatAnswerText(text: string): AnswerContent {
  const normalized = normalizeChoiceMarkers(text)
  const { labels: correctLabels, contentText } = parseLeadingAnswerLabels(normalized)
  const correctLabel = correctLabels.length > 0 ? correctLabels.join(', ') : null
  const parsedContent = parseChoiceContent(contentText)
  const markerCount = countChoiceMarkers(contentText)
  const shouldUsePlainText = /kiểu hỏi khác/iu.test(contentText) || markerCount > 4 || parsedContent.options.length > 4

  return {
    correctLabel,
    correctLabels,
    content: shouldUsePlainText ? { stem: contentText, options: [] } : parsedContent,
  }
}

function getDueCards(deck?: Deck): Card[] {
  if (!deck) return []
  const now = Date.now()
  return deck.cards.filter((card) => !card.dueAt || new Date(card.dueAt).getTime() <= now)
}

function totalDueCards(decks: Deck[]) {
  return decks.reduce((sum, deck) => sum + getDueCards(deck).length, 0)
}

export default App
