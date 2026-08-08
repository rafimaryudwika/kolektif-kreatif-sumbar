# Design System & UI/UX Principles

## 1. Visual Hierarchy & Layout

* **Typography**: Inter / System Sans-Serif for high legibility across dense graph data.
* **Theme**: Dark aesthetic (Zinc/Slate base) to accentuate interactive graph node visualization colors.

## 2. Interactive States

* **Loading State**: Skeleton loaders for network requests and spinning indicators for graph renderers.
* **Empty State**: Clear visual fallback prompts when a search query or multi-hop path yields no matching nodes.
* **Error State**: Non-blocking toast/banner alerts when the database connection times out or fails.

## 3. Graph Visual Mapping

* **Node Color Mapping**:
  * `Talent`: `#3B82F6` (Blue)
  * `Project`: `#10B981` (Green)
  * `Agency`: `#F59E0B` (Amber)
  * `Skill`: `#EC4899` (Pink)
