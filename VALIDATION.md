# Validation record

## Verified in this Linux build environment

- `npm run build`: production React/Vite bundle built successfully.
- `npm test`: 12 tests passed, 0 failed.
- Tests cover Windows-style drive/folder boundaries, sibling-prefix isolation, traversal rejection, recursive retrieval, refresh after edits, deletion, cancelled scans, real-path/symlink escape rejection, PDF/DOCX/PPTX/XLSX extraction, and React UI question submission/source rendering/scope updates/settings save.
- React interaction testing used a simulated DOM and a mocked desktop bridge. It does not verify Electron IPC or Windows integration.
- `node --check` passes for desktop CommonJS source files.
- Production npm dependency audit: 0 reported vulnerabilities at validation time (not a guarantee against future advisories).
- A locked npm dependency tree is included. Dependencies and Electron binaries are not bundled in this source ZIP.

## Search accuracy update 0.1.1

Regression fixtures verify that `doc` excludes Dockerfile, father/aadhar finds papa/adhar in nested filenames and parent folders, mother-card results are excluded when full father matches exist, partial matches are labeled, and existing indexes gain folder-path search without rereading original documents. These tests use synthetic filenames, not the user’s Aadhaar data.

## Not verified here

- .NET compilation: this environment has no .NET SDK. The C# Explorer helper and Answer API require a build on the user's machine.
- Live Windows Explorer scope/tab behavior and Windows permission handling.
- Electron desktop launch, native document opening, OS credential storage, or the Windows installer.
- Pixel-level UI rendering: a headless browser download was unavailable in this environment. The image shared earlier was a concept mockup, not a screenshot of the running app.
- Bedrock connectivity or generated answers: no AWS account/model/profile was supplied.

## Windows acceptance checks

1. Run `npm ci`, `npm test`, `npm run helper`, and `dotnet build api/AnswerApi.csproj`.
2. Run `npm start`. Choose `sample-docs`; wait for indexing and ask about IAM roles. Check the source excerpt.
3. Enable Follow Explorer. Open a drive in Explorer; confirm the displayed drive path, enable indexing and wait.
4. Navigate into a nested folder; confirm the displayed scope changes. Verify a known sibling-folder file does not appear in results.
5. Return to the drive; verify that the sibling file becomes searchable again.
6. Click into the assistant; its scope must remain the last Explorer location. Navigate while a question is pending; the answer must retain the scope captured when submitted.
7. Try two Explorer windows and multiple tabs. If the selected tab is not reliably reflected, use a separate window/pinned scope and report the Windows build. An ambiguous/virtual scope should clear the path instead of silently using a different folder.
8. Edit/delete a test document. After refresh, old content should disappear. Open a returned source and verify the correct document opens.
9. Start the Answer API with your model/profile, set its bearer token and ask again. Verify the answer against its cited excerpts. With an incorrect token, expect HTTP 401, not a fabricated answer.
10. If distributing to others, run `npm run package:win`, install on a clean Windows test machine and repeat checks 2–9.

This is a source prototype pending those Windows acceptance checks, not a verified production release.
