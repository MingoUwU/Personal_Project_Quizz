import type { Deck } from './types'
import prm393DetailedQuizSource from './prm393DetailedQuizBank.txt?raw'
import prm393QuizSource from './prm393QuizBank.txt?raw'
import prm393ModuleQuizSource from './prm393ModuleQuizBank.txt?raw'

export const PRM393_DECK_ID = 'deck-flutter-fundamentals'

type OptionLabel = 'a' | 'b' | 'c' | 'd'

interface QuizItem {
  question: string
  options: Record<OptionLabel, string>
  answer: OptionLabel
  explanation?: string
}

interface NumberedQuizItem extends QuizItem {
  sourceNumber: number
}

const flutterQuizItems: readonly QuizItem[] = [
  {
    question: 'Which Flutter package is commonly used for simple key-value storage?',
    options: { a: 'shared_preferences', b: 'sqflite', c: 'http', d: 'provider' },
    answer: 'a',
  },
  {
    question: 'What happens if local storage fails?',
    options: { a: 'App crashes', b: 'Fallback logic is required', c: 'Data syncs', d: 'UI freezes' },
    answer: 'b',
  },
  {
    question: 'What is the purpose of the path_provider package?',
    options: {
      a: 'Manage network paths',
      b: 'Find commonly used locations on the host file system',
      c: 'Encrypt data',
      d: 'Style the UI',
    },
    answer: 'b',
  },
  {
    question: 'When should you prefer Provider over setState()?',
    options: { a: 'For navigation', b: 'For global or shared state', c: 'For animations', d: 'For simple UI updates' },
    answer: 'b',
  },
  {
    question: 'Which Provider method listens for changes and rebuilds UI?',
    options: { a: 'listen()', b: 'select()', c: 'watch()', d: 'read()' },
    answer: 'c',
  },
  {
    question: 'Which method is used to update the UI when state changes?',
    options: { a: 'build()', b: 'dispose()', c: 'setState()', d: 'initState()' },
    answer: 'c',
  },
  {
    question: 'What is the benefit of using named routes?',
    options: {
      a: 'Faster performance',
      b: 'Better animations',
      c: 'Easier navigation management in large apps',
      d: 'Reduced memory usage',
    },
    answer: 'c',
  },
  {
    question: 'Why is understanding the widget lifecycle important?',
    options: {
      a: 'Reduce file size',
      b: 'Manage UI updates correctly',
      c: 'Deploy apps faster',
      d: 'Improve API performance',
    },
    answer: 'b',
  },
  {
    question: 'What is the purpose of focusNode in a TextField?',
    options: {
      a: 'Style the input',
      b: 'Control which widget has keyboard focus',
      c: 'Handle validation',
      d: 'Manage text value',
    },
    answer: 'b',
  },
  {
    question: 'What is Dart primarily designed for in the Flutter ecosystem?',
    options: {
      a: 'Database management',
      b: 'Network security',
      c: 'User interface development',
      d: 'General-purpose programming with UI focus',
    },
    answer: 'd',
  },
  {
    question: 'What is the main benefit of using Maps in Dart?',
    options: {
      a: 'Storing key-value pairs',
      b: 'Rendering UI components',
      c: 'Storing values without keys',
      d: 'Managing asynchronous tasks',
    },
    answer: 'a',
  },
  {
    question: 'How is the Flutter UI constructed internally?',
    options: {
      a: 'Using native UI components only',
      b: 'Using XML layout files',
      c: 'Using HTML and CSS',
      d: 'Using a hierarchical widget tree',
    },
    answer: 'd',
  },
  {
    question: 'What is the role of the Consumer widget in Provider?',
    options: {
      a: 'Manage navigation',
      b: 'Create state',
      c: 'Listen and rebuild specific parts of the UI',
      d: 'Define themes',
    },
    answer: 'c',
  },
  {
    question: 'What does Navigator.pop() do?',
    options: { a: 'Clear stack', b: 'Close current screen', c: 'Restart app', d: 'Open a new screen' },
    answer: 'b',
  },
  {
    question: 'What happens if layout constraints are violated in Flutter?',
    options: {
      a: 'UI is automatically fixed',
      b: 'Widget is ignored',
      c: 'A layout overflow error occurs',
      d: 'App crashes silently',
    },
    answer: 'c',
  },
  {
    question: 'What is the main use of local storage in apps?',
    options: {
      a: 'Manage network hardware',
      b: 'Host web servers',
      c: 'Compile code',
      d: 'Persist user settings and small data',
    },
    answer: 'd',
  },
  {
    question: 'Which database package provides SQL support in Flutter?',
    options: { a: 'path', b: 'hive', c: 'shared_preferences', d: 'sqflite' },
    answer: 'd',
  },
  {
    question: 'What is the main purpose of control flow statements in Dart?',
    options: {
      a: 'To store data permanently',
      b: 'To control the execution order of code',
      c: 'To handle network requests',
      d: 'To manage UI layout',
    },
    answer: 'b',
  },
  {
    question: 'Which widget allows overlapping of its child widgets?',
    options: { a: 'Row', b: 'Column', c: 'Stack', d: 'Expanded' },
    answer: 'c',
  },
  {
    question: 'What is a route in Flutter?',
    options: {
      a: 'A theme configuration',
      b: 'An abstraction for a screen or page',
      c: 'A database path',
      d: 'A network request',
    },
    answer: 'b',
  },
  {
    question: 'What is the primary role of widgets in Flutter?',
    options: {
      a: 'Handling network requests',
      b: 'Compiling Dart code',
      c: 'Describing the user interface',
      d: 'Managing databases',
    },
    answer: 'c',
  },
  {
    question: 'What is the purpose of onSaved callback?',
    options: { a: 'Reset form', b: 'Store form values', c: 'Display errors', d: 'Validate input' },
    answer: 'b',
  },
  {
    question: 'What problem does state lifting help solve?',
    options: { a: 'API errors', b: 'Sharing state between widgets', c: 'Layout overflow', d: 'UI rendering' },
    answer: 'b',
  },
  {
    question: 'What is the main advantage of Navigator 2.0?',
    options: {
      a: 'Simpler code',
      b: 'Faster rendering',
      c: 'Better control over the navigation stack',
      d: 'Automatic themes',
    },
    answer: 'c',
  },
  {
    question: 'Which widget is commonly used as the root of a Flutter app?',
    options: { a: 'Column', b: 'Container', c: 'Scaffold', d: 'MaterialApp' },
    answer: 'd',
  },
  {
    question: 'What is the role of the version property in openDatabase()?',
    options: {
      a: 'Database schema version for migrations',
      b: 'App version',
      c: 'Flutter SDK version',
      d: 'Package version',
    },
    answer: 'a',
  },
  {
    question: 'What is session expiration?',
    options: { a: 'API limit', b: 'Automatic logout after inactivity', c: 'UI timeout', d: 'Theme reset' },
    answer: 'b',
  },
  {
    question: 'What is the primary benefit of InheritedWidget?',
    options: {
      a: 'State persistence',
      b: 'Efficient data propagation',
      c: 'Automatic layout',
      d: 'Memory management',
    },
    answer: 'b',
  },
  {
    question: 'What is the main role of Navigator in Flutter?',
    options: { a: 'Screen navigation', b: 'API calls', c: 'Theme management', d: 'State management' },
    answer: 'a',
  },
  {
    question: 'What benefit does using a centralized theme provide?',
    options: {
      a: 'Better state management',
      b: 'Faster API calls',
      c: 'Reduced widget rebuilds',
      d: 'Consistent UI appearance',
    },
    answer: 'd',
  },
  {
    question: 'What does context.read() do in Provider?',
    options: { a: 'Reads value without listening', b: 'Disposes provider', c: 'Creates provider', d: 'Listens to changes' },
    answer: 'a',
  },
  {
    question: 'What is the primary purpose of ThemeData in Flutter?',
    options: {
      a: 'Handle state changes',
      b: 'Manage navigation',
      c: 'Define application-wide visual styles',
      d: 'Control animations',
    },
    answer: 'c',
  },
  {
    question: 'What is the primary purpose of the Dart programming language in Flutter?',
    options: {
      a: 'Running backend servers',
      b: 'Managing databases',
      c: 'Building user interfaces and application logic',
      d: 'Handling operating system processes',
    },
    answer: 'c',
  },
  {
    question: 'What is the main difference between StatelessWidget and StatefulWidget?',
    options: {
      a: 'Rendering engine',
      b: 'Performance',
      c: 'Ability to hold mutable state',
      d: 'Platform compatibility',
    },
    answer: 'c',
  },
  {
    question: 'What does the build() method return in a widget?',
    options: {
      a: 'A screen',
      b: 'Rendered pixels',
      c: 'A widget tree describing the UI',
      d: 'Application state',
    },
    answer: 'c',
  },
  {
    question: 'What role does the Flutter framework play in application development?',
    options: {
      a: 'It runs backend business logic',
      b: 'It provides UI components and rendering logic',
      c: 'It replaces the operating system',
      d: 'It manages database servers',
    },
    answer: 'b',
  },
  {
    question: 'Which HTTP method is typically used to retrieve data?',
    options: { a: 'PUT', b: 'GET', c: 'DELETE', d: 'POST' },
    answer: 'b',
  },
  {
    question: "What is the main benefit of Flutter's widget-based architecture?",
    options: {
      a: 'Widgets allow code reuse across platforms',
      b: 'Widgets replace backend services',
      c: 'Widgets automatically manage databases',
      d: 'Widgets are only used for layout design',
    },
    answer: 'a',
  },
  {
    question: 'What happens if a non-nullable variable is not initialized in Dart?',
    options: {
      a: 'A runtime exception occurs',
      b: 'A compile-time error occurs',
      c: 'The value becomes null automatically',
      d: 'The app runs normally',
    },
    answer: 'b',
  },
  {
    question: 'Which control structure is used to repeat a block of code in Dart?',
    options: { a: 'if', b: 'for', c: 'try', d: 'switch' },
    answer: 'b',
  },
  {
    question: 'What does a Dart class primarily represent?',
    options: {
      a: 'A network request',
      b: 'A blueprint for creating objects',
      c: 'A database table',
      d: 'A UI widget only',
    },
    answer: 'b',
  },
  {
    question: 'What is an API timeout used for?',
    options: { a: 'Retry requests', b: 'Encrypt data', c: 'Speed up UI', d: 'Prevent waiting indefinitely' },
    answer: 'd',
  },
  {
    question: 'What is the primary responsibility of the setState() method?',
    options: { a: 'Navigate screens', b: 'Handle async tasks', c: 'Trigger widget rebuild', d: 'Persist data' },
    answer: 'c',
  },
  {
    question: 'What is the main purpose of the Container widget?',
    options: {
      a: 'Navigation',
      b: 'State management',
      c: 'Layout, styling, and positioning',
      d: 'Network requests',
    },
    answer: 'c',
  },
  {
    question: 'What does crossAxisAlignment control?',
    options: {
      a: 'Vertical alignment in Column',
      b: 'Horizontal alignment in Column',
      c: 'Child order',
      d: 'Widget size',
    },
    answer: 'b',
  },
  {
    question: 'What is the main purpose of app architecture?',
    options: { a: 'UI design', b: 'Organize code structure', c: 'Improve animations', d: 'Handle API' },
    answer: 'b',
  },
  {
    question: 'What is the main advantage of using Provider?',
    options: {
      a: 'Faster rendering',
      b: 'Simpler state sharing and management',
      c: 'Improved navigation',
      d: 'Better animations',
    },
    answer: 'b',
  },
  {
    question: 'What is the role of the Expanded widget?',
    options: {
      a: 'Force a widget to take available space',
      b: 'Align widgets',
      c: 'Fix widget size',
      d: 'Add margin',
    },
    answer: 'a',
  },
  {
    question: "Which statement best describes Flutter's layout system?",
    options: {
      a: 'Child controls parent size',
      b: 'Parent sets constraints, child chooses size',
      c: 'Based on absolute positioning',
      d: 'Uses XML layouts',
    },
    answer: 'b',
  },
  {
    question: 'What does the decoration property in TextField allow?',
    options: {
      a: 'Change font size',
      b: 'Manage state',
      c: 'Add labels, icons, and hint text',
      d: 'Control focus',
    },
    answer: 'c',
  },
]

