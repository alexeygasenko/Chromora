# Аудит UI, поведения окон и настроек

Дата: 23 сентября 2026. Проверено рабочее дерево ветки `codex/full-audit-2026-09-23`, включая присутствовавшие пользовательские изменения. Production-файлы не изменялись.

## Метод и границы

Прочитаны `WindowMain`, `WindowSettings`, `WindowTemplates`, `WindowTemplateCoordinates`, `WindowFilter`, `WindowWizard`, `WindowCredits`, `Overlay`, `settingsManager`, `observers`, связанный CSS и пересечения с `Template`/`templateManager`/`main`. Отдельно просмотрены JS/HTML/CSS сайта.

Воспроизводимый скрипт: `node audit/2026-09-23/ui/reproduce-ui.mjs`. Он собирает исходные классы **только в памяти** через esbuild `write:false`, не вызывает release build, не обращается к пользовательскому GM storage и не обращается к Wplace. Результаты: `reproduction-results.json`. Для геометрии скрытого фильтра приватные имена методов в диагностической копии заменены открытыми, тела методов не изменены. Применены простые DOM shims; этот прогон подтверждает вычисления и обработчики, но не является проверкой реального браузерного layout или интеграции с действующим Wplace.

Приоритеты: P1 — риск повреждения положения сохраненных шаблонов; P2 — функциональный дефект; P3 — меньший UX/lifecycle дефект. Ограничения и непроверенные предположения указаны отдельно.

## Подтвержденные находки

### UI-01 · P1 · Миграция sparse-шаблона может сдвинуть изображение на целый тайл

**Код:** `src/Template.js:360–369`, `src/templateManager.js:1306–1346`, `src/WindowWizard.js:309–320`.

`calculateCoordsFromChunked()` выбирает первый тайл верхнего ряда, затем минимальный X в этом ряду. `convertTemplateToBlob()` независимо вычисляет минимальные абсолютные X и Y по всем тайлам. Эти два начала координат расходятся, если верхний левый участок прозрачный и был пропущен.

**Сценарий:** legacy-шаблон содержит верхний правый тайл `0011,0010,000,000` и нижний левый `0010,0011,000,000`. Первый метод возвращает `[11,10,0,0]`. Blob имеет начало `[10,10,0,0]`. Wizard создает новый шаблон из этого blob по `[11,10,0,0]`, поэтому весь рисунок перемещается на **1000 пикселей вправо**. Дефект сохраняется в новом storage; простая перезагрузка его не исправляет.

**Доказательство:** `sparse-template-origin` в JSON: actual `[11,10,0,0]`, ожидаемое начало bounding image `[10,10,0,0]`, shift `[1000,0]`. Выбор начала выполнен реальным классом `Template`; итог миграционной цепочки подтвержден чтением вызовов. Полная миграция с декодированием PNG в этом прогоне не выполнялась.

**Исправление:** вычислять начало в абсолютных пикселях одинаково для blob и координат; возвращать его из операции сборки. Регрессия: sparse L-образные шаблоны, смещения внутри тайла, пустые верхние/левые сегменты.

### UI-02 · P2 · Открытие выбора координат сбрасывает размер и положение Color Filter

**Код:** `src/WindowTemplateCoordinates.css:3–5`, `src/WindowTemplateCoordinates.js:120`, `src/WindowFilter.js:1065–1104`, `src/WindowFilter.js:1112–1119`, `src/WindowFilter.js:1142–1144`.

Выбор координат добавляет класc `bm-template-coordinate-mode`; CSS скрывает остальные окна через `display:none`. `ResizeObserver` фильтра реагирует на нулевой размер и через 150 мс вызывает сохранение геометрии. Проверка учитывает `isConnected`, но не видимость. Нулевой DOMRect превращается в минимальные размеры и координаты `(8,8)`, затем записывается в настройки и inline style.

**Сценарий:** изменить фильтр до `600×500`, перенести в `(220,140)`, выбрать файл нового шаблона, остаться в выборе координат более 150 мс, нажать Cancel. Фильтр возвращается как `360×220` в `(8,8)`.

**Доказательство:** реальный метод сохранения с DOMRect скрытого элемента преобразовал `{width:600,height:500,x:220,y:140}` в `{width:360,height:220,x:8,y:8}`. Дополнительно корневой аудитор подтвердил весь путь в Chromium с CI bundle: исходный rect `(280,215,600,500)`, после включения coordinate-mode на 350 мс и отключения — `(8,8,360,220)`; сброшенная геометрия записана в GM. См. `../evidence/browser-smoke.json`.

**Исправление:** не сохранять геометрию скрытого/временно исключенного из layout окна; при coordinate-mode приостанавливать persistence. Проверять весь путь через настоящий ResizeObserver.

