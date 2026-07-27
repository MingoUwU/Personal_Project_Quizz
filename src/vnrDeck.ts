import type { Deck } from './types'
import vnrQuizSource from './vnrQuizBank.json?raw'

export const VNR_DECK_ID = 'deck-vnr'

type OptionLabel = 'a' | 'b' | 'c' | 'd'

interface RawVnrQuestion {
  id: number
  question: string
  options: Record<OptionLabel, string>
  correct_answer: OptionLabel
}

interface RawVnrQuizBank {
  questions: RawVnrQuestion[]
}

const malformedQuestionIds = new Set([316, 319, 340, 342, 347, 354, 356, 357])

// These are later repetitions or close paraphrases of questions retained elsewhere
// in the same source. Question 57 is dropped in favor of the clearer question 283.
const duplicateQuestionIds = new Set([
  57, 254, 262, 268, 272, 284, 285, 290, 293, 297, 312, 315, 318, 320, 322, 324, 325, 329, 332, 334, 338, 339,
  341, 343, 345, 346, 349, 351, 353, 355,
])

const normalizeQuestion = (question: string) =>
  question
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/\u0111/gu, 'd')
    .replace(/[^a-z0-9]+/gu, '')

const parseVnrQuizBank = (source: string) => {
  const parsed = JSON.parse(source) as RawVnrQuizBank

  if (!Array.isArray(parsed.questions) || parsed.questions.length !== 357) {
    throw new Error(`Expected 357 VNR questions, found ${parsed.questions?.length ?? 0}.`)
  }

  const seenQuestions = new Set<string>()

  return parsed.questions.filter((item) => {
    if (
      !Number.isInteger(item.id) ||
      !item.question?.trim() ||
      !item.options?.a ||
      !item.options?.b ||
      !item.options?.c ||
      !item.options?.d ||
      !['a', 'b', 'c', 'd'].includes(item.correct_answer) ||
      !item.options[item.correct_answer]
    ) {
      throw new Error(`Invalid VNR question ${item.id}.`)
    }

    if (malformedQuestionIds.has(item.id) || duplicateQuestionIds.has(item.id)) return false

    const normalizedQuestion = normalizeQuestion(item.question)
    if (seenQuestions.has(normalizedQuestion)) return false

    seenQuestions.add(normalizedQuestion)
    return true
  })
}

const vnrQuestions = parseVnrQuizBank(vnrQuizSource)
const optionLabels: readonly OptionLabel[] = ['a', 'b', 'c', 'd']

export const vnrDeck: Deck = {
  id: VNR_DECK_ID,
  name: 'VNR',
  description: 'Bộ câu hỏi trắc nghiệm Lịch sử Đảng, đã lọc câu trùng và các mục lỗi cấu trúc.',
  language: 'Tiếng Việt',
  category: 'Lịch sử Đảng',
  createdAt: '2026-07-27T00:00:00.000Z',
  cards: vnrQuestions.map((item) => ({
    id: `${VNR_DECK_ID}-card-${item.id}`,
    front: [
      item.question.trim(),
      '',
      ...optionLabels.map((label) => `${label}. ${item.options[label].trim()}`),
    ].join('\n'),
    back: `${item.correct_answer}. ${item.options[item.correct_answer].trim()}`,
    tags: ['vnr', 'lich-su-dang', 'multiple-choice'],
    ease: 2.5,
    interval: 1,
    step: 0,
  })),
}
