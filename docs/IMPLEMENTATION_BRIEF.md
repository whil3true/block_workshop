## 15. Готовое техническое задание для третьего чата Work

Следующий блок можно передать агенту вместе с этим отчётом. Это **задание на будущую реализацию**; в ходе текущего исследования оно не выполнялось.

---

# BLOCK PLACEMENT MVP — IMPLEMENTATION BRIEF

**Роль:** Senior HTML5 Game Engineer.  
**Цель:** создать ограниченный качественный MVP отдельной коммерческой HTML5-игры под Яндекс Игры, используя `10block` и проверенные платформенные решения Cozy Gallery. Бюджет первого цикла 12–20 активных часов; реальный Android — обязательный gate перед публикационной готовностью.

### A. Исходники и границы

1. Основа механики/UI: https://github.com/viliceq/10block, commit **`93dfa7eaf785043d038a4e5f20ba358d90f6edd9`**, MIT. Сохранить полный notice.
2. Платформенный донор: https://github.com/whil3true/pairs_and_paths, проверенный commit **`da4a7612c870ce75d678b939a491157ae3670883`**, ветка `dev`. Перед копированием сравнить актуальный `dev`: новый commit не означает автоматически новую проверенную базу.
3. Стратегия **B**: сохранить TypeScript/DOM/CSS, Vite и чистое ядро `10block`. Phaser не добавлять без обнаруженной технической необходимости.
4. Работать в новом изолированном проекте. Cozy — read-only donor. Не переносить campaign, scenes, gallery, Pair Connect domain и production asset bundle. Текущая задача не разрешает менять ветки/делать push/merge в Cozy.
5. Читать приложенный отчёт, особенно sections 3–4 и 11–14. Не считать текущий MVP уже разрешённым к публикации.

### B. Сначала воспроизвести baseline

- Зафиксировать SHA/NOTICE, Node и package-lock.
- `npm ci --ignore-scripts --no-audit --no-fund`, `npm run test:run`, `npm run build`.
- Ожидаемая исследовательская точка — 379 tests; если состояние отличается, объяснить разницу до массовых изменений.
- Сохранить 10×10, 37 форм и исходные правила очистки/счёта на первом шаге. Исправить выявленный desktop HUD overlap.

### C. Продуктовый scope

- Один endless-режим, три фигуры, preview, score/best, одновременные row/column clears, game-over/restart.
- Версионированный snapshot: board, tray IDs, score, streak, app/schema/rules version. Конечные неотрицательные числа, валидные формы/размеры, безопасный fallback при испорченном storage.
- Краткое обучение на первом старте, Settings, RU/EN без reload, звук/музыка с независимыми уровнями громкости.
- Одна rewarded-замена набора и interstitial на осознанном новом старте/переходе. Бесплатный новый старт доступен.
- Без campaign/daily/leaderboard/cloud/shop/rotate/сложного метапрогресса в первом цикле.
- Новый storage prefix и бренд; никаких сохранённых ключей `pairs-and-paths:*` и случайного удаления чужого прогресса.

### D. Платформенная интеграция

Переносить реализации, сохраняя поведение:

- `PlatformService`, `YandexPlatform`, `YandexSdkTypes`, `createPlatform`, `WebPlatform`, `InterstitialController`.
- AudioManager/HtmlAudioOutput/AudioSettings/BrowserAudioLifecycle и store настроек; новый компактный manifest, разрешённые реальные media.
- Locale precedence/store и механизм live-language; словарь составить под новую игру.
- BrowserGameplayLifecycle; pause reasons и навигационную транзакцию; DOM cover с новым CSS.

DOM adapters реализовать явно:

1. Platform и SDK listeners создаются до игрового UI/аудио. Поздние потребители сразу учитывают `isPaused`.
2. `ready()` один раз после первого интерактивного кадра, а не после начала сетевой загрузки. Phaser whitelist/POST_RENDER не импортировать в DOM.
3. Input блокируется на SDK pause, hidden/browser pause и переходе. Текущий drag отменяется с удалением ghost/preview. Проверять запрет также у game actions, а не только через CSS `pointer-events`.
4. Причины паузы независимы: SDK resume не снимает browser/manual pause. Аудио и gameplay marker согласованы с фактическим running-state.
5. DOM navigation cover появляется на реальном onOpen и убирается после готовности destination; при cooldown/no-fill не делать пустую промежуточную сцену.
6. По рекламному close/error выполнить сохранённый destination ровно один раз; не ждать SDK resume для завершения навигационного Promise, не генерировать искусственный resume.
7. Rewarded flag — только `onRewarded`; результат связан с session ID, применяется один раз в безопасном состоянии. Запоздавший callback не меняет новую партию.
8. Бонус-набор должен иметь минимум одну легальную постановку на текущем поле; подготовить его до предложения просмотра. Повторный pending request исключён.
9. Убрать из Яндекс-продукта PWA install/update/service-worker flows и внешние fonts. Не давать старому cache показывать stale build.
10. Standalone fallback работает только на явно поддержанных dev/preview hosts. В Яндекс-сборке провал SDK не маскируется бесплатной наградой.

Не создавать универсальную библиотеку/монорепозиторий в рамках MVP. Предпочесть небольшой набор модулей с ясными контрактами и provenance.

### E. Проверки приёмки

Сохранить существующие значимые engine/input/storage tests; дополнить тестами поведения, а не строк исходников:

- Одновременная очистка пересекающихся строк/столбцов, score считается один раз.
- Остался хотя бы один возможный ход — game-over не объявляется; невозможность всех оставшихся фигур — объявляется.
- Restore сохраняет board/tray/score/streak; плохая версия, неизвестные IDs, NaN/Infinity/отрицательные значения безопасно обрабатываются.
- Drag cancel, background в середине drag, resize/orientation, крайние клетки и поднятая touch-фигура.
- Один pending ad; close before resume/resume before close; no-fill/error/throw/watchdog; нет double navigation.
- Rewarded с/без `onRewarded`, повторный callback, reset/exit во время рекламы; старое состояние не меняется.
- Browser hidden + SDK pause в обоих порядках; исчезновение одной причины не снимает вторую.
- RU/EN switch/reload, недоступный localStorage, mute/volume persistence.

В CI: Node 22, `npm ci`, typecheck, unit/regression suite, production build, минимальный smoke, проверка отсутствующих локальных assets и notices, размер dist. Старые 10k Pair Connect simulations не копировать; они не проверяют block puzzle.

### F. Реальный Android/Yandex gate

Зафиксировать устройство/браузер/SHA. Проверить POCO пользователя или доступное реальное Android-устройство: несколько обычных партий, постановки у всех краёв, drag cancel, toolbar changes, landscape/portrait, background/foreground, звук после первого тапа, reload. В Yandex draft — настоящий interstitial/rewarded и разные порядки callbacks, возврат управления, отсутствие flash старой партии и наград за простой close.

Если устройство или draft недоступны, результат подписать **«MVP; Android/Yandex QA pending»** и дать точные шаги проверки. Не объявлять browser emulation аппаратным Android QA.

### G. Что вернуть пользователю

Рабочий отдельный проект/сборку, перечень перенесённых файлов и необходимых изменений, результаты проверок с ограничениями, новые third-party notices, список блокеров/остаточных задач и оценку времени до публикационного кандидата. Не называть MVP опубликованной или готовой к модерации игрой.

---