### UI-03 · P2 · Disable/Enable и фильтрация цветов не обновляют уже видимые тайлы

**Код:** `src/WindowMain.js:87–100`, `src/WindowFilter.js:1496`, `src/WindowFilter.js:1523–1543`, `src/templateManager.js:503–533`, `src/templateManager.js:1842–1844`; для сравнения `src/WindowFilter.js:1549–1580` вызывает refresh для highlight-кнопки.

Основная кнопка и кнопки скрытия цветов меняют внутреннее состояние/настройки, но не вызывают `requestCanvasRefresh()`. Шаблон уже нарисован в растровом изображении тайла; изменение boolean/Map не меняет опубликованную текстуру. Новое значение применяется только при следующей обработке тайла.

**Сценарий:** открыть загруженный участок, не двигать карту, нажать Disable или Hide color. Кнопка сообщает новое состояние, но слой остается до обновления тайла. То же относится к включению и Show All/Hide All. Настройки общего highlight также не запрашивают refresh после изменения.

**Доказательство:** вызовы трех реальных setter'ов обновили boolean и Map, счетчик подмененного `requestCanvasRefresh` остался **0**. Просмотрены UI callers: дополнительного refresh для этих действий нет. Внешние периодические запросы самого Wplace могут маскировать задержку; время ее проявления на действующем сервисе не измерялось.

**Исправление:** единый механизм инвалидирования при изменении параметров отображения, с объединением массовых изменений в один refresh; состояние кнопки синхронизировать с завершением/ошибкой refresh.

### UI-04 · P2 · Первый выбор Cross не включает подсветку

**Код:** `src/settingsManager.js:399`, `src/settingsManager.js:440–450`, `src/settingsManager.js:568–581`; `src/templateManager.js:1508–1524`.

При отсутствии `userSettings.highlight` сетка настроек показывает Cross. Renderer использует другой default: `[[2,0,0]]`, то есть выключенную подсветку. Нажатие Cross сравнивает preset с показанной сеткой; все клетки уже совпадают, изменения пропускаются, ключ `highlight` не записывается.

**Сценарий:** свежая установка → Settings → Pixel Highlight → Cross. На экране уже отображается крест, но даже при следующем рендере фактическое состояние остается None. Временный обход: сначала другой preset, затем Cross.

**Доказательство:** вызван реальный `buildHighlight` с перехватом DOM builder и реальный callback Cross. Сетка `Disabled,Incorrect,Disabled / Incorrect,Template,Incorrect / Disabled,Incorrect,Disabled`; после клика сохраненный highlight отсутствует; renderer fallback `[[2,0,0]]`.

**Исправление:** один источник default и прямая запись выбранного preset в модель, без симуляции кликов по текущему UI.

### UI-05 · P2 · Две одинаковые горячие клавиши тихо отключают второй режим

**Код:** `src/settingsManager.js:154–164`; `src/main.js:95`, `src/main.js:355–362`.

Сеттер проверяет только форму `KeyboardEvent.code`, но не конфликт с другой командой. Dispatcher выбирает первый режим с совпавшим кодом через `find`; порядок — matching, template.

**Сценарий:** назначить All template colors клавишу Left Alt, которая уже используется для Selected color area. UI и storage показывают одинаковую клавишу для двух команд, но она всегда активирует matching; all-colors через эту клавишу недостижим.

**Доказательство:** реальный setter сохранил два `AltLeft` и отправил обе настройки; точное выражение dispatcher выбрало `matching`.

**Исправление:** отклонять конфликт с понятным текстом либо явно обменивать назначения. Проверка нужна и при загрузке настроек.

### UI-06 · P2 · Сортировка процентов зависит от языка браузера и дает неверный порядок

**Код:** `src/utils.js:53–59`; `src/WindowFilter.js:1815`, `src/WindowFilter.js:1421–1437`; аналогичная инициализация `src/WindowFilter.js:1275`, `src/WindowFilter.js:1332`.

В `data-percent` записывается локализованная строка после удаления конечного ASCII `%`; сортировка применяет `parseFloat`. В `ru-RU/de-DE` дробная часть после запятой теряется. В `tr-TR` знак процента находится в начале, а в `ar-EG` используется другой символ, поэтому ключ становится 0 для всех цветов.

**Доказательство:** 10,99% и 10,01% в ru/de оба дали sort key 10; в tr/ar оба дали 0; en-US сохранил 10.99 и 10.01. Выполнено исходное выражение формирования ключа с реальным `Intl.NumberFormat` для пяти локалей.

**Исправление:** хранить числовой ratio в dataset независимо от отображаемой строки. Локализовать только текст; регрессии на ru/de/tr/ar.

### UI-07 · P2 · Поврежденная структура настроек блокирует действия вместо восстановления default

