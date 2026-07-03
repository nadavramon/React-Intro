# Product

## Register

product

## Users

A solo developer (the project owner) using this as a hands-on way to learn React 19 + TypeScript. The context is deliberate practice: building several small, self-contained apps side by side to understand hooks, routing, state, styling, and a real API integration. The "user" is also the builder, so the job-to-be-done is twofold: write clear, idiomatic code worth learning from, and end up with interfaces that are genuinely satisfying to use rather than throwaway demos.

## Product Purpose

A learning sandbox that hosts a handful of small apps under one shell: a click-counter, tic-tac-toe, and a todo list backed by a real Express + JWT server. It exists to learn the modern React stack (Vite, Tailwind v4, shadcn/radix, React Router v7, axios) by doing, not by tutorial-following.

Success is two things at once: the code stays clear and explainable (it's a teaching codebase), and the UI feels intentionally designed with a point of view, not like an untouched component-library default. A little app can still be a delight to open.

## Brand Personality

Playful, confident, retro-arcade. The voice is fun but not childish: it leans into game-and-arcade energy (it literally contains games) with enough craft that it reads as a deliberate aesthetic, not a gimmick. Using it should feel energetic and a touch nostalgic, never sterile or corporate.

Three words: **playful, bold, crafted.**

## Anti-references

Explicitly should NOT look like:

- **Generic SaaS dashboard:** cream/blue palettes, rounded cards everywhere, the hero-metric template. Tasteful but forgettable.
- **Untouched shadcn/Tailwind:** the recognizable out-of-the-box look with no point of view.
- **Corporate / enterprise stiff:** buttoned-up, conservative, committee-designed.
- **Overdesigned / cluttered:** effects and decoration drowning the function. Boldness is not an excuse for noise.

## Design Principles

1. **Learning-first, never lazy.** Clarity of code and clarity of design both matter. Reaching for a template default as a shortcut is off-limits, in the markup and in the UI.
2. **A tool can have a point of view.** This is a product surface (design serves use), but it should still feel distinctive and retro-arcade, not neutral dev-tool beige.
3. **Earn the boldness.** Distinctive comes from one committed aesthetic carried consistently, not from piling on effects. When in doubt, commit harder to the idea, not louder to the decoration.
4. **Playful, not childish.** Arcade energy with real craft and restraint underneath it.
5. **Bold never costs usability.** Visual boldness must coexist with accessibility; if a choice forces a trade-off against legibility or keyboard use, usability wins.

## Accessibility & Inclusion

Target **WCAG AA**: body text at AA contrast (including against saturated/neon arcade backgrounds, which is the hard case), full keyboard navigation for all interactive elements, and honor `prefers-reduced-motion` with a calm fallback for any animation. Because the aesthetic leans on bright color, never rely on color alone to convey state (win/lose, completed/active): pair it with text, shape, or icon.
