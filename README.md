# Construction AR Lab

Law-office teaching prototype powered by 8th Wall 0.1.0 (MIT image tracking) and Three.js r160. Includes the Revit model with 504 separate objects and a draft 20-activity, 90-workday schedule.

## Publish
In repository Settings → Pages, set Source to **GitHub Actions**. Run the Deploy AR Lab workflow. Expected address: https://mforoughi.github.io/AR-lab/

## Develop
Run `npm ci`, `node scripts/build.mjs`, and `npm test`, then serve `dist` using a local HTTP server. Phone camera access requires HTTPS. All runtime files are served from this repository after the build.

## Test on a phone
Print `poster.html` from the deployed app. Its QR opens `?sheet=poster` directly in AR and tracks the entire poster, including the rendered model, labels, timeline, and QR. Allow camera access; the complete existing building appears when the sheet is recognized. Use Play to run the 90-workday sequence in about 25 seconds at 1×. The first 21 workdays have no model geometry.

The old QR/root URL still uses the original plan target. Select **New poster** or **Original plan** to match the printed sheet. `?mode=3d` opens the optional desktop preview. A browser requiring a user gesture can use **Start AR camera**.

Playback waits while tracking is lost. A seven-second loss triggers one clean AR session restart, retaining the schedule position. Normal reacquisition cancels that restart; **Retry AR** performs a manual restart. Returning through the browser back/forward cache also reopens the camera. No stale pose is displayed as though it were still tracked.

Phone acceptance test: scan the new QR, rotate the flat sheet, move nearer/farther, briefly remove it from view, return it, and repeat the playback and camera restart. Check registration against walls at each angle. Physical tracking is not verified by the development browser, whose WebGL is disabled. Node tests and a local simulated-camera browser run validate lifecycle, canvas sizing, timing, and calibration, not recognition accuracy.

## Changes
Compact activity label, more mobile camera space, collapsible chart, automatic active-task scrolling, and distinct Not modeled / No geometry required labels. Components appear with the teaching schedule; it is not measured construction progress.

## Source and limitations
`dist/assets/law-office.glb` is the supplied model converted to metres, with mesh IDs/task links preserved. No identifiable foundations, frame or MEP geometry exists in this export. Timing is an educational assumption. Complete wall assemblies cannot show framing and finishes independently.

`dist/xr-adapter.js` integrates 8th Wall image tracking with the Three.js viewer. It does not use world tracking. `scripts/prepare-target.mjs` reproduces the original target. `scripts/prepare-poster.mjs` generates the new poster and target together at build time using the same pinned CLI, and calculates model placement from the printed plan rectangle. The poster render uses the existing model with roof and upper slab hidden. No model geometry was added. Model-to-plan registration must be checked on a real phone. The separate upload-project interface is not implemented yet.

8th Wall is MIT licensed; its license is copied into the deployment by the build script. Existing Three.js license notices are retained in vendor files.

## Binary assets
For reliable connector transfer, model, image and spreadsheet bytes are stored in `encoded-assets` as Base64 text. The build restores their original file paths and verifies each SHA-256 digest. Run the build before local preview; the deployed app loads ordinary GLB/PNG/XLSX files.
