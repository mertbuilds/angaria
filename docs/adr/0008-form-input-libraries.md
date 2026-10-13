# 0008. Form input libraries: React Aria dates, Maskito, @internationalized

Accepted, 2026-10-02.

## Context

Yeni fatura, Müşteriler and Ayarlar take money, dates, rates and fixed-shape IDs (IBAN, phone, GTİP). The fields were native inputs with hand-rolled parsing: the system date picker, `type="time"`, and three separate number inputs. The UX round replaces them with one input kit in `@angaria/ui` on StyleX and Base UI, and needs libraries for the parts that are hard to get right: segment-by-segment date editing with full keyboard and screen reader support, Turkish number formatting, and masks.

Candidates and what we found:

- Base UI `NumberField` filters keystrokes and parses tr-TR "5.5" as 55. That blocks math expressions and breaks "never block typing".
- React Aria Components `DateField` and `Calendar` (with `@internationalized/date`) have the best segment editing and accessibility. They import by subpath, so only the date parts load.
- react-day-picker would add a second date model next to React Aria's. Ark UI's DatePicker would add a second headless system next to Base UI.
- chrono-node, its-a-date and any-date-parser have no usable Turkish support.
- `@internationalized/number` formats and validates tr-TR numbers (`isValidPartialNumber`, paste cleanup of `₺1.234,56`).
- Maskito handles fixed-shape masks well. `@maskito/phone`, react-imask and ibantools are heavy or redundant: the TR IBAN mod-97 check is about 15 lines.

## Decision

- Dates: `react-aria-components` `DateField` and `Calendar`, imported by subpath (`react-aria-components/DateField`, `/Calendar`, `/I18nProvider`), in tr-TR, with `@internationalized/date` `CalendarDate` as the value. The calendar renders inside the existing Base UI `Popover`, so there is one portal and focus system. Turkish natural-language dates ("dün", "geçen ay sonu") use our own parser.
- Numbers: `NumberInput` is built on Base UI `Input`, keeps the text as typed and takes `parse` and `format` from the app. `@internationalized/number` is available for tr-TR formatting and partial-number checks.
- Masks: Maskito (`@maskito/core`, `@maskito/kit`, `@maskito/react`) only for fixed-shape IDs: IBAN, phone, GTİP. Never for money, dates or VKN (VKN is digits with paste cleanup and a checksum).
- Choices: Base UI `RadioGroup` for `ChoiceChips`, Base UI `OTPField` for the SMS code. Base UI `ToggleGroup` is not used: its value is an array, meant for view switches.
- Motion: CSS and the Web Animations API with Base UI's `data-starting-style`, no motion library.
- Money stays in decimal numbers rounded per line, not integer kuruş: integer kuruş would mean migrating the persisted store, the PDF and the SDK.
- Versions live in the pnpm catalog. Every package and subpath `@angaria/ui` imports that the web's dev server must pre-bundle is listed in `uiDependencies` in `apps/web/vite.config.ts`. React, `@stylexjs/stylex` and `lucide-react` are not: the web imports them itself, so the dependency scanner finds them.

## Consequences

- About 75 kB gzipped of React Aria, in the route chunks that use a date field only.
- Two headless libraries: Base UI for everything, React Aria for dates. The calendar sits in a Base UI popover, so focus and portals stay in one system.
- A new React Aria subpath or package in `@angaria/ui` must also go into the web's `uiDependencies`, or the web dev server serves SSR 500s on a cold start.
- If the React Aria bundle turns out too heavy, the fallback is a Maskito date mask with react-day-picker (about 30 kB).
