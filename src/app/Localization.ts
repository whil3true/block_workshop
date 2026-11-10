export type SupportedLocale = "ru" | "en";
export const DEFAULT_LOCALE: SupportedLocale = "ru";
export const words = {
 en: {
  title: 'Block Workshop', score: 'SCORE', best: 'BEST', settings: 'Settings', play: 'Play', resume: 'Continue',
  newGame: 'New game', gameOver: 'No more moves', reward: 'New tray · video', rewardConfirm: 'Watch a video to replace all three pieces? Once per game.',
  rewardUnavailable: 'The video did not grant a reward. Your tray is unchanged.', standalone: 'Standalone preview · advertisements unavailable',
  music: 'Music', effects: 'Effects', mute: 'Mute', unmute: 'Unmute', language: 'Language', close: 'Back to game',
  rulesTitle: 'How to play', rules: 'Drag pieces onto the 10 × 10 board. Complete rows or columns to clear them. Place all three pieces to get a new tray. The game ends when none of your pieces fits.',
  restartConfirm: 'Start a new game? This board will be replaced. An advertisement may appear.', yes: 'Continue', no: 'Cancel',
  paused: 'Paused', loading: 'Loading…', error: 'Platform unavailable. Reload to retry.', combo: 'COMBO', rulesLink: 'How to play',
 },
 ru: {
  title: 'Мастерская блоков', score: 'СЧЁТ', best: 'РЕКОРД', settings: 'Настройки', play: 'Играть', resume: 'Продолжить',
  newGame: 'Новая игра', gameOver: 'Нет доступных ходов', reward: 'Новый набор · видео', rewardConfirm: 'Посмотреть видео и заменить все три фигуры? Один раз за партию.',
  rewardUnavailable: 'Видео не выдало награду. Ваш набор сохранён.', standalone: 'Предпросмотр · реклама недоступна',
  music: 'Музыка', effects: 'Эффекты', mute: 'Без звука', unmute: 'Включить звук', language: 'Язык', close: 'Вернуться в игру',
  rulesTitle: 'Как играть', rules: 'Перетаскивайте фигуры на поле 10 × 10. Заполняйте строки или столбцы, чтобы очистить их. Разместите все три фигуры — появится новый набор. Партия заканчивается, когда ни одна фигура не помещается.',
  restartConfirm: 'Начать новую партию? Текущее поле будет заменено. Возможен показ рекламы.', yes: 'Продолжить', no: 'Отмена',
  paused: 'Пауза', loading: 'Загрузка…', error: 'Платформа недоступна. Обновите страницу.', combo: 'КОМБО', rulesLink: 'Как играть',
 }
} as const;
export type Word = keyof typeof words.en;
