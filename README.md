# Мастерская блоков / Block Workshop

**Технический MVP; Android/Yandex QA pending.** Рабочее название. Одна бесконечная партия 10×10, 37 исходных форм, три фигуры. TypeScript + DOM/CSS + Vite. Phaser и runtime npm-зависимостей нет.

## Запуск

Нужен Node.js 22+ (проверены 22.23.4 и 24.22.1). Распакуйте проект, откройте терминал в папке с package.json:

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
npx playwright install chromium
npm run build
npm run test:e2e
```

Браузерные E2E подготовлены, но локальный headless Chromium в исходной среде не запустился (`socket() failed: Operation not permitted`). Факт desktop-проверки через отдельный управляемый браузер описан в техническом отчёте. Это не Android QA и не успешный запуск Playwright suite.

## Проверка на Android

Подробный чек-лист: [docs/ANDROID_YANDEX_QA.md](docs/ANDROID_YANDEX_QA.md). Для LAN-проверки через dev server требуется явно разрешить точный IP компьютера; на неизвестном host игра требует Yandex SDK. Production-сборка не читает dev allowlist.

## Что реализовано

- Исходные 10×10, формы, очистка пересечений, scoring/streak/perfect clear и touch lift 32 px.
- Версионированный snapshot поля/набора/очков/streak/использованной награды; независимые best/mute/volume/locale.
- Короткое обучение при первом запуске, Settings, живое RU/EN, музыка и эффекты с отдельной громкостью.
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
- Это отдельный проект в ветке `mvp/platform`. GitHub push, PR и публикация в Яндекс Играх не выполнялись.
