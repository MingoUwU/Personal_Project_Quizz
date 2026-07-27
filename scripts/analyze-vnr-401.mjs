import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..')
const sourcePath = process.argv[2]

if (!sourcePath) {
  throw new Error('Usage: node scripts/analyze-vnr-401.mjs <normalized-bank.json>')
}

const source = JSON.parse(fs.readFileSync(path.resolve(sourcePath), 'utf8'))
const existing = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'src', 'vnrQuizBank.json'), 'utf8'),
)

const normalizedTextCache = new Map()
const compactTextCache = new Map()
const bigramCache = new Map()

const normalize = (value = '') => {
  if (normalizedTextCache.has(value)) return normalizedTextCache.get(value)

  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/\u0111/gu, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()

  normalizedTextCache.set(value, normalized)
  return normalized
}

const compact = (value = '') => {
  if (compactTextCache.has(value)) return compactTextCache.get(value)

  const result = normalize(value).replace(/\s+/gu, '')
  compactTextCache.set(value, result)
  return result
}

const bigrams = (value) => {
  if (bigramCache.has(value)) return bigramCache.get(value)

  const normalized = compact(value)
  if (normalized.length < 2) {
    const result = new Set([normalized])
    bigramCache.set(value, result)
    return result
  }

  const result = new Set(
    Array.from({ length: normalized.length - 1 }, (_, index) =>
      normalized.slice(index, index + 2),
    ),
  )
  bigramCache.set(value, result)
  return result
}

const dice = (left, right) => {
  const leftPairs = bigrams(left)
  const rightPairs = bigrams(right)
  if (leftPairs.size === 0 && rightPairs.size === 0) return 1

  let intersection = 0
  leftPairs.forEach((pair) => {
    if (rightPairs.has(pair)) intersection += 1
  })

  return (2 * intersection) / (leftPairs.size + rightPairs.size)
}

const optionTexts = (question) =>
  Array.isArray(question.options) ? question.options : Object.values(question.options ?? {})

const optionSetSimilarity = (leftQuestion, rightQuestion) => {
  const leftOptions = optionTexts(leftQuestion)
  const rightOptions = optionTexts(rightQuestion)
  if (leftOptions.length === 0 || rightOptions.length === 0) return 0

  const bestMatches = leftOptions.map((leftOption) =>
    Math.max(...rightOptions.map((rightOption) => dice(leftOption, rightOption))),
  )

  return bestMatches.reduce((sum, score) => sum + score, 0) / bestMatches.length
}

const answerText = (question) => {
  if (question.answer_text) return question.answer_text
  if (question.answer_index != null && Array.isArray(question.options)) {
    return question.options[question.answer_index]
  }
  if (question.correct_answer && !Array.isArray(question.options)) {
    return question.options?.[question.correct_answer]
  }
  return ''
}

const answerLabel = (question) => {
  if (question.answer_letter) return question.answer_letter.toLowerCase()
  if (question.answer_index != null) return 'abcd'[question.answer_index]
  return question.correct_answer?.toLowerCase() ?? null
}

const mapAnswerToTarget = (candidate, target) => {
  const targetOptions = optionTexts(target)
  const candidateAnswer = answerText(candidate)
  const candidateLabel = answerLabel(candidate)

  if (!candidateAnswer || targetOptions.length !== 4) return null

  const optionScores = targetOptions.map((option) => dice(candidateAnswer, option))
  const bestScore = Math.max(...optionScores)
  const bestIndex = optionScores.indexOf(bestScore)

  if (bestScore >= 0.72) {
    return {
      answer_index: bestIndex,
      answer_letter: 'abcd'[bestIndex],
      answer_text: targetOptions[bestIndex],
      answer_similarity: bestScore,
      mapping: 'answer_text',
    }
  }

  if (
    candidateLabel &&
    compact(candidate.question) === compact(target.question) &&
    'abcd'.includes(candidateLabel)
  ) {
    const labelIndex = 'abcd'.indexOf(candidateLabel)
    return {
      answer_index: labelIndex,
      answer_letter: candidateLabel,
      answer_text: targetOptions[labelIndex],
      answer_similarity: optionScores[labelIndex] ?? 0,
      mapping: 'same_question_label',
    }
  }

  return null
}

const markedQuestions = source.questions.filter(
  (question) => question.answer_index != null && optionTexts(question).length === 4,
)
const existingQuestions = existing.questions.filter(
  (question) => question.correct_answer && optionTexts(question).length === 4,
)
const unresolvedQuestions = source.questions.filter(
  (question) => question.answer_index == null && optionTexts(question).length === 4,
)

const candidatePools = [
  ...existingQuestions.map((question) => ({ source: 'existing_vnr', question })),
  ...markedQuestions.map((question) => ({ source: 'source_marked', question })),
]

const embeddedOptionMarkers = (question) =>
  [...question.matchAll(/(?:^|\s)([A-Z]{1,2})\.\s*/gu)].map((match) => ({
    index: (match.index ?? 0) + match[0].indexOf(match[1]),
    label: match[1],
  }))

