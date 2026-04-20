import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

let rl: readline.Interface | null = null

function getRl(): readline.Interface {
  if (!rl) rl = readline.createInterface({ input: stdin, output: stdout })
  return rl
}

export async function ask(question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue !== undefined ? ` (${defaultValue})` : ''
  const answer = (await getRl().question(`${question}${suffix}: `)).trim()
  return answer || defaultValue || ''
}

export async function askChoice<T extends string>(
  question: string,
  choices: readonly T[],
  defaultValue?: T,
): Promise<T> {
  const list = choices.map((c, i) => `  ${i + 1}) ${c}${c === defaultValue ? ' [default]' : ''}`).join('\n')
  while (true) {
    const raw = (await getRl().question(`${question}\n${list}\n> `)).trim()
    if (!raw && defaultValue) return defaultValue
    const num = Number(raw)
    if (Number.isInteger(num) && num >= 1 && num <= choices.length) return choices[num - 1]
    if (choices.includes(raw as T)) return raw as T
    process.stdout.write(`Invalid choice. Pick 1-${choices.length}.\n`)
  }
}

export async function askYesNo(question: string, defaultValue: boolean): Promise<boolean> {
  const suffix = defaultValue ? '[Y/n]' : '[y/N]'
  const raw = (await getRl().question(`${question} ${suffix} `)).trim().toLowerCase()
  if (!raw) return defaultValue
  return raw.startsWith('y')
}

export function closePrompts(): void {
  if (rl) {
    rl.close()
    rl = null
  }
}
