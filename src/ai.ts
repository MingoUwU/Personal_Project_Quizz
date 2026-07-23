import type { AiSettings, Card } from './types'

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  output_text?: string
  error?: {
    message?: string
  }
}

const stripHtml = (value: string) => {
  if (typeof DOMParser === 'undefined') {
    return value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }

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

const normalizeEndpoint = (endpoint: string) => endpoint.trim().replace(/\/+$/u, '')

export const canUseAi = (settings: AiSettings) =>
  settings.enabled && settings.apiKey.trim().length > 0 && settings.endpoint.trim().length > 0 && settings.model.trim().length > 0

export const requestAnswerFeedback = async (settings: AiSettings, card: Card) => {
  if (!canUseAi(settings)) {
    throw new Error('AI chưa được bật hoặc thiếu API key/model.')
  }

  const question = stripHtml(card.front)
  const answer = stripHtml(card.back)
  const endpoint = normalizeEndpoint(settings.endpoint)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model.trim(),
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Bạn là trợ lý ôn thi. Trả lời bằng tiếng Việt, ngắn gọn, dễ nhớ. Nếu đáp án trong thẻ thiếu hoặc có vẻ sai, hãy nói rõ mức độ không chắc và đề xuất kiểm chứng.',
        },
        {
          role: 'user',
          content: [
            'Hãy giải thích đáp án cho flashcard sau.',
            'Yêu cầu:',
            '- Nêu đáp án đúng nếu xác định được.',
            '- Giải thích vì sao đúng trong 3-5 gạch đầu dòng.',
            '- Nếu câu hỏi là trắc nghiệm và đáp án thẻ đang thiếu, hãy chọn đáp án hợp lý nhất nhưng ghi rõ là AI suy luận.',
            '',
            `Câu hỏi:\n${question}`,
            '',
            `Đáp án trong thẻ:\n${answer || '(trống)'}`,
          ].join('\n'),
        },
      ],
    }),
  })

  const payload = (await response.json().catch(() => ({}))) as ChatCompletionResponse

  if (!response.ok) {
    throw new Error(payload.error?.message || `AI request failed (${response.status}).`)
  }

  const content = payload.choices?.[0]?.message?.content || payload.output_text || ''

  if (!content.trim()) {
    throw new Error('AI không trả về nội dung.')
  }

  return content.trim()
}
