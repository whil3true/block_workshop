export type SupportedLocale = "ru" | "en";
export const DEFAULT_LOCALE: SupportedLocale = "ru";
export const words = {
 en: {
  shortRules: 'Fill rows or columns to clear them. Place all three pieces to receive a new tray.',
  orders: 'Orders', classic: 'Classic', studio: 'Paper mosaic studio', chapter: 'Chapter', firstLines: 'First lines', order: 'Order',
  completed: 'Completed', available: 'Open', locked: 'Locked', future: 'More orders are in the making', soon: 'Coming later',
  retry: 'Try again', toOrders: 'Order journal', nextOrder: 'Next order', orderDone: 'Order completed', sliceDone: 'First collection complete!',
  targetsLeft: 'Targets left', fragments: 'fragments', removed: 'Removed', left: 'Left', campaignUpdated: 'Orders updated', campaignReset: 'Orders now use target fragments. The old test campaign has been reset. Your Classic game, best score and settings are saved.', campaignRecovered: 'The saved order could not be restored. Start it again for free. Your Classic game and settings are saved.',
  goalDetails: 'Your order', orderRules: 'Clear every tile with a mosaic seal. Fragments can be cleared in any order. Faded cells with ticks are already removed. New tiles are ordinary tiles. Place all three pieces for a new tray.',
  rowGoal: 'Clear a row', columnGoal: 'Clear a column', targetRow: 'Clear row', targetColumn: 'Clear column', crossGoal: 'Row + column in one move',
  retryConfirm: 'Restart this order with the same board and pieces? Your completed orders stay saved.', moves: 'Moves', step: 'Step',
  intro: 'Fill a row or column.\nMake a little room for the next idea.',
  title: 'Block Workshop', score: 'Score', best: 'Best', settings: 'Settings', menu: 'Menu', play: 'Play', resume: 'Continue',
  newGame: 'New game', gameOver: 'No more moves', reward: 'New tray · video', rewardConfirm: 'Watch a video to replace all three pieces? Once per game.',
  rewardUnavailable: 'The video did not grant a reward. Your tray is unchanged.', standalone: 'Standalone preview · advertisements unavailable',
  music: 'Music', effects: 'Effects', mute: 'Mute', unmute: 'Unmute', language: 'Language', close: 'Close',
  rulesTitle: 'How to play', rules: 'Drag pieces onto the 10 × 10 board. Complete rows or columns to clear them. Place all three pieces to get a new tray. The game ends when none of your pieces fits.',
  restartConfirm: 'Start a new game? This board will be replaced. An advertisement may appear.', yes: 'Continue', no: 'Cancel',
  paused: 'Paused', loading: 'Loading…', error: 'Platform unavailable. Reload to retry.', combo: 'COMBO', rulesLink: 'How to play',
 },
 ru: {
  shortRules: 'Заполняй строки и столбцы. Размести все три фигуры — появится новый набор.',
  orders: 'Заказы', classic: 'Классика', studio: 'Студия бумажной мозаики', chapter: 'Глава', firstLines: 'Первые линии', order: 'Заказ',
  completed: 'Готово', available: 'Открыт', locked: 'Закрыт', future: 'Новые заказы ещё в работе', soon: 'Скоро',
  retry: 'Повторить', toOrders: 'К заказам', nextOrder: 'Следующий заказ', orderDone: 'Заказ выполнен', sliceDone: 'Первая коллекция готова!',
  targetsLeft: 'Целей осталось', fragments: 'фрагм.', removed: 'Удалено', left: 'Осталось', campaignUpdated: 'Заказы обновлены', campaignReset: 'Теперь цель — удалить отмеченные фрагменты. Прогресс старой тестовой кампании сброшен. Классика, рекорд и настройки сохранены.', campaignRecovered: 'Не удалось восстановить сохранённый заказ. Начните его заново бесплатно. Классика и настройки сохранены.',
  goalDetails: 'Ваш заказ', orderRules: 'Удалите все плитки со знаком мозаики, в любом порядке. Бледные клетки с галочкой уже удалены. Новые плитки — обычные. Разместите все три фигуры для нового набора.',
  rowGoal: 'Очисти строку', columnGoal: 'Очисти столбец', targetRow: 'Очисти строку', targetColumn: 'Очисти столбец', crossGoal: 'Строка и столбец за ход',
  retryConfirm: 'Начать этот заказ заново с тем же полем и фигурами? Выполненные заказы сохранятся.', moves: 'Ходы', step: 'Этап',
  intro: 'Собирай линии. Освобождай место\nдля следующей маленькой идеи.',
  title: 'Мастерская блоков', score: 'Счёт', best: 'Рекорд', settings: 'Настройки', menu: 'Меню', play: 'Играть', resume: 'Продолжить',
  newGame: 'Новая игра', gameOver: 'Нет доступных ходов', reward: 'Набор · видео', rewardConfirm: 'Посмотреть видео и заменить все три фигуры? Один раз за партию.',
  rewardUnavailable: 'Видео не выдало награду. Ваш набор сохранён.', standalone: 'Предпросмотр · реклама недоступна',
  music: 'Музыка', effects: 'Эффекты', mute: 'Без звука', unmute: 'Включить звук', language: 'Язык', close: 'Закрыть',
  rulesTitle: 'Как играть', rules: 'Перетаскивайте фигуры на поле 10 × 10. Заполняйте строки или столбцы, чтобы очистить их. Разместите все три фигуры — появится новый набор. Партия заканчивается, когда ни одна фигура не помещается.',
  restartConfirm: 'Начать новую партию? Текущее поле будет заменено. Возможен показ рекламы.', yes: 'Продолжить', no: 'Отмена',
  paused: 'Пауза', loading: 'Загрузка…', error: 'Платформа недоступна. Обновите страницу.', combo: 'КОМБО', rulesLink: 'Как играть',
 }
} as const;
export type Word = keyof typeof words.en;