const optionLabels: readonly OptionLabel[] = ['a', 'b', 'c', 'd']

const parseQuizSource = (source: string): QuizItem[] =>
  source
    .trim()
    .split(/\r?\n\s*\r?\n/u)
    .map((block, index) => {
      const lines = block
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
      const questionMatch = lines[0]?.match(
        /^(.*?)\s+A\.\s+(.*?)\s+B\.\s+(.*?)\s+C\.\s+(.*?)\s+D\.\s+(.*?)$/u,
      )
      const answerMatch = lines[1]?.match(/^([A-D])\.\s+(.+)$/u)

      if (lines.length !== 2 || !questionMatch || !answerMatch) {
        throw new Error(`Invalid PRM393 question block ${index + 1}.`)
      }

      const answer = answerMatch[1].toLowerCase() as OptionLabel
      const options: Record<OptionLabel, string> = {
        a: questionMatch[2],
        b: questionMatch[3],
        c: questionMatch[4],
        d: questionMatch[5],
      }

      if (options[answer] !== answerMatch[2]) {
        throw new Error(`PRM393 answer does not match its option in block ${index + 1}.`)
      }

      return {
        question: questionMatch[1],
        options,
        answer,
      }
    })

const knownInvalidDetailedQuizBlocks = new Set([163, 174, 196, 257, 299])

