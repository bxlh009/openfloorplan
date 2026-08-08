# Changelog

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
