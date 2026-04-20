# Design System Documentation: Industrial Precision & Editorial Depth

## 1. Overview & Creative North Star: "The Precision Engine"

This design system is built to move beyond the commodified "SaaS dashboard" look. For a sector as rigorous as AutoTech, the interface must mirror the engineering excellence of the machines it manages. Our Creative North Star is **"The Precision Engine."**

Like a high-performance blueprint, the layout is governed by mathematical rhythm, intentional asymmetry, and a sense of layered transparency. We reject the "boxed-in" look of traditional web apps. Instead, we treat the UI as a sophisticated piece of technical editorial—using expansive white space, dramatic typographic scale, and tonal shifts to guide the user’s eye without the need for crude structural lines.

---

## 2. Colors: Tonal Architecture

Our palette is a monochromatic study in blue and slate, designed to evoke trust and technical sophistication.

### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for sectioning or layout containment. Structural boundaries must be achieved through **Background Color Shifts**. 
*   Place a `surface_container_low` (#f1f4f7) section against a `surface` (#f7fafd) background to define a sidebar.
*   Use `surface_container_lowest` (#ffffff) to make high-priority content areas "pop" from the base.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Each step inward toward more granular content should result in a shift in surface tier:
1.  **Base Layer:** `surface` (#f7fafd)
2.  **Sectioning:** `surface_container_low` (#f1f4f7)
3.  **Active Workspace:** `surface_container_lowest` (#ffffff)
4.  **Floating Accents:** Semi-transparent `primary_container` with backdrop-blur.

### The "Glass & Gradient" Rule
To inject "soul" into the industrial aesthetic, use subtle linear gradients (135°) for primary actions, transitioning from `primary` (#00497d) to `primary_container` (#0061a4). For floating navigation or modals, utilize **Glassmorphism**: 80% opacity of `surface_container_lowest` with a 24px backdrop blur to create a premium, frosted-glass effect.

---

## 3. Typography: Editorial Authority

We use **Inter** for its neutral, high-legibility "Helvetica-style" soul, but we apply it with high-contrast scaling.

*   **Display (Large/Medium):** Used for data-heavy hero moments. High-contrast sizing (e.g., `display-lg` at 3.5rem) should be paired with tight letter-spacing (-0.02em) to feel like a technical journal.
*   **Headlines & Titles:** Use `headline-sm` (#181c1e) for section headers. Ensure there is significant breathing room (32px+) above every headline.
*   **Body & Labels:** `body-md` (#414750) is the workhorse. Labels (`label-md`) should always be uppercase with +0.05em tracking when used for metadata or technical specs.

---

## 4. Elevation & Depth: Tonal Layering

We convey hierarchy through **Tonal Layering** rather than traditional drop shadows.

*   **The Layering Principle:** Depth is achieved by "stacking." A card using `surface_container_lowest` (#ffffff) sitting on a `surface_container` (#ebeef1) background creates a soft, natural lift that is cleaner than a shadow.
*   **Ambient Shadows:** If a floating element (like a dropdown) requires a shadow, it must be an "Ambient Shadow": 
    *   Blur: 40px–60px. 
    *   Opacity: 4-6%. 
    *   Color: Derived from `on_surface` (#181c1e). 
    *   Result: A soft glow that feels like natural light, not a digital effect.
*   **The "Ghost Border" Fallback:** For input fields or essential containment, use a "Ghost Border": `outline_variant` (#c1c7d2) at **20% opacity**. This provides the necessary accessibility without cluttering the industrial cleanliness of the layout.

---

## 5. Components: The Industrial Primitive

### Buttons
*   **Primary:** Gradient of `primary` to `primary_container`. Radius: `md` (0.375rem). Use `on_primary` (#ffffff) for text.
*   **Secondary:** Ghost style. Transparent background with a `Ghost Border` and `primary` text.
*   **Interaction:** On hover, transition the gradient slightly or increase the surface-tint intensity.

### Input Fields
*   **Style:** No background (transparent) or `surface_container_lowest`.
*   **Border:** Use the "Ghost Border" (20% opacity `outline_variant`). On focus, the border becomes 100% `primary` with a 2px stroke.
*   **Labels:** Use `label-md` floating above the input, never inside, to maintain high technical contrast.

### Cards & Lists
*   **Forbid Dividers:** Horizontal lines are replaced by vertical whitespace. In lists, use alternating tonal shifts (e.g., every second item uses `surface_container_low`) to separate rows.
*   **Cards:** Avoid borders. Use a `surface_container_high` (#e5e8eb) background with a 12px padding to group related telemetry data.

### Technical Chips
*   Used for status (e.g., "Active", "Maintenance"). 
*   Style: Solid `primary_fixed` (#d1e4ff) with `on_primary_fixed` (#001d36) text. No border.

---

## 6. Do’s and Don'ts

### Do:
*   **Embrace Asymmetry:** Align text to the left but allow data visualizations to bleed toward the right edge for an editorial feel.
*   **Use Tonal Shifts:** Always ask, "Can I define this space with a background color change instead of a line?"
*   **Prioritize Breathing Room:** Industrial precision requires space to think. Double your standard white space between disparate modules.

### Don’t:
*   **Don't Use Pure Black:** Use `on_surface` (#181c1e) for text. Pure black is too harsh for a high-end monochromatic blue system.
*   **Don't Over-round:** Keep the radius to `md` (0.375rem) or `sm` (0.125rem). Avoid "bubbly" large radii which undermine the industrial precision.
*   **Don't Use 100% Opaque Borders:** This is the quickest way to make the UI look like a generic template. Use the Ghost Border rule.