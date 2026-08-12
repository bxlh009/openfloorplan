# Changelog

## 0.5.8 - 2026-08-12

- Replace visually mismatched ornate sofa and coffee-table assets with an explicitly modern procedural sofa plus a locally bundled CC0 round stone table; keep the verified modern media cabinet.
- Load self-contained local glTF furniture with verified buffer/texture references, dimension-aware scaling and automatic grounding while retaining procedural fallbacks.
- Add tight house-sized shadow-camera bounds, physically scaled practical-light intensity, room-aware photo lights and a sky environment for clearer interior depth.
- Rebalance photo-mode exposure toward soft skylight and away from clipped direct sun, retaining readable white walls and gentler window-shadow boundaries.
- Give living, bedroom, dining and study templates editable doors and windows, and refine living-room dimensions and eye-level composition.
- Replace square-looking procedural wood floors with modern long-plank dimensions and a local CC0 photo-scanned PBR wood set containing diffuse, OpenGL normal and roughness maps.
- Make legacy/default wood, tile and concrete finishes resolve to modern light oak, 120×60 cm travertine slabs and warm-grey microcement instead of stale fallback textures.
- Ground every generated furniture group from its actual lowest visible geometry, fixing floating TV and beveled furniture while keeping selection and contact shadows on the floor plane.
- Raise realtime/photo viewport quality with 2048/4096 shadow maps, 8×/16× anisotropic filtering, richer contrast and capped 1.75×/2.5× pixel ratios.
- Add real-scale procedural bump materials, wall/floor and furniture contact shadows, a gradient sky, transmissive clear-coated window glass and rounded upholstered geometry.
- Export PNG at 1.5× or 2× viewport resolution within a 16-megapixel safety budget, restoring the interactive renderer after capture.
- Add independent daylight, warm-night and studio lighting presets plus eye-level, bird, isometric and exterior camera presets with one saved custom view.
- Add per-level parameterized ceilings, cove lighting and downlights; ceiling panels stay hidden while inspecting that level's interior.
- Add six real-scale procedural materials for floors, walls and furniture, including pick/apply material-brush controls.
- Add editable living-room, bedroom, dining-room and study templates that generate ordinary walls, room metadata and furniture.
- Add switchable realtime and warm-photo rendering modes; the selected mode is preserved in JSON exports and local drafts.
- Keep editing responsive with a capped pixel ratio, while photo mode raises output density, uses warmer practical lights and deeper light contrast.
- Upgrade the 3D presentation layer with tone mapping, neutral ambient lighting, soft site shadows and style-aware ground/roof materials.
- Add a clean roof cap and eave band for exterior views, and hide it automatically in cutaway/interior views.
- Expand floor slabs beneath wall thickness and add subtle plaster, wood-board and roof textures to reduce gaps, flat gray surfaces and color bands.
- Improve exterior camera framing and rebuild disposal so repeated style/level changes do not leave stale geometry behind.

## 0.5.7 - 2026-08-12

- Make floor slab edges unlit solid-color fascias so directional shadows cannot create a false dark color band.

## 0.5.6 - 2026-08-12

- Separate textured floor tops from solid slab sides and undersides to remove stretched texture bands and excessive edge color contrast in 3D.

## 0.5.5 - 2026-08-12

- Add right-click 90° rotation for furniture placement and selected 2D furniture, with rotated preview and footprint-aware snapping.
- Clamp 3D stair rise to the current level's wall height and expose the resulting maximum rise in the properties panel.
- Remove the interior-style panel and its flow step while keeping legacy project style data readable.

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