const parseDetailedQuizSource = (source: string): NumberedQuizItem[] => {
  const normalizedSource = source.replace(/\u23ce/gu, '\n').replace(/\r/gu, '')
  const sections = [
    ...normalizedSource.matchAll(/Question\s+(\d+)\.\s*([\s\S]*?)(?=\n\s*Question\s+\d+\.|$)/gu),
  ]

  if (sections.length !== 252) {
    throw new Error(`Expected 252 detailed PRM393 questions, found ${sections.length}.`)
  }

  return sections.flatMap((section) => {
    const sourceNumber = Number(section[1])
    const body = section[2].trim()
    const answerIndex = body.lastIndexOf('\nAnswer:')

    if (answerIndex < 0) {
      throw new Error(`Detailed PRM393 question ${sourceNumber} is missing its answer.`)
    }

    const prompt = body.slice(0, answerIndex).trim()
    const answerText = body.slice(answerIndex + 1).trim()
    const markers = [...prompt.matchAll(/^\s*([A-D])\.\s+/gmu)]
    const hasFourOrderedOptions =
      markers.length === 4 && markers.map((marker) => marker[1]).join('') === 'ABCD'
    const answerMatch = answerText.match(/^Answer:\s*([A-D])\.\s*([\s\S]*)$/u)

    if (!hasFourOrderedOptions || !answerMatch) {
      if (knownInvalidDetailedQuizBlocks.has(sourceNumber)) return []
      throw new Error(`Invalid detailed PRM393 question ${sourceNumber}.`)
    }

    const options = markers.reduce<Partial<Record<OptionLabel, string>>>((result, marker, index) => {
      const label = marker[1].toLowerCase() as OptionLabel
      const nextMarker = markers[index + 1]
      result[label] = prompt
        .slice((marker.index ?? 0) + marker[0].length, nextMarker?.index ?? prompt.length)
        .trim()
      return result
    }, {})
    const answer = answerMatch[1].toLowerCase() as OptionLabel

    if (!options.a || !options.b || !options.c || !options.d || !options[answer]) {
      throw new Error(`Detailed PRM393 question ${sourceNumber} has an incomplete option set.`)
    }

    return [{
      sourceNumber,
      question: prompt.slice(0, markers[0].index).trim(),
      options: options as Record<OptionLabel, string>,
      answer,
      explanation: answerMatch[2].trim(),
    }]
  })
}

