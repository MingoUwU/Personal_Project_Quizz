import JSZip from 'jszip'
import { decompress } from 'fzstd'
import initSqlJs from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import type { AppState, Deck } from './types'

interface AnkiDeckMeta {
  id: string
  name: string
}

interface AnkiNote {
  fields: string[]
  fieldNames: string[]
  tags: string[]
}

interface ImportResult {
  format: 'json' | 'apkg'
  payload: Deck[] | AppState
  summary: string
}

let sqlPromise: ReturnType<typeof initSqlJs> | null = null

type SqlResult = {
  columns: string[]
  values: unknown[][]
}

const getSql = () => {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: () => sqlWasmUrl,
    })
  }

  return sqlPromise
}

const normalizeImportedField = (value: string) => value.replace(/\r\n/g, '\n').trim()

const htmlTextFallbacks: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

const getVisibleText = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot);|&#39;/g, (entity) => htmlTextFallbacks[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim()

const hasVisibleContent = (value: string) => getVisibleText(value).length > 0

const unsupportedAnkiPlaceholderPattern =
  /please update to the latest anki version, then import the \.colpkg\/\.apkg file again\./i

const isUnsupportedAnkiPlaceholder = (front: string, back: string) =>
  unsupportedAnkiPlaceholderPattern.test(`${front} ${back}`)

const isZstdCompressed = (bytes: Uint8Array) =>
  bytes[0] === 0x28 && bytes[1] === 0xb5 && bytes[2] === 0x2f && bytes[3] === 0xfd

const readCollectionDatabaseBytes = async (collectionFile: JSZip.JSZipObject) => {
  const bytes = await collectionFile.async('uint8array')

  return isZstdCompressed(bytes) ? decompress(bytes) : bytes
}

const makeDeckId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

const normalizeJsonDeck = (deck: Partial<Deck>, index: number): Deck => ({
  id: deck.id ?? makeDeckId(`json-deck-${index}`),
  name: deck.name?.trim() || `Imported deck ${index + 1}`,
  description: deck.description ?? '',
  language: deck.language ?? 'Imported',
  category: deck.category ?? 'Imported',
  createdAt: deck.createdAt ?? new Date().toISOString(),
  lastStudiedAt: deck.lastStudiedAt,
  cards: Array.isArray(deck.cards)
    ? deck.cards.map((card, cardIndex) => ({
        id: card.id ?? makeDeckId(`json-card-${index}-${cardIndex}`),
        front: card.front ?? '',
        back: card.back ?? '',
        tags: Array.isArray(card.tags) ? card.tags : [],
        lastReviewedAt: card.lastReviewedAt,
        dueAt: card.dueAt,
        ease: typeof card.ease === 'number' ? card.ease : 2.5,
        interval: typeof card.interval === 'number' ? card.interval : 1,
        step: typeof card.step === 'number' ? card.step : 0,
      }))
    : [],
})

const parseJsonImport = async (file: File): Promise<ImportResult> => {
  const text = await file.text()
  const parsed = JSON.parse(text) as unknown

  if (Array.isArray(parsed)) {
    const decks = parsed.map((deck, index) => normalizeJsonDeck(deck as Partial<Deck>, index))
    return {
      format: 'json',
      payload: decks,
      summary: `Imported ${decks.length} deck(s) from JSON.`,
    }
  }

  if (parsed && typeof parsed === 'object' && 'decks' in parsed) {
    const appState = parsed as AppState
    const decks = Array.isArray(appState.decks)
      ? appState.decks.map((deck, index) => normalizeJsonDeck(deck as Partial<Deck>, index))
      : []

    return {
      format: 'json',
      payload: {
        ...appState,
        decks,
        selectedDeckId: appState.selectedDeckId || decks[0]?.id || '',
      },
      summary: `Imported app state with ${decks.length} deck(s).`,
    }
  }

  if (parsed && typeof parsed === 'object' && 'cards' in parsed) {
    const deck = normalizeJsonDeck(parsed as Partial<Deck>, 0)
    return {
      format: 'json',
      payload: [deck],
      summary: 'Imported 1 deck from JSON.',
    }
  }

  throw new Error('Unsupported JSON structure.')
}

const findCollectionFiles = (zip: JSZip) => {
  const preferred = ['collection.anki21b', 'collection.anki21', 'collection.anki2']
  const files = []

  for (const name of preferred) {
    const file = zip.file(name)
    if (file) files.push(file)
  }

  return files.length > 0 ? files : zip.file(/collection\.anki2.*/i)
}

const getTableRows = (db: { exec: (sql: string) => SqlResult[] }, sql: string): Record<string, unknown>[] => {
  const result = db.exec(sql)[0]
  if (!result) return []

  return result.values.map((row: unknown[]) =>
    result.columns.reduce<Record<string, unknown>>((accumulator: Record<string, unknown>, column: string, index: number) => {
      accumulator[column] = row[index]
      return accumulator
    }, {}),
  )
}

