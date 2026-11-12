# Мастерская блоков / Block Workshop

**Технический MVP; Android/Yandex QA pending.** Рабочее название. Одна бесконечная партия 10×10, 37 исходных форм, три фигуры. Phaser 4.2.1 + TypeScript 5.9.2 + Vite. Обычный интерфейс полностью внутри Canvas.

## Запуск

Нужен Node.js 22+ (проверены 22.23.4 и 24.22.1). Откройте терминал в папке клонированного проекта с package.json:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run dev
```

Откройте адрес **localhost**, напечатанный Vite. Двойной щелчок по `index.html` не запускает ES modules корректно.

```sh
npm run check
npm run preview -- --host 0.0.0.0
```

`npm run check`: typecheck → unit/regression tests → production build → assets/notices/размер dist.

Для автоматических браузерных тестов на машине с доступным Chromium:

```sh
npx playwright install chromium firefox webkit
npm run build
npm run test:e2e
```

Playwright проверяет production Canvas в Chromium, Firefox и WebKit. В этой среде локальный Chromium ограничен запретом AF_UNIX; результаты GitHub Actions и фактические ограничения фиксируются в [отчёте миграции](docs/PHASER_MIGRATION.md). Физический Android и реальный SDK требуют отдельного QA.

## Проверка на Android

Подробный чек-лист: [docs/ANDROID_YANDEX_QA.md](docs/ANDROID_YANDEX_QA.md). Для LAN-проверки через dev server требуется явно разрешить точный IP компьютера; на неизвестном host игра требует Yandex SDK. Production-сборка не читает dev allowlist.

## Что реализовано

- Исходные 10×10, формы, очистка пересечений, scoring/streak/perfect clear и touch lift 40 логических px.
- Версионированный snapshot поля/набора/очков/streak/использованной награды; независимые best/mute/volume/locale.
- Правила на главном экране, Settings, живое RU/EN, музыка и эффекты с отдельной громкостью.
- SDK bootstrap до UI/аудио; LoadingAPI после кадра; независимые SDK/browser/manual/ad/transition/startup паузы.
- Interstitial на подтверждённой новой партии. Destination применяется по callback, без ожидания SDK resume; cover показывается только при onOpen.
- Rewarded-замена всех трёх фигур один раз за партию, только при onRewarded; набор заранее имеет хотя бы один ход. Запоздавшие callbacks не меняют новую партию или закрытое приложение.
- Standalone не показывает рекламу и **не выдаёт фиктивные награды**. В Яндекс-сборке провал SDK останавливает bootstrap.
- Нет PWA, service worker, внешних шрифтов и ассетов Cozy Gallery. Синтезированные WAV воспроизводятся тем же аудиослоем Cozy.

## Происхождение и границы

- Игра: `viliceq/10block@93dfa7eaf785043d038a4e5f20ba358d90f6edd9`, MIT; полный оригинальный архив и все исходные тесты находятся в `reference/`.
- Платформенные модули: `whil3true/pairs_and_paths@da4a7612c870ce75d678b939a491157ae3670883`, перенесены по указанию владельца. Донор не изменялся.
- Полные уведомления: [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). Перенос: [docs/PROVENANCE.md](docs/PROVENANCE.md).
- Campaign/daily/cloud/leaderboard/shop/rotate отсутствуют. RNG после reload не воспроизводит будущую выдачу детерминированно.
- Миграция разрабатывается в `feature/phaser-migration`, Draft PR в `dev`; merge выполняет владелец. Архитектура: [docs/PHASER_MIGRATION.md](docs/PHASER_MIGRATION.md).

## GitHub Pages (тестовая версия)

В репозитории `whil3true/block_workshop` CI проверяет Node 22, unit/regression,
production build и Chromium/Firefox/WebKit E2E. Только **успешный push в `dev`** инициирует
GitHub Pages deployment. `main` не используется для публикации preview.

1. GitHub → Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Actions → **Quality gates and Pages preview** → проверить `verify` и `deploy-pages`.
3. Тестовый адрес: https://whil3true.github.io/block_workshop/

Относительный `base: './'` в Vite оставляет пути ассетов совместимыми с project Pages.
`whil3true.github.io` в standalone allowlist: здесь нет настоящих рекламных показов
и rewarded не выдаётся автоматически. Это не замена проверки Yandex draft.
Проверь звук и touch на реальном Android; отдельно проверь SDK-callbacks на Яндекс Играх.