const baseQuestionBeforeEmbeddedOptions = (question) => {
  const combinedText = [question.question, ...optionTexts(question)].join('\n')
  const markers = embeddedOptionMarkers(combinedText)
  if (markers.length < 3) return null

  const baseQuestion = combinedText.slice(0, markers[0].index).trim()
  return baseQuestion.length >= 12 ? baseQuestion : null
}

const results = unresolvedQuestions.map((target) => {
  const candidates = candidatePools
    .map(({ source: candidateSource, question: candidate }) => {
      const questionSimilarity = dice(target.question, candidate.question)
      const optionsSimilarity = optionSetSimilarity(target, candidate)
      const combinedSimilarity = questionSimilarity * 0.72 + optionsSimilarity * 0.28
      const mappedAnswer = mapAnswerToTarget(candidate, target)

      return {
        source: candidateSource,
        candidate_id: candidate.id,
        candidate_question: candidate.question,
        question_similarity: questionSimilarity,
        options_similarity: optionsSimilarity,
        combined_similarity: combinedSimilarity,
        candidate_answer: answerLabel(candidate),
        mapped_answer: mappedAnswer,
      }
    })
    .filter((candidate) => candidate.mapped_answer)
    .sort((left, right) => right.combined_similarity - left.combined_similarity)
    .slice(0, 5)

  const best = candidates[0] ?? null
  const embeddedBaseQuestion = baseQuestionBeforeEmbeddedOptions(target)
  const embeddedRepairCandidates = embeddedBaseQuestion
    ? candidatePools
        .map(({ source: candidateSource, question: candidate }) => ({
          source: candidateSource,
          candidate_id: candidate.id,
          candidate_question: candidate.question,
          question_similarity: dice(embeddedBaseQuestion, candidate.question),
          candidate_answer: answerLabel(candidate),
          candidate_options: optionTexts(candidate),
        }))
        .sort((left, right) => right.question_similarity - left.question_similarity)
        .slice(0, 3)
    : []
  const embeddedSourceDuplicates = embeddedBaseQuestion
    ? source.questions
        .filter(
          (candidate) =>
            candidate.id !== target.id &&
            dice(embeddedBaseQuestion, candidate.question) === 1,
        )
        .map((candidate) => ({
          id: candidate.id,
          source_number: candidate.source_number,
          answer_letter: answerLabel(candidate),
          answer_method: candidate.answer_method,
          question: candidate.question,
        }))
    : []
  const automatic =
    best &&
    ((best.question_similarity === 1 && best.options_similarity >= 0.72) ||
      (best.combined_similarity >= 0.9 &&
        best.question_similarity >= 0.86 &&
        best.options_similarity >= 0.82))

  return {
    id: target.id,
    source_number: target.source_number,
    question: target.question,
    options: target.options,
    automatic: Boolean(automatic),
    suggested_answer: automatic ? best.mapped_answer : null,
    embedded_base_question: embeddedBaseQuestion,
    embedded_repair_candidates: embeddedRepairCandidates,
    embedded_source_duplicates: embeddedSourceDuplicates,
    best_candidates: candidates,
  }
})

const structuralSuspects = source.questions
  .map((question) => {
    const baseQuestion = baseQuestionBeforeEmbeddedOptions(question)
    if (!baseQuestion) return null

    const sourceDuplicates = source.questions
      .filter(
        (candidate) =>
          candidate.id !== question.id && dice(baseQuestion, candidate.question) >= 0.975,
      )
      .map((candidate) => ({
        id: candidate.id,
        question_similarity: dice(baseQuestion, candidate.question),
        answer_letter: answerLabel(candidate),
        answer_method: candidate.answer_method,
        question: candidate.question,
      }))
      .sort((left, right) => right.question_similarity - left.question_similarity)

    const existingMatches = existingQuestions
      .map((candidate) => ({
        id: candidate.id,
        question_similarity: dice(baseQuestion, candidate.question),
        answer_letter: answerLabel(candidate),
        question: candidate.question,
      }))
      .sort((left, right) => right.question_similarity - left.question_similarity)
      .slice(0, 3)

    return {
      id: question.id,
      source_number: question.source_number,
      base_question: baseQuestion,
      original_answer: answerLabel(question),
      original_answer_method: question.answer_method,
      source_duplicates: sourceDuplicates,
      existing_matches: existingMatches,
    }
  })
  .filter(Boolean)

const report = {
  source_stats: source.stats,
  complete_questions: source.questions.filter((question) => optionTexts(question).length === 4)
    .length,
  marked_questions: markedQuestions.length,
  unresolved_questions: unresolvedQuestions.length,
  automatically_matched: results.filter((result) => result.automatic).length,
  needs_review: results.filter((result) => !result.automatic).length,
  structural_suspects: structuralSuspects,
  results,
}

const outputPath = path.join(repositoryRoot, 'tmp', 'pdfs', 'vnr-401-match-report.json')
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(
  JSON.stringify(
    {
      output: path.relative(repositoryRoot, outputPath),
      complete_questions: report.complete_questions,
      marked_questions: report.marked_questions,
      unresolved_questions: report.unresolved_questions,
      automatically_matched: report.automatically_matched,
      needs_review: report.needs_review,
    },
    null,
    2,
  ),
)
