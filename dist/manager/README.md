# Construction AR Lab — GitHub edition

Dashboard: https://mforoughi.github.io/AR-lab/manager/

The existing Law Office app remains at https://mforoughi.github.io/AR-lab/?sheet=poster.
This addition lives under `dist/manager/`; it does not replace the original app,
models, poster, tracking targets or deployment workflow.

## Upload and publish

1. Open the dashboard and choose **New project**, or **Manage** an existing project.
2. Upload a self-contained GLB (up to 30 MB), PNG/JPEG plan (up to 5 MB), and optional
   CSV schedule with `id,name,start,duration` columns. Start and duration are days.
3. Select model components and assign them to schedule tasks. The supplied stadium
   sample includes eight tasks and 339 verified component links. Other models need
   their own mapping; a single merged mesh cannot show independent construction tasks.
4. Generate the tracking sheet and align the model footprint to it.
5. Choose **Publish to GitHub**. Use a fine-grained GitHub personal access token for
   `mforoughi/AR-lab` only, with **Contents: Read and write**. The account must have
   write access. Enter the token only into the publish dialog, never into a model,
   schedule, chat, repository file or shared URL. It is held in memory for one publish
   and is not stored. Cancel or close the page to discard it.
6. Wait for the repository's existing **Deploy AR Lab** action to finish. Then print
   the new GitHub tracking sheet. Its QR opens the public AR viewer without a ChatGPT
   account. The browser still needs camera permission. Keep the full sheet in view.

GitHub Pages is static hosting. Draft files/settings are saved in **IndexedDB in the
current browser**, not on GitHub, until publication succeeds. Export a project backup
before clearing browser storage. Published data is public and available across devices.
Editing a published project makes a browser draft; its QR keeps serving the previous
published version until the next successful publish. Archiving only hides the browser
draft and does not revoke access to published files. GitHub history retains past files.

Each project has a UUID and a stable viewer URL. Files have content-based names.
Publishing creates blobs, a tree based on the current repository tree, and one commit.
The branch update is never forced. Only `dist/manager/projects/<id>/...` and the
manager catalog are writable through the publisher. Concurrent updates are preserved;
conflicting edits of the same project stop with an explanation instead of overwriting.

The old ChatGPT-hosted dashboard and old printed QR codes are independent. Print the
GitHub edition's sheet to use the GitHub-hosted viewer and its matching tracking image.

## Development

Run `npm ci --ignore-scripts`, `node scripts/build.mjs`, then `npm test` from the
repository root. The unchanged workflow deploys `dist/` including this folder.
`node scripts/manager/prepare-sample.mjs` regenerates the initial stadium sample;
do not run it against a catalog containing later user publications without merging them.
The supplied browser viewer and engine require WebGL and a camera for physical AR tests.