**Код:** `src/main.js:1158–1165`, `src/settingsManager.js:41–46`, `src/settingsManager.js:212–223`, `src/settingsManager.js:408`, `src/settingsManager.js:440`.

Общий loader проверяет лишь JSON и `typeof object`; constructor проверяет структуру hotkeys, но для flags применяет только `??= []`, для highlight структурной проверки нет. Валидный JSON `{ "flags": {} }` проходит загрузку, после чего `includes/indexOf/push` падают. Аналогично объект вместо highlight ломает `findIndex` при построении Settings.

**Доказательство:** реальный constructor принимает `{flags:{}}`; реальный `toggleFlag` бросает `this.userSettings?.flags?.indexOf is not a function`. Проверка `buildHighlight` по коду тоже обращается к отсутствующему `.includes`.

**Воздействие:** для такого повреждения Settings не открывается/не работает; это условная находка на некорректные сохраненные данные, а не утверждение, что нормальный UI сам производит этот JSON. Механизм возникновения повреждения не обнаружен.

**Исправление:** normalizer settings schema с `Array.isArray` и валидацией координат/enum; сохранять восстановленные defaults, не перезаписывая здоровые поля. Отдельно нормализовать `windowFilter`, `layoutSizes`, `windowSettings`.

### UI-08 · P2 · Ошибка миграции оставляет Wizard в бесконечном «Please wait»

**Код:** `src/WindowWizard.js:161–171`, `src/WindowWizard.js:261–287`, `src/WindowWizard.js:366–383`.

Клик отключает кнопку и вызывает async migration без `await`/`catch`. Процедура удаляет содержимое и показывает loading. При ошибке декодирования/создания/записи storage выполняется rollback, затем исключение пробрасывается. Нет восстановления UI, сообщения об ошибке или повторной попытки. У Download all также восстановление disabled находится только в `.then`, без `finally` (`src/WindowWizard.js:150–157`).

**Сценарий:** legacy-шаблон с поврежденным PNG или отказ GM.setValue → Update storage. Данные могут быть корректно откатаны, но окно остается «Updating template storage. Please wait...», а ошибка видна только в console/unhandled rejection.

**Доказательство:** статическая проверка полного success/error control flow; fault injection этой ветки в браузере не выполнялась. Ожидаемая UI-ошибка однозначна по отсутствию обработчика после throw.

**Исправление:** перехват ошибок в обработчике UI, terminal error state и Retry/Close, `finally` для disabled. Сохранять уже реализованный условный rollback.

### UI-09 · P3 · Перетаскивание может полностью убрать главное окно за экран

**Код:** `src/Overlay.js:1641–1670`, `src/WindowMain.js:109`, `src/WindowTemplates.js:103`, `src/WindowTemplateCoordinates.js:121`.

Drag использует клиентские координаты без ограничений. Для Settings и windowed Filter есть clamping через callback, но Main/Templates/Coordinates этот callback не передают; resize viewport для них также не восстанавливает координаты. У главного окна нет отдельного восстановления/перезапуска UI.

**Доказательство:** настоящие callbacks pointerdown/move/up оставили `translate3d(-170px,-315px,0)` для окна `300×180`; окно целиком выше viewport. Это синтетические координаты, реальное pointer capture за пределами viewport не воспроизводилось браузером.

**Исправление:** ограничивать положение общего drag так, чтобы оставалась доступная часть заголовка; проверять положение при viewport resize. Для главного окна полезна reset-position команда.

### UI-10 · P3 · Таймер удерживает удаленный DOM и продолжает просыпаться

**Код:** `src/Overlay.js:1195–1198`, `src/Overlay.js:1221`; `src/main.js:1300–1306` — удаление main при initialization failure.

`addTimer` не сохраняет interval ID. Ветка `!timer.isConnected` только делает return, фактический clearInterval закомментирован. После удаления окна interval и closure остаются до уничтожения страницы. В обычном успешном запуске главное окно существует всю сессию, поэтому это не растущая утечка на каждом открытии Filter; проявление — удаление main/неудачная инициализация/повторные создания таймера.

**Доказательство:** после вызова реального interval callback с отсоединенным time-element interval продолжает числиться активным.

**Исправление:** явное владение interval, cleanup при dispose; не прекращать таймер до первого mount. Аналогично SettingsManager хранит interval без dispose (`src/settingsManager.js:58`), что требует уборки при startup failure.

### UI-11 · P2 · Главное окно и фильтр выходят за экран на мобильной ширине

**Код:** `src/WindowMain.js:41`, `src/WindowMain.css:3–5`, `src/WindowMain.css:107–110`; `src/WindowFilter.js:360–364`, `src/WindowFilter.js:990–992`, `src/WindowFilter.css:1018–1032`; исходный left `src/overlay.css:56`.

