# Changelog

## 0.5.4 - 2026-08-12

- Show the immediate lower-floor footprint as a dashed 2D preview with an enclosed-area hint while editing an upper floor.
- Give 3D floor slabs their configured thickness so the slab closes the gap between the lower wall top and the upper floor level.
- Add regression coverage for lower-level lookup and floor footprint area reporting.

## 0.5.3 - 2026-08-11

- Synchronize floor selection with the 3D camera: 1F focuses 1F, while an upper floor is shown at its physical elevation with lower floors as context.
- Keep the whole-building 3D toggle available for an explicit full-home overview.
- Add regression coverage for active-level visibility and lower-floor context.

## 0.5.2 - 2026-08-11

- Add rectangle marquee selection on the active level, Shift additive selection, and a one-click/Delete-key removal action.
- Remove selected walls together with their linked doors and windows, preserving undo and local autosave behavior.
- Add regression coverage for full-containment selection and active-level isolation.

## 0.5.1 - 2026-08-11

- Save the latest in-memory draft when the page is reloaded or closed, covering the final edit boundary in browsers that end a page immediately.
- Show whether local autosave succeeded and point users to JSON backup when browser storage is unavailable.
- Synchronize the restored active-level list before redrawing, so restored objects are visible on the correct floor after refresh.
- Add regression coverage for multi-level drafts, wall objects, and level-linked openings.

## 0.5.0 - 2026-08-11

- Add an eight-step house-design workflow from project setup through review and export.
- Upgrade projects to JSON v3 with migratable levels, active-level isolation, add/switch/duplicate controls and safe wall-opening remapping.
- Add straight stairs as architectural circulation objects with 2D/3D geometry and adjacent-level relationships.
- Add per-level wood, tile and microcement floor finishes, plus an explicit concept-design safety boundary.
- Add whole-building 3D mode that stacks every level at its real elevation, with an active-level focus toggle and full-height camera framing.
- Add optional wall, object-edge/center and nearby-grid snapping for furniture and stairs across 2D placement, 2D dragging and 3D dragging, with visible guides.

- Automatically save committed edits in browser storage and restore the latest valid draft on the next visit.
- Ignore and remove damaged local drafts without blocking the editor; keep JSON export as the portable backup.
- Build floor meshes from enclosed wall faces so L-shaped plans no longer receive a rectangular floor across exterior space.
- Add bilingual furniture search, room-based categories, and an explicit empty result state.
- Clarify local autosave versus portable JSON backup and show visible new/load/export status feedback.

## 0.4.1 - 2026-08-07

- Require a double-click to select furniture in 3D.
- Keep single-drag movement limited to the currently selected furniture, leaving ordinary single-click orbiting intact.

## 0.4.0 - 2026-08-07

- Add live dimension guidance before and between clicks.
- Prioritize furniture picking and show explicit 2D/3D selection states.
- Add direct 3D furniture dragging with live 2D synchronization and undo transactions.
- Add safe door/window width, height, sill, opening-angle and along-wall controls.
- Separate interior and architectural-detail styles; vary furniture proportions, door profiles, window grids, baseboards and crown trim geometrically.
- Add regression coverage for architectural-style persistence, opening placement and rotated furniture hit testing.

## 0.3.1 - 2026-08-07

- Add a camera-aware cutaway view with an exterior-view toggle.
- Make 2D and 3D doors share the same hinge and opening direction.
- Correct doubled 2D window width and keep flooring inside the wall footprint.
- Add regression tests for cutaway-wall selection and door geometry.

## 0.3.0 - 2026-08-07

- Add six offline whole-home interior style presets with coordinated materials and lighting.
- Add JSON v2 normalization, v1 migration, validation, and complete project round trips.
- Replace delayed undo snapshots with explicit edit transactions.
- Cut real door and window openings into 3D wall geometry.
- Add Node.js behavior tests and repair the bundled studio example.

## 0.2.0 - 2026-08-02

- Vendor Three.js 0.160.0 for offline and reproducible loading.
- Add a loadable studio-apartment example project.
- Add third-party license notices.
- Add repository documentation, contribution guidance and CI syntax checks.
- Keep temporary repair scripts and backups out of the published source tree.

## 0.1.0 - 2026-07-09

- Initial browser prototype with 2D drawing, 3D preview, furniture placement, JSON save/load and SVG export.
