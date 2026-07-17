# AGENTS.md - AI Assistant Guide for Chobble Client

## Project Overview

**Chobble Client** is a content repository that merges with the [Chobble Template](https://git.chobble.com/chobble/chobble-template) at build time to produce a static website. It uses **Bun** as the package manager and runtime.

### Architecture

This project separates content from template:
- **This repo** (`chobble-client`): Site content, custom styles, build scripts
- **Chobble Template**: Eleventy SSG, themes, components, collections

At build time, GitHub Actions merges both repos via sparse-checkout, then runs Eleventy.

---

## Quick Reference

### Essential Commands
```bash
bun install          # Install dependencies (MUST use bun, not npm)
bun run build        # Build the site
bun run serve        # Development server with hot reload
bun run test         # Run tests
bun run lint         # Check code with Biome
bun run lint:fix     # Auto-fix lint issues
bun run cpd          # Copy-paste detection on scripts/
```

### Directory Structure
```
chobble-client/
├── scripts/         # Build utilities and tooling
├── _data/           # Site configuration (site.json, meta.json)
├── pages/           # Content pages (markdown)
├── css/             # Custom stylesheets
├── images/          # Site images
├── .pages.yml       # CMS configuration
├── biome.json       # Linting config (extends js-toolkit base)
├── bunfig.toml      # Bun test configuration
└── .jscpd.json      # Copy-paste detection config
```

---

## Functional Programming Style

This codebase uses a functional programming approach with curried, composable functions. **This is ideal for a static site generator**, which is fundamentally a series of transforms with no mutable state:

```
Content Files → Parse → Transform → Filter → Sort → Render → Static HTML
```

Each step is a pure function. Data flows through pipelines without mutation.

### Why FP for Static Sites?

1. **Transforms, not mutations**: SSGs transform input files to output files
2. **Composability**: Build complex operations from simple, testable pieces
3. **Predictability**: Pure functions always produce the same output
4. **Debuggability**: No hidden state changes to track down

### Import Aliases

Use the `#fp` alias for functional utilities:

```javascript
import { pipe, filter, map, unique } from "#fp";
import { memoize } from "#fp/memoize";
import { sortBy } from "#fp/sorting";
```

---

## Functional Utilities (`#fp`)

### Core Composition

| Function | Purpose | Example |
|----------|---------|---------|
| `pipe(...fns)` | Compose functions left-to-right | `pipe(filter(x), map(y))(arr)` |

### Curried Array Operations

| Function | Purpose | Example |
|----------|---------|---------|
| `filter(pred)` | Curried array filter | `filter(x => x > 0)(arr)` |
| `map(fn)` | Curried array map | `map(x => x * 2)(arr)` |
| `flatMap(fn)` | Curried array flatMap | `flatMap(x => [x, x])(arr)` |
| `reduce(fn, init)` | Curried array reduce | `reduce((a, x) => a + x, 0)(arr)` |
| `sort(cmp)` | Non-mutating sort | `sort((a, b) => a - b)(arr)` |
| `sortBy(key)` | Sort by property/getter | `sortBy('name')(users)` |

### Deduplication & Filtering

| Function | Purpose | Example |
|----------|---------|---------|
| `unique(arr)` | Remove duplicates | `unique([1, 1, 2])` → `[1, 2]` |
| `uniqueBy(fn)` | Dedupe by key | `uniqueBy(x => x.id)(arr)` |
| `compact(arr)` | Remove falsy values | `compact([1, null, 2])` → `[1, 2]` |
| `filterMap(pred, fn)` | Filter + map in one pass | `filterMap(x => x > 0, x => x * 2)(arr)` |

### Membership & Exclusion

| Function | Purpose | Example |
|----------|---------|---------|
| `memberOf(vals)` | Membership predicate | `filter(memberOf(['a', 'b']))(arr)` |
| `notMemberOf(vals)` | Exclusion predicate | `filter(notMemberOf(['x']))(arr)` |
| `exclude(vals)` | Filter out values | `exclude(['a'])(arr)` |
| `pick(keys)` | Extract object keys | `pick(['a', 'b'])(obj)` |

### Caching & Memoization

| Function | Purpose | Example |
|----------|---------|---------|
| `memoize(fn, opts?)` | Cache results | `memoize(fn, { cacheKey })` |
| `indexBy(getKey)` | Build cached lookup | `indexBy(x => x.id)(arr)` |
| `groupByWithCache(fn)` | Build cached grouping | `groupByWithCache(x => x.tags)(arr)` |

### Utilities

| Function | Purpose | Example |
|----------|---------|---------|
| `pluralize(s, p?)` | Format count | `pluralize('item')(3)` → `"3 items"` |
| `accumulate(fn)` | Safe array building in reduce | See below |

### Example: Processing Content

```javascript
import { pipe, filter, map, sortBy, unique } from "#fp";

// Process blog posts: filter drafts, extract tags, sort by date
const processedPosts = pipe(
  filter(post => !post.draft),
  sortBy('date'),
  map(post => ({ ...post, tags: post.tags || [] }))
)(posts);

// Get all unique tags
const allTags = pipe(
  flatMap(post => post.tags),
  unique
)(processedPosts);
```

### Safe Array Building with `accumulate()`

Avoid the `noAccumulatingSpread` lint error:

```javascript
// BAD - O(n^2) performance
const ids = items.reduce((acc, item) =>
  item.id ? [...acc, item.id] : acc, []);

// GOOD - O(n) performance
import { accumulate } from "#fp";
const ids = accumulate((acc, item) => {
  if (item.id) acc.push(item.id);
  return acc;
})(items);
```

---

## Linting Rules (Biome)

The project enforces strict code quality via Biome.

### Must Follow

| Rule | Requirement |
|------|-------------|
| `useArrowFunction` | Use arrow functions |
| `useTemplate` | Use template literals |
| `useConst` | Use const (or let when reassignment needed) |
| `noVar` | Never use var |
| `noDoubleEquals` | Use `===`, not `==` |
| `noForEach` | Use `for...of` or curried `map`/`filter` |
| `noAccumulatingSpread` | Use `accumulate()` helper |
| `noUnusedImports` | Remove unused imports |
| `noUnusedVariables` | Remove unused variables |
| `noExcessiveCognitiveComplexity` | Max complexity: 7 (30 in tests) |
| `noConsole` | No console.log except in scripts/ |

### Formatting
- 2-space indentation
- Run `bun run lint:fix` to auto-format

---

## Anti-Patterns to Avoid

1. **Don't use npm** - This project requires Bun
2. **Don't use `forEach`** - Use `for...of` loops or curried `map`/`filter`
3. **Don't accumulate with spread** - Use `accumulate()` helper for O(1) operations
4. **Don't use `var`** - Always use `const` (or `let` when reassignment needed)
5. **Don't use `==`** - Always use `===`
6. **Don't add console.log** - Except in build scripts
7. **Don't exceed complexity 7** - Break complex functions into smaller pieces
8. **Don't mutate data** - Create new objects/arrays instead

---

## When Making Changes

1. **Read existing code first** - Understand patterns before modifying
2. **Follow existing conventions** - Match the style of surrounding code
3. **Use functional patterns** - Prefer `pipe`, curried functions, immutability
4. **Run linter** - `bun run lint:fix` to auto-fix issues
5. **Keep functions small** - Stay under complexity limit of 7
6. **Use the #fp utilities** - They're optimized and well-tested

---

## Content Voice

GFC should sound like Luke Phillips and Jodie Higson talking to someone at the gym: experienced, straightforward and welcoming. It should not sound like an agency selling a lifestyle.

### Luke and Jodie

- Luke brings a lifetime in Muay Thai. Use real technical, competitive and coaching detail, stated without boasting.
- Jodie brings the member's point of view. Write plainly about confidence, inclusion, stress, family life and the practical work of running the gym.
- Use `we` for GFC. Use Luke or Jodie's name when the detail belongs to one of them. Never invent first-person claims or quotations.

### Writing Rules

- Lead with the actual news or useful fact.
- Prefer names, dates, places, results and concrete details over broad claims.
- Keep sentences natural and complete. A little looseness is better than polished ad copy.
- Be warm without becoming sentimental. GFC's community is shown by what people do, not by calling everything inspirational.
- Keep relevant terms such as `GFC Muay Thai`, `Muay Thai in Bury`, class names and people's names in titles, headings and opening paragraphs where they fit.
- Keep copy concise. Stop when the useful detail is covered.

### Avoid

- Marketing language such as `transformative`, `empowering`, `world-class`, `state-of-the-art` or `unleash your potential`.
- Punchy fragments, slogans, neat lists of three and cinematic endings.
- Forced northern dialect or jokes written to make the brand sound local.
- Hard sells, inflated claims and generic statements that could describe any gym.

Read the result aloud. It should sound plausible coming from Luke or Jodie in a normal conversation with a member.

## Content Layout

- Feature blocks display in rows of three on the live site. Always use a multiple of three features, such as three or six, when using this block.

## Experience And Trust Facts

Use these details to demonstrate GFC's experience and expertise. Prefer the specific fact over a broad claim such as `leading`, `best` or `highly experienced`.

### Source Rules

- Current class times, age groups and prices in `pages/timetable.md` and `pages/join.md` take priority over older articles and imported content.
- Team biographies are the source for individual experience and fight records. Do not add titles, qualifications or records that are not documented there.
- News articles can support historical claims when they name and link the original report.
- First-hand operational details supplied by Luke or Jodie can be stated as GFC's own experience. Qualify approximate percentages with words such as `around` or `roughly`.
- Do not turn a member outcome into a promise. Write that training can help with fitness, confidence or focus, not that it will produce a guaranteed result.
- Do not call GFC `the UK's leading gym` or make similar comparisons without independent evidence.

### GFC History And Facility

- Darren Phillips began Muay Thai in 1983 with Master Sken and Sandy Holt.
- Darren opened Heywood Thai Boxing Club in 1983 and established what became GFC Muay Thai in 1986.
- GFC has operated from different premises during its history. Do not include former addresses in public copy because other martial arts businesses now use them. Focus location information on the current Bright Street Mill gym.
- Luke Phillips and Jodie Higson run GFC. Members helped them prepare and reopen the Bright Street Mill gym in 2024 by carrying cement, moving wheelbarrows and helping with building work. This is covered by a linked Bury Times report in `news/gfc-muay-thai-reopens-with-members-support.md`.
- GFC describes its current facility as more than 5,000 sq ft, with 14 heavy bags, two 16 ft rings and fully matted training areas. It also has treadmills, an assault bike, a ski ergometer, weights and a preparation kitchen. See `news/ladies-only-muay-thai-sessions.md`.
- The client describes GFC as `Bury's biggest Muay Thai centre`. Use this wording rather than inventing a wider regional or national comparison.

### Coaching And Competition

- Luke began training before he was three and has more than 25 years of Muay Thai experience. He won multiple junior titles, remained unbeaten during his adult competitive career, trained extensively in Thailand and moved into full-time coaching.
- In 2006, aged nine, Luke won the UKTBA under-25kg Northern Area Junior title against Charlie Kelly over five rounds in Horwich. All three judges awarded Luke the decision by one point. The linked Bolton News report is recorded in `news/luke-gets-his-kicks-from-thai.md`.
- Luke has worked as a referee and judge at ONE Championship, Hitman Fight League and Yokkao.
- Darren completed the Sitnarong grading system, competed nationally, taught for Sandy Holt and has worked with world, European and British champions. Grand Master Sken granted him the title of Master in 2023.
- Lewis George started at GFC aged five. After an even record in his first ten fights, he won his next 50 and collected area, British, European and world titles. He has lived, trained and fought in Thailand, winning his first bout there by first-round knockout.
- Kieran Lee has more than 15 years of experience, won his first ten fights and has lived, trained and competed in Thailand.
- Daniel Oxley has more than ten years of experience. During a three-month stay in Thailand he won all three of his fights.
- Detailed biographies live in `team/`. Link to those profiles when space allows rather than compressing every credential into general page copy.

### First-Hand Class Facts

- Most members start without martial arts experience. GFC has beginner sessions and multiple coaches on the mats to help newcomers.
- Adult beginners can work at their own pace. Sessions usually include a warm-up, jogging or skipping, mobility or stretching, then a mixture of bag work, pad work and technical drills. Sessions finish with stretching and may include a short fitness round.
- Around 5% of GFC's adult members train to compete. Most train because they enjoy Muay Thai and want to keep fit.
- Beginner and All Levels adult sessions are non-contact. Sparring may be used in advanced training and takes place in the dedicated sparring session, but it is optional and coach-controlled.
- Junior classes start at age six. Sessions keep children involved by changing activities and keeping them moving.
- Roughly 20% of junior members train to compete. Most train for enjoyment and to stay active.
- Girls train across GFC's junior age groups; some classes are close to an even split between girls and boys.
- GFC regularly works with children who have ADHD. Describe the active, varied session structure and invite parents to discuss their child's needs; do not promise that one approach will suit every child.