const tableExists = (db: { exec: (sql: string) => SqlResult[] }, tableName: string) =>
  getTableRows(
    db,
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName.replace(/'/g, "''")}' LIMIT 1`,
  ).length > 0

const safeJsonRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'string' || value.trim().length === 0) return {}

  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

const getCollectionCrt = (database: initSqlJs.Database) => {
  const colRow = getTableRows(database, 'SELECT crt FROM col LIMIT 1')[0] as { crt?: number } | undefined
  return Number(colRow?.crt ?? 0)
}

const getDeckMeta = (database: initSqlJs.Database) => {
  const deckMeta: Record<string, AnkiDeckMeta> = {}

  const colRow = getTableRows(database, 'SELECT decks FROM col LIMIT 1')[0] as { decks?: string } | undefined
  const legacyDecks = safeJsonRecord(colRow?.decks)

  for (const [id, value] of Object.entries(legacyDecks)) {
    const entry = value as { name?: string }
    deckMeta[id] = {
      id,
      name: entry.name?.trim() || `Imported deck ${id}`,
    }
  }

  if (tableExists(database, 'decks')) {
    for (const row of getTableRows(database, 'SELECT id, name FROM decks')) {
      const id = String(row.id)
      const name = String(row.name ?? '').trim()
      if (!name) continue

      deckMeta[id] = {
        id,
        name,
      }
    }
  }

  return deckMeta
}

const getFieldNamesByNoteType = (database: initSqlJs.Database) => {
  const fieldNamesByNoteType: Record<string, string[]> = {}

  if (tableExists(database, 'fields')) {
    for (const row of getTableRows(database, 'SELECT ntid, ord, name FROM fields ORDER BY ntid, ord')) {
      const noteTypeId = String(row.ntid)
      const order = Number(row.ord ?? 0)
      fieldNamesByNoteType[noteTypeId] ??= []
      fieldNamesByNoteType[noteTypeId][order] = String(row.name ?? '').trim()
    }
  }

  const colRow = getTableRows(database, 'SELECT models FROM col LIMIT 1')[0] as { models?: string } | undefined
  const legacyModels = safeJsonRecord(colRow?.models)

  for (const [id, value] of Object.entries(legacyModels)) {
    const model = value as { flds?: Array<{ name?: string }> }
    if (!Array.isArray(model.flds)) continue

    fieldNamesByNoteType[id] = model.flds.map((field) => field.name?.trim() || '')
  }

  return fieldNamesByNoteType
}

const preferredFrontFieldPattern = /^(front|question|q|câu hỏi|cau hoi|mặt trước|mat truoc|term|prompt)$/i
const preferredBackFieldPattern = /^(back|answer|a|đáp án|dap an|mặt sau|mat sau|definition|response)$/i

const chooseFieldIndex = (fields: string[], fieldNames: string[], pattern: RegExp, excludedIndex?: number) => {
  const namedIndex = fieldNames.findIndex(
    (name, index) => index !== excludedIndex && pattern.test(name) && hasVisibleContent(fields[index] ?? ''),
  )

  if (namedIndex >= 0) return namedIndex

  return fields.findIndex((field, index) => index !== excludedIndex && hasVisibleContent(field))
}

const selectApkgCardContent = (fields: string[], fieldNames: string[]) => {
  const frontIndex = chooseFieldIndex(fields, fieldNames, preferredFrontFieldPattern)
  const backIndex = chooseFieldIndex(fields, fieldNames, preferredBackFieldPattern, frontIndex)

  const front = frontIndex >= 0 ? fields[frontIndex] : ''
  const back =
    backIndex >= 0
      ? fields[backIndex]
      : fields
          .filter((field, index) => index !== frontIndex && hasVisibleContent(field))
          .join('<br /><br />')

  return {
    front,
    back,
  }
}

const buildDueDate = (queue: number, due: number, interval: number, collectionCrt: number) => {
  const now = Date.now()

  if (queue === 0 || queue === 1) {
    return new Date(now).toISOString()
  }

  if (queue < 0) {
    return new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString()
  }

  if (due > 0 && collectionCrt > 0) {
    return new Date(collectionCrt * 1000 + due * 24 * 60 * 60 * 1000).toISOString()
  }

  if (interval > 0) {
    return new Date(now + interval * 24 * 60 * 60 * 1000).toISOString()
  }

  return new Date(now).toISOString()
}

const parseApkgImport = async (file: File): Promise<ImportResult> => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const collectionFiles = findCollectionFiles(zip)

  if (collectionFiles.length === 0) {
    throw new Error('APKG is missing collection database.')
  }

  const SQL = await getSql()
  let database: initSqlJs.Database | null = null
  let skippedUnsupportedPlaceholderCards = 0

  for (const collectionFile of collectionFiles) {
    const candidateDatabase = new SQL.Database(new Uint8Array(await readCollectionDatabaseBytes(collectionFile)))
    const placeholderCount = getTableRows(candidateDatabase, 'SELECT flds FROM notes')
      .filter((row) => isUnsupportedAnkiPlaceholder(String(row.flds ?? ''), '')).length
    const cardCount = getTableRows(candidateDatabase, 'SELECT id FROM cards LIMIT 2').length

    if (placeholderCount > 0 && cardCount <= placeholderCount && collectionFile.name !== 'collection.anki21b') {
      skippedUnsupportedPlaceholderCards += placeholderCount
      candidateDatabase.close()
      continue
    }

    database = candidateDatabase
    break
  }

  if (!database) {
    throw new Error(
      'Tệp này chỉ chứa trình giữ chỗ tương thích với Anki. Hãy xuất lại bộ thẻ từ Anki mới nhất dạng .apkg hoặc .colpkg rồi nhập lại.',
    )
  }

  const collectionCrt = getCollectionCrt(database)
  const deckMeta = getDeckMeta(database)
  const fieldNamesByNoteType = getFieldNamesByNoteType(database)

  const notes = getTableRows(database, 'SELECT id, mid, flds, tags FROM notes').reduce<Record<string, AnkiNote>>(
    (accumulator: Record<string, AnkiNote>, row: Record<string, unknown>) => {
      const noteTypeId = String(row.mid)
      accumulator[String(row.id)] = {
        fields: String(row.flds ?? '').split('\u001f'),
        fieldNames: fieldNamesByNoteType[noteTypeId] ?? [],
        tags: String(row.tags ?? '')
          .split(' ')
          .map((tag) => tag.trim())
          .filter(Boolean),
      }
      return accumulator
    },
    {},
  )

  const deckMap = new Map<string, Deck>()

  for (const row of getTableRows(database, 'SELECT id, nid, did, due, ivl, factor, queue, reps FROM cards')) {
    const note = notes[String(row.nid)]
    if (!note) continue

    const fields = note.fields.map((field: string) => normalizeImportedField(field))
    const { front, back } = selectApkgCardContent(fields, note.fieldNames)

    if (isUnsupportedAnkiPlaceholder(front, back)) {
      skippedUnsupportedPlaceholderCards += 1
      continue
    }

    if (!hasVisibleContent(front) && !hasVisibleContent(back)) continue

    const did = String(row.did)
    const meta = deckMeta[did]
    const name = meta?.name || `Imported deck ${did}`
    const category = name.includes('::') ? name.split('::')[0] : 'Anki'

    if (!deckMap.has(did)) {
      deckMap.set(did, {
        id: makeDeckId(`apkg-${did}`),
        name,
        description: `Imported from ${file.name}`,
        language: 'Imported',
        category,
        createdAt: new Date().toISOString(),
        cards: [],
      })
    }

    deckMap.get(did)?.cards.push({
      id: makeDeckId(`apkg-card-${row.id}`),
      front,
      back,
      tags: note.tags,
      ease: typeof row.factor === 'number' && row.factor > 0 ? row.factor / 1000 : 2.5,
      interval: typeof row.ivl === 'number' && row.ivl > 0 ? row.ivl : 1,
      step: typeof row.reps === 'number' ? row.reps : 0,
      dueAt: buildDueDate(
        Number(row.queue ?? 0),
        Number(row.due ?? 0),
        Number(row.ivl ?? 0),
        collectionCrt,
      ),
    })
  }

  const decks = [...deckMap.values()].filter((deck) => deck.cards.length > 0)

  if (decks.length === 0) {
    if (skippedUnsupportedPlaceholderCards > 0) {
      throw new Error(
        'Tệp này chỉ chứa trình giữ chỗ tương thích với Anki. Hãy xuất lại bộ thẻ từ Anki mới nhất dạng .apkg hoặc .colpkg rồi nhập lại.',
      )
    }

    throw new Error('APKG parsed but no supported cards were found.')
  }

  return {
    format: 'apkg',
    payload: decks,
    summary: `Imported ${decks.length} deck(s) and ${decks.reduce((sum, deck) => sum + deck.cards.length, 0)} card(s) from APKG.`,
  }
}

export const parseImportFile = async (file: File): Promise<ImportResult> => {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension === 'json') {
    return parseJsonImport(file)
  }

  if (extension === 'apkg' || extension === 'colpkg') {
    return parseApkgImport(file)
  }

  throw new Error('Unsupported file type. Use JSON, APKG, or COLPKG.')
}
