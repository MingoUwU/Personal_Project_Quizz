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
  SunMedium,
  Trash2,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { parseImportFile } from './importers'
import { createDeck, deleteDeck, importDecks, loadState, resetDeckProgress, resetState, reviewCard, saveState } from './storage'
import type { AppState, Card, Deck, ReviewRating, ThemeMode } from './types'

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

  const addDeck = (deck: Pick<Deck, 'name' | 'description' | 'language' | 'category'>) =>
    setState((current) => createDeck(current, deck))

  const selectDeck = (deckId: string) =>
    setState((current) => ({ ...current, selectedDeckId: deckId }))

  const handleReview = (cardId: string, rating: ReviewRating) => {
    if (!selectedDeck) return
    setState((current) => reviewCard(current, selectedDeck.id, cardId, rating))
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
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <header className="topbar">
      <label className="search-box">
        <Search size={18} />
        <input placeholder={t('misc.search')} />
      </label>

      <div className="topbar-actions">
        <button className="ghost-button" onClick={() => inputRef.current?.click()}>
          <Upload size={16} />
          {t('actions.importDeck')}
        </button>
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
        ref={inputRef}
        hidden
        type="file"
        accept=".json,.apkg"
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
}: {
  deck?: Deck
  stats: AppState['stats']
  onReview: (cardId: string, rating: ReviewRating) => void
  onDeleteDeck: () => void
  onResetDeck: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dueCards = getDueCards(deck)
  const [revealed, setRevealed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const activeIndex = dueCards.length > 0 ? Math.min(currentIndex, dueCards.length - 1) : 0
  const activeCard = dueCards[activeIndex]
  const formattedFront = useMemo(() => formatStudyText(activeCard?.front ?? ''), [activeCard?.front])
  const formattedBack = useMemo(() => formatAnswerText(activeCard?.back ?? ''), [activeCard?.back])
  const frontHasHtml = useMemo(() => hasRichMarkup(activeCard?.front ?? ''), [activeCard?.front])
  const backHasHtml = useMemo(() => hasRichMarkup(activeCard?.back ?? ''), [activeCard?.back])

  const moveToCard = (nextIndex: number) => {
    if (dueCards.length === 0) return
    setCurrentIndex(Math.min(Math.max(nextIndex, 0), dueCards.length - 1))
  }

  useEffect(() => {
    setRevealed(false)
    setExpanded(false)
  }, [activeCard?.id, deck?.id])

  useEffect(() => {
    setCurrentIndex(0)
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
        moveToCard(activeIndex + 1)
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveToCard(0)
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveToCard(dueCards.length - 1)
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
          <button className="ghost-button" onClick={onResetDeck}>
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
                    onClick={() => moveToCard(activeIndex + 1)}
                    disabled={activeIndex >= dueCards.length - 1}
                    aria-label={t('actions.nextCard')}
                    title={t('actions.nextCard')}
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    className="ghost-button icon-only compact"
                    onClick={() => moveToCard(dueCards.length - 1)}
                    disabled={activeIndex >= dueCards.length - 1}
                    aria-label={t('actions.lastCard')}
                    title={t('actions.lastCard')}
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
                <button
                  className="ghost-button icon-only"
                  onClick={() => setExpanded((current) => !current)}
                  aria-label={expanded ? t('actions.collapse') : t('actions.expand')}
                  title={expanded ? t('actions.collapse') : t('actions.expand')}
                >
                  {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <span className="question-counter">
                  {t('study.cardCounter', { current: activeIndex + 1, total: dueCards.length })}
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

            {!revealed ? (
              <button className="primary-button full-width" onClick={() => setRevealed(true)}>
                {t('actions.reveal')}
              </button>
            ) : (
              <div className="rating-row">
                {(['again', 'hard', 'good', 'easy'] as const).map((rating) => (
                  <button key={rating} className="rate-button" onClick={() => onReview(activeCard.id, rating)}>
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
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const questions = useMemo(() => {
    if (questionLimit === 'all') return questionBank
    return questionBank.slice(0, Math.min(questionLimit, questionBank.length))
  }, [questionBank, questionLimit])
  const activeIndex = questions.length > 0 ? Math.min(currentIndex, questions.length - 1) : 0
  const currentQuestion = questions[activeIndex]
  const answeredCount = questions.filter((question) => answers[question.id]).length
  const score = questions.filter((question) => answers[question.id] === question.correctLabel).length

  const chooseAnswer = (label: string) => {
    if (!currentQuestion) return
    setAnswers((current) => ({ ...current, [currentQuestion.id]: label }))
  }

  const moveToQuestion = (nextIndex: number) => {
    if (questions.length === 0) return
    setCurrentIndex(Math.min(Math.max(nextIndex, 0), questions.length - 1))
  }

  const restartExam = () => {
    setAnswers({})
    setCurrentIndex(0)
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
              <span className="pill">{t('exam.chooseAnswer')}</span>
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
              const selected = answers[currentQuestion.id]
              const isSelected = selected === label
              const isCorrect = currentQuestion.correctLabel === label
              const showResult = Boolean(selected)

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

          {answers[currentQuestion.id] && (
            <div className={`exam-result ${answers[currentQuestion.id] === currentQuestion.correctLabel ? 'correct' : 'incorrect'}`}>
              <strong>
                {answers[currentQuestion.id] === currentQuestion.correctLabel ? t('exam.correct') : t('exam.incorrect')}
              </strong>
              <span>{t('exam.correctAnswer', { answer: currentQuestion.correctLabel })}</span>
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
  onReset,
}: {
  state: AppState
  onThemeChange: (theme: ThemeMode) => void
  onLocaleChange: (locale: AppState['settings']['locale']) => void
  onToggleLibrary: (value: boolean) => void
  onDailyGoalChange: (value: number) => void
  onReset: () => void
}) {
  const { t } = useTranslation()

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
}: {
  formatted: ChoiceContent
  paper?: boolean
  highlightLabel?: string | null
}) {
  return (
    <div className={`question-preview ${paper ? 'paper' : ''}`}>
      <div className="question-stem">{formatted.stem}</div>
      {formatted.options.length > 0 && (
        <div className="question-options">
          {formatted.options.map((option) => (
            <div
              key={`${option.label}-${option.text}`}
              className={`question-option ${highlightLabel === option.label.replace('.', '') ? 'correct' : ''}`}
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
          <strong>{formatted.correctLabel.toLowerCase()}</strong>
        </div>
      )}

      {formatted.content.options.length > 0 ? (
        <QuestionPreview formatted={formatted.content} paper highlightLabel={formatted.correctLabel} />
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
  content: ChoiceContent
}

type ExamQuestion = {
  id: string
  rawFront: string
  frontHasHtml: boolean
  formattedFront: ChoiceContent
  stem: string
  options: ChoiceOption[]
  correctLabel: string
}

const examChoiceOrder = ['a', 'b', 'c', 'd'] as const

function hasRichMarkup(text: string) {
  return /<\/?[a-z][\s\S]*>/iu.test(text) || /&(?:nbsp|[a-z]{2,}|#\d+);/iu.test(text)
}

function countChoiceMarkers(text: string) {
  return [...normalizeChoiceMarkers(text).matchAll(/(^|[\s"'â€œâ€â€˜â€™(<{\[]|[?!:;])([A-Da-d])[\.\)]\s*/gu)].length
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
      const correctLabel = answer.correctLabel
      const options = normalizeExamOptions(front.options)

      if (!correctLabel || options.length < 2) return null
      if (!options.some((option) => option.label.replace('.', '') === correctLabel)) return null

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
        correctLabel,
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
    if (nextChar && !/[\p{L}\p{N}(]/u.test(nextChar)) continue

    markers.push({
      index,
      end: index + 2 + spacingLength,
      label: `${label}.`,
    })
  }

  return markers
}

function parseChoiceContent(text: string): ChoiceContent {
  const normalized = normalizeChoiceMarkers(text)
  const markers = collectChoiceMarkers(normalized)

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
  const leadingAnswerMatch = normalized.match(/^\s*([A-Da-d])(?=\s*[\.\)\(:-]|$)/u)
  const correctLabel = leadingAnswerMatch?.[1]?.toLowerCase() ?? null
  const contentText = correctLabel
    ? normalized.replace(/^\s*[A-Da-d]\s*[\.\)\(:-]?\s*/u, '').replace(/^\)\s*/, '').trim()
    : normalized
  const parsedContent = parseChoiceContent(contentText)
  const markerCount = countChoiceMarkers(contentText)
  const shouldUsePlainText = /kiểu hỏi khác/iu.test(contentText) || markerCount > 4 || parsedContent.options.length > 4

  return {
    correctLabel,
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