const normalizeQuestion = (question: string) =>
  question
    .toLowerCase()
    .replace(/^\[m\d+\]\s*/u, '')
    .replace(/[^a-z0-9]+/gu, '')

const isCodeLogicQuestion = (question: string) => {
  if (question.includes('\n')) return true

  const inlineCodeSamples = [...question.matchAll(/`([^`]+)`/gu)].map((match) => match[1])

  return inlineCodeSamples.some((sample) =>
    /(?:=>|[;{}]|\b(?:var|final|const|late|dynamic|bool|int|double|String)\s+\w+\s*=|\bfor\s*\()/u.test(
      sample,
    ),
  )
}

// These blocks ask for facts already covered by the existing PRM393 bank,
// even when their wording or answer choices differ.
const duplicateModuleQuizBlocks = new Set([
  1, 2, 3, 5, 12, 13, 14, 15, 16, 18, 23, 24, 25, 26, 31, 32, 34, 35, 36, 38, 40, 41, 43, 44, 45, 47, 48, 49,
  50, 54, 60, 72, 78, 81, 82, 83, 84, 88, 102, 103, 115,
])

const moduleQuizItems = parseQuizSource(prm393ModuleQuizSource).filter(
  (_item, index) => !duplicateModuleQuizBlocks.has(index + 1),
)

const duplicateDetailedQuizBlocks = new Set([
  1, 2, 4, 5, 11, 12, 13, 15, 17, 26, 31, 44, 51, 53, 55, 57, 59, 62, 65, 70, 76, 92, 101, 102, 106, 109,
  112, 114, 123, 127, 129, 131, 132, 134, 143, 147, 151, 152, 155, 157, 158, 173, 177, 178, 180, 182,
  184, 186, 188, 202, 203, 205, 208, 217, 227, 228, 236, 243, 245, 253, 260, 267, 270, 277, 278, 282,
  283, 287, 289, 297, 302, 303, 308, 309,
])

const detailedQuizItems = parseDetailedQuizSource(prm393DetailedQuizSource).filter(
  (item) => !duplicateDetailedQuizBlocks.has(item.sourceNumber),
)

const quizItems = [
  ...flutterQuizItems,
  ...parseQuizSource(prm393QuizSource),
  ...moduleQuizItems,
  ...detailedQuizItems,
]
  .filter((item) => !isCodeLogicQuestion(item.question))
  .filter(
    (item, index, items) =>
      items.findIndex((candidate) => normalizeQuestion(candidate.question) === normalizeQuestion(item.question)) === index,
  )

export const prm393Deck: Deck = {
  id: PRM393_DECK_ID,
  name: 'PRM393',
  description: 'A multiple-choice review deck covering Flutter, Dart, widgets, state, storage, navigation, testing, and tooling.',
  language: 'English',
  category: 'Flutter',
  createdAt: '2026-07-26T00:00:00.000Z',
  cards: quizItems.map((item, index) => ({
    id: `${PRM393_DECK_ID}-card-${index + 1}`,
    front: [
      item.question,
      '',
      ...optionLabels.map((label) => `${label}. ${item.options[label]}`),
    ].join('\n'),
    back: [
      `${item.answer}. ${item.options[item.answer]}`,
      item.explanation ? `\n\n${item.explanation}` : '',
    ].join(''),
    tags: ['flutter', 'multiple-choice'],
    ease: 2.5,
    interval: 1,
    step: 0,
  })),
}
