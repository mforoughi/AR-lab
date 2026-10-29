# Construction AR Lab

Law-office teaching prototype powered by 8th Wall 0.1.0 (MIT image tracking) and Three.js r160. Includes the Revit model with 504 separate objects and a draft 20-activity, 90-workday schedule.

## Publish
In repository Settings → Pages, set Source to **GitHub Actions**. Run the Deploy AR Lab workflow. Expected address: https://mforoughi.github.io/AR-lab/

## Develop
Run `npm ci` and `node scripts/build.mjs`, then serve `dist` using a local HTTP server. Phone camera access requires HTTPS. All runtime files are served from this repository after the build.

## Test on a phone
Print `poster.html` from the deployed app: this is a new padded portrait tracking target and QR address. Open the app directly in Safari or Chrome, start the camera, point at the full sheet and play. Test alignment, scale, movement, lost-target recovery, camera switching and playback. Physical tracking has not been verified in the development browser, whose WebGL is disabled.

## Changes
Compact activity label, more mobile camera space, collapsible chart, automatic active-task scrolling, and distinct Not modeled / No geometry required labels. Components appear with the teaching schedule; it is not measured construction progress.

## Source and limitations
`dist/assets/law-office.glb` is the supplied model converted to metres, with mesh IDs/task links preserved. No identifiable foundations, frame or MEP geometry exists in this export. Timing is an educational assumption. Complete wall assemblies cannot show framing and finishes independently.

`dist/xr-adapter.js` integrates 8th Wall image tracking with the Three.js viewer. It does not use world tracking. `scripts/prepare-target.mjs` reproduces target metadata from the supplied plan using the pinned CLI. Model-to-plan registration must be checked on a real phone. The separate upload-project interface is not implemented yet.

8th Wall is MIT licensed; its license is copied into the deployment by the build script. Existing Three.js license notices are retained in vendor files.

## Binary assets
For reliable connector transfer, model, image and spreadsheet bytes are stored in `encoded-assets` as Base64 text. The build restores their original file paths and verifies each SHA-256 digest. Run the build before local preview; the deployed app loads ordinary GLB/PNG/XLSX files.