Главное окно оставляет inline `right:75px`, одновременно имея ширину почти весь viewport. Поэтому его левый край оказывается отрицательным. Filter имеет min-width 360px и исходный left 60px; min-width выигрывает у меньшего max-width. JS clamp тоже отдает приоритет minimum, даже если он превышает доступную ширину.

**Сценарий:** открыть страницу с viewport 320 или 375 CSS px. Main обрезается слева, Filter справа; часть dragbar/actions оказывается за пределами видимой области, пока пользователь вручную не меняет положение.

**Доказательство:** Chromium smoke корневого аудитора для working dist, local bundle и CI bundle при 320/375px: main `x=-67.796875`; filter `x=60,width=360,right=420`. На 1280px окна Settings/Templates/Main работают. Результаты `../evidence/browser-smoke.json`; fixture использует border-box reset как у приложения, live Wplace не проверялся.

**Исправление:** mobile-specific inset и width, min-width не больше доступной ширины, viewport clamp при первом mount и resize; приемка на 320/375px с доступностью всех управляющих кнопок.

## Дополнительные UX/accessibility замечания

- **Позиция клетки в настройках highlight недоступна по имени:** `settingsManager.js:442–448` сообщает только «Sub-pixel incorrect/template/disabled», без row/column или top-left/center. Для пользователя screen reader девять клеток неразличимы по местоположению. Добавить позицию и состояние.
- **Вложенные интерактивные роли в Color Filter:** `WindowFilter.js:1677–1683` делает весь color-card `role=button`, внутри есть native кнопки visibility/highlight. Это конфликтующая семантика; следует отделить activation target от группы действий. Проверка конкретным screen reader не проводилась.
- **Окна Main/Settings/Templates/Filter не переводят фокус при открытии и не возвращают его на trigger при закрытии.** Coordinate picker явно имеет dialog label, initial focus и возврат на Add; другие окна не используют общий контракт фокуса. Их допустимо оставить немодальными, но keyboard-навигацию нужно проверять отдельно.
- **Нет keyboard-механизма resize/drag:** resize-corner фильтра объявлен `role=presentation` (`WindowFilter.js:436–438`) при наличии aria-label и поддерживает только pointer. Это доступность необязательных манипуляций окна, не блокировка основного контента.
- **Изменения flags/custom highlight сохраняются только периодическим interval:** `toggleFlag` и `#updateHighlightSettings` не вызывают immediate save. Быстрый reload до тика может потерять выбор; Settings close обычно сохраняет snapshot через сохранение позиции, но браузерный reload обходится без такого закрытия. Это подтвержденная особенность реализации; отдельной P2-находкой не посчитана из-за явно задуманного throttle.

## Что проверено и не оказалось утечкой

- `WindowFilter` владеет единственным refresh interval, отключает его при close/dispose; очищает ResizeObserver, viewport listener, wheel listener, sort dropdown document listeners и debounce timeout.
- `WindowTemplates` имеет одного owner, отключает progress interval, использует generation guards для previews/file picker и чистит template-change subscription при dispose.
- `WindowTemplateCoordinates` останавливает координатную subscription/polling и Escape listener при закрытии; запрещает Cancel во время commit; возвращает видимость других окон в finally.
- `Overlay` хранит animation ownership в WeakMap; reduced-motion учитывается в общем animation helper.
- Website theme/menu/tabs поддерживают состояния ARIA и keyboard navigation; theme storage exceptions обрабатываются.
- `node audit/2026-09-23/ui/check-website.mjs`: проверены 10 уникальных относительных HTML/CSS ресурсов сайта, все существуют; отсутствующих ARIA reference IDs, anchor IDs и дубликатов IDs нет; `<html lang>` присутствует. Результаты в `website-check-results.json`. Проверка внешних GitHub/Wplace URL и screen-reader тестирование не выполнялись; это не WCAG certification.
- `observers.js` фактически содержит пустой callback и observer в этой проверяемой ветке не активируется; «body observer утечка» именно этого класса не подтверждается. Рабочий observeBlack в main — другой механизм.

## Порядок исправления и приемка

1. Исправить координаты миграции до новых переносов legacy-шаблонов; проверить абсолютное совпадение пикселей до/после миграции.
2. Защитить persistence скрытых окон и согласовать инвалидирование renderer после UI изменений.
3. Унифицировать default highlight, запретить конфликтующие hotkeys, отделить sort data от locale display.
4. Добавить terminal error UI Wizard и normalizer settings.
5. Завершить общий window lifecycle/focus/viewport contract; проверить desktop/mobile с мышью, touch и клавиатурой.

Для UI-01/02/03/04 важны end-to-end регрессии, потому что локальные функции по отдельности выглядят корректно, а ошибка возникает на стыке storage, DOM и renderer.
