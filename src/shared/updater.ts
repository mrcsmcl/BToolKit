export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'downloaded'; version: string; segundosParaReiniciar: number }
  | { state: 'up-to-date' }
  | { state: 'error'; message: string }
