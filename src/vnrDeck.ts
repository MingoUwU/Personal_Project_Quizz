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

const normalizeQuestion = (question: string) =>
  question
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/\u0111/gu, 'd')
    .replace(/[^a-z0-9]+/gu, '')

const parseVnrQuizBank = (source: string) => {
  const parsed = JSON.parse(source) as RawVnrQuizBank

  if (!Array.isArray(parsed.questions) || parsed.questions.length !== 364) {
    throw new Error(`Expected 364 VNR questions, found ${parsed.questions?.length ?? 0}.`)
  }

  const seenQuestions = new Set<string>()

  return parsed.questions.map((item) => {
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

    const normalizedQuestion = normalizeQuestion(item.question)
    if (seenQuestions.has(normalizedQuestion)) {
      throw new Error(`Duplicate VNR question ${item.id}.`)
    }

    seenQuestions.add(normalizedQuestion)
    return item
  })
}

const vnrQuestions = parseVnrQuizBank(vnrQuizSource)
const optionLabels: readonly OptionLabel[] = ['a', 'b', 'c', 'd']

export const vnrDeck: Deck = {
  id: VNR_DECK_ID,
  name: 'VNR',
  description: 'Bộ câu hỏi Lịch sử Đảng từ PDF 730 câu, đã chuẩn hóa, đối chiếu đáp án và loại bản trùng lỗi.',
  language: 'Tiếng Việt',
  category: 'Lịch sử Đảng',
  createdAt: '2026-07-27T00:00:00.000Z',
  cards: vnrQuestions.map((item) => ({
    id: `${VNR_DECK_ID}-v2-card-${item.id}`,
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
