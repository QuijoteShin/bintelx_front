# DESIGN_GUIDE.md

-----

# Bintelx Front - The Unified Design System & Guide

**To the Developer:** This document is your single source of truth for building user interfaces. It merges core philosophy, a strict token-based system, advanced design patterns, and accessibility best practices into one cohesive guide. Your primary directive is to **adhere strictly to the design tokens and principles defined below.**

-----

## 1\. Core Philosophy: Feature-First Design

This principle mandates that the primary function of any given view must be the most prominent and accessible element. The UI's aesthetic and layout are subordinate to its function; they must enhance and clarify the core feature, not compete with it.

* **Prioritize the Primary Action:** The main call-to-action (e.g., "Save", "Submit") must have the highest visual weight using a high-contrast, branded color. Ancillary actions ("Cancel", "Export") must be visually subordinate using lower-emphasis styles.
* **Progressive Disclosure of Complexity:** Avoid overwhelming the user. Present essential features by default and allow users to opt-in to more complex interactions by concealing advanced controls in accordions or modals.
* **Design for the Happy Path:** The most common user workflow should be the most frictionless experience possible. Implement sensible defaults in forms to minimize user input and accelerate task completion.
* **Form Follows Function:** Every UI decision must be justifiable from a functional standpoint. Redesigning a native element, for instance, must be to enhance its function, not just for aesthetics.

-----

## 2\. The Core System: Design Tokens

These are the non-negotiable foundational building blocks. All UI elements **MUST** use these predefined CSS variables.

### 2.1. Color Palette (HSL)

* **Grays (Cool Tint):** For text, backgrounds, panels, and borders.
  * `--gray-100: hsl(210, 20%, 98%)` (Lightest, for subtle backgrounds)
  * `--gray-200: hsl(210, 20%, 94%)`
  * `--gray-300: hsl(210, 18%, 88%)` (For subtle borders)
  * `--gray-500: hsl(210, 12%, 65%)` (For tertiary/metadata text)
  * `--gray-700: hsl(210, 12%, 45%)` (For secondary text, labels)
  * `--gray-900: hsl(210, 18%, 15%)` (For primary text)
* **Primary (Brand):** For primary actions, active states, and links.
  * `--primary-100: hsl(205, 90%, 96%)` (For hover states, focus rings)
  * `--primary-500: hsl(205, 78%, 55%)` (Base for primary buttons)
  * `--primary-600: hsl(205, 70%, 48%)` (For active links)
* **Semantic (Accent):** For states like danger, warning, and success.
  * `--red-500: hsl(0, 80%, 60%)`
  * `--yellow-500: hsl(45, 90%, 55%)`
  * `--green-500: hsl(140, 60%, 45%)`

### 2.2. Spacing & Sizing Scale

Use this scale for `margin`, `padding`, `gap`, and fixed `width`/`height` values.

* `--space-xs: 0.25rem` (4px)
* `--space-sm: 0.5rem` (8px)
* `--space-md: 1rem` (16px)
* `--space-lg: 1.5rem` (24px)
* `--space-xl: 2.5rem` (40px)
* `--space-2xl: 4rem` (64px)

### 2.3. Typography Scale

* **Font Sizes:**
  * `--font-size-sm: 0.875rem` (14px)
  * `--font-size-base: 1rem` (16px)
  * `--font-size-lg: 1.125rem` (18px)
  * `--font-size-xl: 1.25rem` (20px)
  * `--font-size-2xl: 1.5rem` (24px)
  * `--font-size-3xl: 2rem` (32px)
  * `--font-size-4xl: 2.5rem` (40px)
* **Font Weights:**
  * `--font-normal: 400`
  * `--font-medium: 500`
  * `--font-bold: 700`

-----

## 3\. Guiding Systems & Rules

### 3.1. Hierarchy & Visual Separation

* **Prefer Shadows and Space over Borders:** The default method for creating separation between elements is a subtle `box-shadow` or by increasing whitespace, not a solid `border`.
* **Use Backgrounds to Separate:** Giving adjacent elements slightly different background colors is a highly effective way to create distinction.
* **Text Hierarchy:** Use color and weight, not just size. The default hierarchy is **Dark** (`--gray-900`) for primary text, **Gray** (`--gray-700`) for secondary, and **Light gray** (`--gray-500`) for tertiary/metadata.
* **Balance Weight & Contrast:** When pairing a heavy element (like an icon) with a light one (like text), reduce the contrast of the heavy element to create balance. The text should be high-contrast (`--gray-900`) while the icon is lower-contrast (`--gray-500`).

### 3.2. Typography

* **Line Height in Headings:** Headings should have a tighter line height (e.g., `1.2`) than paragraph text to feel more compact and cohesive.
* **Spacing in Uppercase Text:** Text set in all caps benefits from a slight increase in `letter-spacing` to improve readability and give it a more refined appearance.

### 3.3. Component Patterns

* **User Avatars:** To prevent an avatar's background from blending into the UI, use a subtle inner shadow for definition instead of a solid border.
* **Supercharged Lists:** Replace default list bullets with meaningful accent icons (e.g., checkmarks for a benefits list).
* **Empty States:** An effective empty state should feature an illustration, a clear headline explaining the benefit, and a primary call-to-action button.
* **Creative Component Design:** Enhance common components creatively. For example, replace radio buttons for important choices with large, clickable cards that visually change state when selected.

