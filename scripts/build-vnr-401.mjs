import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..')
const sourcePath = process.argv[2]

if (!sourcePath) {
  throw new Error('Usage: node scripts/build-vnr-401.mjs <normalized-bank.json>')
}

const source = JSON.parse(fs.readFileSync(path.resolve(sourcePath), 'utf8'))
const existing = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'src', 'vnrQuizBank.json'), 'utf8'),
)

const normalize = (value = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/\u0111/gu, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()

const compact = (value = '') => normalize(value).replace(/\s+/gu, '')

const bigrams = (value) => {
  const normalized = compact(value)
  if (normalized.length < 2) return new Set([normalized])

  return new Set(
    Array.from({ length: normalized.length - 1 }, (_, index) =>
      normalized.slice(index, index + 2),
    ),
  )
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

const sourceOptions = (question) =>
  Array.isArray(question.options) ? question.options : Object.values(question.options ?? {})

const existingAnswerText = (question) =>
  question.options?.[question.correct_answer] ?? ''

const optionSetSimilarity = (leftQuestion, rightQuestion) => {
  const leftOptions = sourceOptions(leftQuestion)
  const rightOptions = sourceOptions(rightQuestion)
  if (leftOptions.length === 0 || rightOptions.length === 0) return 0

  return (
    leftOptions
      .map((leftOption) =>
        Math.max(...rightOptions.map((rightOption) => dice(leftOption, rightOption))),
      )
      .reduce((sum, score) => sum + score, 0) / leftOptions.length
  )
}

const mapExistingAnswer = (candidate, targetOptions) => {
  const candidateAnswer = existingAnswerText(candidate)
  if (!candidateAnswer) return null

  const similarities = targetOptions.map((option) => dice(candidateAnswer, option))
  const bestSimilarity = Math.max(...similarities)
  const bestIndex = similarities.indexOf(bestSimilarity)

  if (bestSimilarity >= 0.72) {
    return {
      answer_index: bestIndex,
      answer_similarity: bestSimilarity,
      source_question_id: candidate.id,
      source_answer_detection: candidate.answer_detection,
    }
  }

  if ('abcd'.includes(candidate.correct_answer)) {
    return {
      answer_index: 'abcd'.indexOf(candidate.correct_answer),
      answer_similarity: similarities['abcd'.indexOf(candidate.correct_answer)] ?? 0,
      source_question_id: candidate.id,
      source_answer_detection: candidate.answer_detection,
    }
  }

  return null
}

const embeddedOptionMarkers = (text) =>
  [...text.matchAll(/(?:^|\s)([A-Z]{1,2})\.\s*/gu)].map((match) => ({
    index: (match.index ?? 0) + match[0].indexOf(match[1]),
    label: match[1],
  }))

const baseQuestionBeforeEmbeddedOptions = (question) => {
  const questionMarkers = embeddedOptionMarkers(question.question)
  if (questionMarkers.length === 0) return null

  const combinedText = [question.question, ...sourceOptions(question)].join('\n')
  if (embeddedOptionMarkers(combinedText).length < 3) return null

  const baseQuestion = question.question.slice(0, questionMarkers[0].index).trim()
  return baseQuestion.length >= 12 ? baseQuestion : null
}

const cleanOptions = (question) => {
  const options = [...sourceOptions(question)].map((option) => option.trim())
  const embeddedLabels = ['a', 'b', 'c', 'd']
  const allOptionsRepeatTheirLabels = options.every((option, index) =>
    new RegExp(`^${embeddedLabels[index]}[.,)]\\s*`, 'iu').test(option),
  )

  if (allOptionsRepeatTheirLabels) {
    options.forEach((option, index) => {
      options[index] = option.replace(
        new RegExp(`^${embeddedLabels[index]}[.,)]\\s*`, 'iu'),
        '',
      )
    })
  }

  // This PDF row accidentally carries the next question's M-P options after "25 nước."
  if (question.id === 327) {
    options[3] = '25 nước.'
  }

  return options
}

const existingQuestions = existing.questions.filter(
  (question) =>
    question.question &&
    question.options &&
    'abcd'.includes(question.correct_answer),
)
const sourceMarkedQuestions = source.questions.filter(
  (question) =>
    question.answer_index != null && sourceOptions(question).length === 4,
)

const droppedMalformed = []
const droppedStructuralDuplicates = []
const answerAudit = []
const retained = []

for (const question of source.questions) {
  if (sourceOptions(question).length !== 4) {
    droppedMalformed.push({
      id: question.id,
      source_number: question.source_number,
      question: question.question,
      reason: 'missing_four_options',
    })
    continue
  }

  const embeddedBaseQuestion = baseQuestionBeforeEmbeddedOptions(question)
  if (embeddedBaseQuestion) {
    const cleanDuplicate = source.questions
      .filter((candidate) => candidate.id !== question.id)
      .map((candidate) => ({
        candidate,
        similarity: dice(embeddedBaseQuestion, candidate.question),
      }))
      .filter(({ similarity }) => similarity >= 0.975)
      .sort((left, right) => right.similarity - left.similarity)[0]

    if (cleanDuplicate) {
      droppedStructuralDuplicates.push({
        id: question.id,
        source_number: question.source_number,
        question: question.question,
        base_question: embeddedBaseQuestion,
        retained_question_id: cleanDuplicate.candidate.id,
        similarity: cleanDuplicate.similarity,
        reason: 'embedded_options_duplicate',
      })
      continue
    }
  }

  const options = cleanOptions(question)
  let answerIndex = question.answer_index
  let answerMethod = question.answer_method
  let answerEvidence = null

  if (answerIndex == null) {
    const exactCandidates = existingQuestions
      .filter((candidate) => compact(candidate.question) === compact(question.question))
      .map((candidate) => ({
        candidate,
        mapped: mapExistingAnswer(candidate, options),
        option_similarity: optionSetSimilarity(question, candidate),
      }))
      .filter(({ mapped }) => mapped)
      .sort((left, right) => right.option_similarity - left.option_similarity)

    let selected = exactCandidates[0] ?? null
    let questionSimilarity = selected ? 1 : 0
    let combinedSimilarity = selected ? selected.option_similarity : 0

    if (!selected) {
      selected = existingQuestions
        .map((candidate) => {
          const mapped = mapExistingAnswer(candidate, options)
          const candidateQuestionSimilarity = dice(question.question, candidate.question)
          const candidateOptionSimilarity = optionSetSimilarity(question, candidate)

          return {
            candidate,
            mapped,
            question_similarity: candidateQuestionSimilarity,
            option_similarity: candidateOptionSimilarity,
            combined_similarity:
              candidateQuestionSimilarity * 0.72 + candidateOptionSimilarity * 0.28,
          }
        })
        .filter(
          ({ mapped, question_similarity: candidateQuestionSimilarity, combined_similarity }) =>
            mapped &&
            candidateQuestionSimilarity >= 0.86 &&
            combined_similarity >= 0.9,
        )
        .sort((left, right) => right.combined_similarity - left.combined_similarity)[0] ?? null

      questionSimilarity = selected?.question_similarity ?? 0
      combinedSimilarity = selected?.combined_similarity ?? 0
    }

    if (!selected?.mapped) {
      const markedMatch =
        sourceMarkedQuestions
          .filter((candidate) => candidate.id !== question.id)
          .map((candidate) => ({
            candidate,
            question_similarity: dice(question.question, candidate.question),
            option_similarity: optionSetSimilarity(question, candidate),
          }))
          .map((match) => ({
            ...match,
            combined_similarity:
              match.question_similarity * 0.72 + match.option_similarity * 0.28,
          }))
          .filter(
            ({ question_similarity: candidateQuestionSimilarity, combined_similarity }) =>
              candidateQuestionSimilarity >= 0.86 && combined_similarity >= 0.9,
          )
          .sort((left, right) => right.combined_similarity - left.combined_similarity)[0] ?? null

      if (markedMatch) {
        const candidateAnswerText =
          sourceOptions(markedMatch.candidate)[markedMatch.candidate.answer_index]
        const similarities = options.map((option) => dice(candidateAnswerText, option))
        const mappedIndex = similarities.indexOf(Math.max(...similarities))

        answerIndex = mappedIndex
        answerMethod = 'cross_reference_source_mark'
        answerEvidence = {
          source_question_id: markedMatch.candidate.id,
          question_similarity: markedMatch.question_similarity,
          option_similarity: markedMatch.option_similarity,
          combined_similarity: markedMatch.combined_similarity,
        }
      }
    } else {
      answerIndex = selected.mapped.answer_index
      answerMethod = 'cross_reference_existing_vnr'
      answerEvidence = {
        source_question_id: selected.mapped.source_question_id,
        source_answer_detection: selected.mapped.source_answer_detection,
        question_similarity: questionSimilarity,
        option_similarity: selected.option_similarity,
        combined_similarity: combinedSimilarity,
        answer_similarity: selected.mapped.answer_similarity,
      }
    }
  }

  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
    throw new Error(`Could not resolve answer for VNR question ${question.id}.`)
  }

  const answerLetter = 'abcd'[answerIndex]
  answerAudit.push({
    id: question.id,
    source_number: question.source_number,
    answer_letter: answerLetter,
    answer_method: answerMethod,
    evidence: answerEvidence,
  })

  retained.push({
    id: question.id,
    source_question_number: question.source_number,
    question: question.question.trim(),
    options: {
      a: options[0],
      b: options[1],
      c: options[2],
      d: options[3],
    },
    correct_answer: answerLetter,
    answer_detection: answerMethod,
  })
}

const seenQuestions = new Map()
for (const question of retained) {
  const normalizedQuestion = compact(question.question)
  const previous = seenQuestions.get(normalizedQuestion)
  if (previous) {
    throw new Error(
      `Duplicate retained VNR questions ${previous.id} and ${question.id}: ${question.question}`,
    )
  }
  seenQuestions.set(normalizedQuestion, question)
}

const methodCounts = answerAudit.reduce((counts, item) => {
  counts[item.answer_method] = (counts[item.answer_method] ?? 0) + 1
  return counts
}, {})

const bank = {
  title: 'Bộ câu hỏi trắc nghiệm Lịch sử Đảng - PDF 730 câu đã chuẩn hóa',
  source_occurrences: source.stats.pdf_question_occurrences,
  normalized_questions: source.stats.unique_questions,
  retained_unique_questions: retained.length,
  answer_status:
    'Giữ đáp án có dấu trong PDF; câu không có dấu được đối chiếu với bộ VNR đã phân tích; bản lặp bị dính phương án và mục thiếu lựa chọn đã loại.',
  answer_method_counts: methodCounts,
  questions: retained,
}

const report = {
  source_stats: source.stats,
  retained_unique_questions: retained.length,
  answer_method_counts: methodCounts,
  dropped_malformed: droppedMalformed,
  dropped_structural_duplicates: droppedStructuralDuplicates,
  answer_audit: answerAudit,
}

const bankPath = path.join(repositoryRoot, 'src', 'vnrQuizBank.json')
const reportPath = path.join(repositoryRoot, 'output', 'decks', 'vnr-401-resolved-report.json')
fs.mkdirSync(path.dirname(reportPath), { recursive: true })
fs.writeFileSync(bankPath, `${JSON.stringify(bank, null, 2)}\n`, 'utf8')
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(
  JSON.stringify(
    {
      bank: path.relative(repositoryRoot, bankPath),
      report: path.relative(repositoryRoot, reportPath),
      retained_unique_questions: retained.length,
      answer_method_counts: methodCounts,
      dropped_malformed: droppedMalformed.length,
      dropped_structural_duplicates: droppedStructuralDuplicates.length,
    },
    null,
    2,
  ),
)
