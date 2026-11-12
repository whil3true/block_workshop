> Исторический отчёт исходного DOM MVP от 10 ноября. Текущая архитектура и дополнительные перенесённые компоненты: [PHASER_MIGRATION.md](PHASER_MIGRATION.md).

# Происхождение кода и изменения

Дата: 10 ноября 2026. Входной отчёт прочитан полностью, раздел 15 принят как ТЗ.

## Зафиксированные источники

| Источник | Commit | Использование |
|---|---|---|
| https://github.com/viliceq/10block | `93dfa7eaf785043d038a4e5f20ba358d90f6edd9` | DOM-игра, Vite, ядро, каталог и исходные тесты |
| https://github.com/whil3true/pairs_and_paths/tree/dev | `da4a7612c870ce75d678b939a491157ae3670883` | Только platform/audio/browser lifecycle |

При чтении актуальный `dev` Cozy совпадал с SHA отчёта. `git status --porcelain` до и после работ — пустой. Ни одного изменения, push, PR или merge в доноре нет.

`engine.ts`, `pieces.ts`, `board.ts`, `tray.ts`, `layout.ts` новой игры побайтно совпадают с исходником. Новый layout adapter находится отдельно: `src/app/AppLayout.ts`. Сохраняются 10×10, 37 форм, исходные правила/порядок счёта, генерация обычных наборов.

## Модули Cozy

| Исходный путь | Путь в новой игре | Адаптация |
|---|---|---|
| src/platform/PlatformService.ts | тот же | showRewardedHint → showRewarded |
| src/platform/YandexPlatform.ts | тот же | Имя rewarded-метода/логов/комментариев; callback/watchdog семантика сохранена |
| src/platform/YandexSdkTypes.ts | тот же | Независимый SDK subset |
| src/platform/createPlatform.ts | тот же | Точный список standalone hosts, dev allowlist; production SDK error не маскируется |
| src/platform/WebPlatform.ts | тот же | Standalone reward=false, без симуляции успешной рекламы |
| src/platform/InterstitialController.ts | тот же | Сохранены single pending, 90 s cooldown и 15 s retry как настройки проекта |
| src/platform/WebAudioSettingsStore.ts | тот же | block-workshop namespace |
| src/platform/WebLocaleStore.ts | тот же | Новый namespace, импорт SupportedLocale из своего словаря |
| src/audio/AudioManager.ts | тот же | Реализация сохранена, используется новый audio manifest |
| src/audio/HtmlAudioOutput.ts | тот же | Убран неиспользуемый write-only musicPlayPending под strict noUnusedLocals; сохранены retry/token/Android release |
| src/audio/AudioSettings.ts | тот же | Без функциональной переработки |
| src/audio/BrowserAudioLifecycle.ts | тот же | Capture unlock/retry, blur/focus, visibility, pagehide/pageshow |
| src/game/BrowserGameplayLifecycle.ts | src/app/BrowserGameplayLifecycle.ts | Путь изменён; lifecycle сохранён |

Не копировались Phaser, сцены, Pair Connect domain, campaign, галерея, игровые изображения, шрифты, музыкальные записи или SFX донора. Audio reference register хранится в docs/evidence только для прозрачности решения не переносить записи автоматически.

## Новые DOM adapters

- `src/app/bootstrap.ts`: порядок создания, старт/обучение, Settings, ready после кадров, gameplay markers, DOM cover, live locale.
- `PauseGate.ts`: независимое владение причинами паузы; снимок initial isPaused.
- `AdFlow.ts`: одна рекламная транзакция на оба формата, destination once, staged reward, dispose guard.
- `LocaleRuntime.ts`, `Localization.ts`: новый RU/EN словарь и подписки без reload.
- `AppLayout.ts`: резерв HUD/трёх фигур, компактный горизонтальный tray для невысокого landscape.
- `src/audio/GameAudio.ts`: отображение игровых событий в mixer; mute не стирает пользовательские уровни.
- `storage.ts`: новая оболочка app/schemaVersion/rulesVersion, строгая проверка board/tray/numbers.
- `game.ts`: guards, сохранение первого/завершённого поля, rewardUsed и session/revision, pause cosmetic timer. Чистые scoring/clear rules не изменены.
- `drag.ts`: guard + cancel(), освобождение capture, очистка ghost/preview на pause/resize/orientation/lostcapture. Геометрия touch lift сохранена.

## Тесты источника

Baseline: все 19 файлов / 379 тестов успешно воспроизведены до изменений; production build успешен. Исходный package-lock не менялся при baseline. Запуск Node 24.22.1, npm 11.9.0.

В активном наборе сохранены 335 исходных проверок engine/input/board/tray/layout/storage/HUD/combo, с необходимой адаптацией storage namespace и нового snapshot-контракта. 44 проверки PWA/старого entrypoint/старого audio/start gate/version перенесены в reference, потому что соответствующие продуктовые компоненты удалены или заменены. Они не объявляются пройденными тестами новой runtime-интеграции.

Все исходные файлы и тесты доступны в `reference/10block-93dfa7e-source.tar.gz`; исходный lock также сохранён отдельно. Новые регрессии проверяют поведение SDK, транзакций, сохранений, mixer/browser lifecycle и реального DOM bootstrap в jsdom.

## Media и зависимости

Production npm dependencies отсутствуют. Сохранён Vite license для генерируемого preload helper; полный lock inventory — `dependency-inventory.json`. Dev dependencies не включены в `dist` и ZIP исходников node_modules не содержит.

`public/audio/*.wav` синтезированы `scripts/generate-audio.py`: семь коротких эффектов и оригинальный 32-секундный тихий арпеджио-loop, без импортированных записей/сэмплов/шрифтов. Production build включает notices. Изображения и внешние шрифты не используются.

У снимка Cozy нет общего LICENSE; его код перенесён для проекта владельца по прямому заданию. MIT чужого 10block сохранён и не используется для переобозначения прав на код владельца.

## Официальные контракты SDK

Сверены 10.11.2026 с первичными документами:

- https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv — onOpen/onClose/onRewarded.
- https://yandex.ru/dev/games/doc/ru/sdk/sdk-events — pause/resume и независимое состояние меню.
- https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events — готовность и GameplayAPI.

Проверка этих контрактов и mocks не заменяет запуск в Yandex draft.