### 3.4. Advanced Layout Patterns (Content Flow)

These patterns are for creating dynamic and visually engaging transitions between large page sections.

* **The Subtle Background Shift:** Group related content by alternating the background color of entire sections (e.g., a white section on a light gray body).
* **The Overlap / Bleed Effect:** To break the rigid "stacked boxes" feeling, make an element from one section "bleed" or overlap into the next using negative margins and `z-index`.
* **Shaped Dividers:** Instead of a harsh horizontal line, use a shape (via CSS `clip-path` or transforms) to create a more organic transition between sections.

-----

## 4\. Accessibility & Structural Best Practices

A visually appealing interface must also be robust, inclusive, and usable for everyone. These practices are not optional.

### 4.1. ARIA Roles for Dynamic Components

Semantic HTML is the foundation, but interactive components like tabs, menus, and modals require ARIA (Accessible Rich Internet Applications) attributes to describe their state and function to assistive technologies.

* **Example (Tabs):** A set of links used to control on-page content should be structured as a `tablist`.
  * Use `<div role="tablist">` for the container.
  * Use `<button role="tab">` for each control.
  * Use `aria-selected="true"` to programmatically mark the active tab. CSS should use this attribute for styling (e.g., `[role="tab"][aria-selected="true"]`).

### 4.2. Accessible Images & SVGs

* **Informative Images:** All `<img>` tags that convey information **must** have a descriptive `alt` attribute. `alt="Profile picture"` is not enough; `alt="Profile picture of Jane Doe"` is correct.

* **Decorative Icons:** If an icon is purely decorative and accompanied by text that describes its function (e.g., a settings icon next to the word "Settings"), the icon **must** be hidden from screen readers using `aria-hidden="true"`.

  ```html
  <a href="/settings">
      <svg aria-hidden="true">...</svg>
      <span>Settings</span>
  </a>
  ```

### 4.3. Logical Heading Hierarchy

* **Do Not Skip Levels:** The heading structure of a page (`h1` through `h6`) must be logical and sequential. A `<h3>` should not appear unless it is a subsection of an `<h2>`.
* **Separate Visuals from Structure:** This guide allows you to make an `<h2>` look smaller than an `<h4>` if the visual hierarchy demands it. However, the underlying document structure must always remain logical. A developer assembling a page from components is responsible for ensuring the final heading order is correct.

-----

## 5\. Appendix: Base CSS Implementation

This CSS block contains the complete set of design tokens and foundational styles. This should be used as the global stylesheet for the project.

```css
/*
 * Bintelx Front - Unified Global Stylesheet
 * This file provides a comprehensive set of base styles, design tokens,
 * and component classes for the Bintelx enterprise platform.
 */

/* 1. CORE DESIGN TOKENS */
:root {
  /* Fonts */
  --font-family-sans: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --text-size-sm: 0.875rem;
  --text-size-base: 1rem;
  --text-size-lg: 1.125rem;
  --text-size-xl: 1.25rem;
  --text-size-2xl: 1.5rem;
  --text-size-3xl: 2rem;
  --text-size-4xl: 2.5rem;
  --line-height-normal: 1.5;
  --line-height-heading: 1.2;
  --letter-spacing-caps: 0.05em;

  /* Colors */
  --primary-100: hsl(205, 90%, 96%);
  --primary-500: hsl(205, 78%, 55%);
  --primary-600: hsl(205, 70%, 48%);
  --gray-100: hsl(210, 20%, 98%);
  --gray-200: hsl(210, 20%, 94%);
  --gray-300: hsl(210, 18%, 88%);
  --gray-500: hsl(210, 12%, 65%);
  --gray-700: hsl(210, 12%, 45%);
  --gray-900: hsl(210, 18%, 15%);
  --white: #ffffff;
  --red-500: hsl(0, 80%, 60%);
  --green-500: hsl(140, 60%, 45%);

  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2.5rem;
  --space-2xl: 4rem;

  /* Borders & Shadows */
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --shadow-md: 0 4px 6px -1px hsla(0, 0%, 0%, 0.1), 0 2px 4px -2px hsla(0, 0%, 0%, 0.1);
}

/* 2. GLOBAL RESETS & BODY STYLES */
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  font-family: var(--font-family-sans);
  color: var(--gray-900);
  background-color: var(--gray-100);
  line-height: var(--line-height-normal);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin: 0;
}

/* 3. BASE ELEMENT STYLING */
h1, h2, h3, h4, h5, h6 {
  font-weight: var(--font-bold);
  line-height: var(--line-height-heading);
  margin: 0;
}

p {
  margin: 0;
  color: var(--gray-700);
}

a {
  color: var(--primary-600);
  font-weight: var(--font-medium);
  text-decoration: none;
}
a:hover { text-decoration: underline; }

/* 4. FORM & BUTTON DEFAULTS */
label {
  display: block;
  font-weight: var(--font-medium);
  color: var(--gray-700);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-sm);
}

input, textarea, select {
  display: block;
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  background-color: var(--white);
  transition: border-color 150ms, box-shadow 150ms;
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
}

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-md);
  font-weight: var(--font-bold);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background-color 150ms;
}

.button-primary {
  background-color: var(--primary-500);
  color: var(--white);
}
.button-primary:hover {
  background-color: var(--primary-600);
}

/* 5. COMMON COMPONENTS */
.card {
  background-color: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-xl);
}
```