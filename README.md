# Ask My Files — Windows desktop prototype

React + Electron chat assistant for the files already on your laptop. No browser or Android emulator is required. Keep using Windows File Explorer; the assistant runs in a separate window beside it.

**Status:** runnable source prototype, not a signed production installer. See `VALIDATION.md` for exactly what has and has not been tested. Windows Explorer tracking and .NET/AWS execution must be verified on Windows. Do not assume tab tracking works on every Windows build.

## 1. Start the desktop app

Install **Node.js 24 LTS** and the **.NET 10 SDK** on your Windows laptop:

- https://nodejs.org/en/download
- https://dotnet.microsoft.com/en-us/download/dotnet/10.0

Extract this ZIP into, for example, `C:\Work\AskMyFiles`. Open PowerShell in that extracted folder (the folder containing `package.json`). Run:

```powershell
node --version
dotnet --version
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Desktop.ps1
```

`ExecutionPolicy Bypass` here applies only to this script process; it does not change your machine's persistent policy. Review the script first, or run these equivalent commands yourself:

```powershell
npm ci
npm run helper
npm start
```

The script installs npm dependencies on first run, builds a self-contained x64 Explorer helper, builds the React UI and launches Electron. Keep the PowerShell window open. Internet is needed for initial npm/NuGet downloads. Do not run as Administrator.

If extraction created an extra `ask-my-files` subfolder, change into it before running the commands. On ARM64 Windows, this prototype targets x64; native ARM64 packaging is not configured.

## 2. Try your actual files

1. In the assistant, click **Choose location** and select the included `sample-docs` folder. This pins a scope and starts recursive indexing.
2. Wait for indexing to finish, then ask **What does AWS architecture say about security?** You should see source excerpts mentioning IAM roles and encrypted storage.
3. To search your own drive, enable **Follow Explorer**, switch to Explorer, and navigate to `D:\` (or your drive).
4. Return to the assistant. Confirm the displayed path and click **Enable this location** once. This allows indexing for that drive and its subfolders.
5. After indexing, navigate to `D:\Projects` in Explorer. The next question is restricted to that folder and all its subfolders. Navigating back to `D:\` expands the scope again.

The app retains the last Explorer location while you type in the assistant. Each answer records the scope used. Navigating during an outstanding request does not change that request's scope. New locations outside an enabled root need to be enabled once; subfolders within an enabled drive do not.

**Local mode is genuine local keyword search, not an AI-generated answer.** It returns matching names and text excerpts. The included Answer API adds Bedrock-generated answers.

## 3. Enable AI answers with Bedrock

Use an AWS profile with permission to call a Converse-compatible Bedrock model or inference profile. Model availability and inference profile requirements depend on your AWS account and region. This project does not provision AWS resources or insert credentials.

Open a second PowerShell window in the project folder:

```powershell
# If your organization uses AWS SSO, sign in to your configured profile first:
aws sso login --profile your-profile

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-AnswerApi.ps1 `
  -Profile your-profile `
  -Region us-east-1 `
  -ModelId "YOUR_ENABLED_MODEL_OR_INFERENCE_PROFILE_ID"
```

The script starts the .NET API and prints a randomly generated **local API bearer token**. This is not your AWS secret key. In the assistant's Settings:

- Answer mode: **Answer API**
- URL: `http://127.0.0.1:5199/api/file-assistant/ask`
- Bearer token: paste the token printed in the API terminal
- Save settings and ask again

Keep both terminal windows open. A fresh API terminal creates a new bearer token; update the desktop's saved token after restarting that way. To retain a token between API runs, supply `ASK_FILES_API_TOKEN` securely in the process environment. Never commit it. The desktop encrypts its saved token with Electron's Windows secure storage; it never embeds AWS credentials in React.

The API binds to loopback only. Bedrock calls use the AWS SDK credential chain (including your selected AWS profile). Give the API principal `bedrock:InvokeModel` access to the model/profile resources it needs. Requests may incur AWS usage charges.

**Data sent:** the question, file paths and up to 10 retrieved text excerpts go to the configured API. The supplied API forwards the question and these excerpts to Bedrock. Full original files are not uploaded by this app. Local mode does not send documents to an AI provider.

## 4. Supported files and honest limits

- File names/modified dates are indexed for regular files even when content extraction is unsupported.
- Text content: PDF with extractable text, DOCX, PPTX, XLSX, TXT, Markdown, CSV/TSV, JSON, logs, and common source-code formats.
- PDF sources show page numbers; PPTX sources show slide numbers; XLSX sources show sheet numbers and cell addresses. XLSX cached formula values are read; formulas are not recalculated.
- Scanned PDFs/images need OCR, which is not included. Legacy `.doc`, `.ppt`, `.xls`, password-protected documents, Outlook files, and archive contents are not supported for content Q&A.
- Per file: at most 20 MB is parsed and 80,000 extracted characters indexed. PDFs/PPTX: at most 200 pages/slides; XLSX: at most 100 sheets. Larger files still get a file-name entry. The UI shows excerpts; a summary is of retrieved excerpts, not a guarantee that every page was read.
- Indexing is recursive but skips links/junctions escaping scope, hidden dot entries, `.git`, `node_modules`, Windows/system/app folders and inaccessible files. Files On-Demand may be downloaded by their sync provider when read.
- A scan checks at most 100,000 files and reports **partial scan** if that cap or cancellation is reached. Do not interpret partial indexing as a complete drive inventory.
- Retrieval is SQLite FTS keyword ranking with file-type intent and a small synonym vocabulary, not semantic/vector retrieval. `doc`/`Word` filters `.doc` and `.docx`; father/papa/dad and Aadhaar/aadhar/adhar variants are recognized. Parent folder names are searchable. All-concept matches are preferred; fallback matches are approximate. Result cards display only the name, Open button and path. Natural-language wording with no matching terms may miss a document. Date phrases and counting/aggregating an entire drive are not implemented as structured queries.
- Edits trigger a debounced rescan; a five-minute reconciliation catches missed events. **Refresh** runs one immediately. Changed/deleted files are revalidated and excluded from answers until refreshed.
- The SQLite index contains document text in your Windows user profile; it is not separately encrypted by this prototype. Removing an enabled location deletes its current logical index records, not the original files (SQLite disk pages/backups can retain old bytes).
- This PC, Home, Libraries, Recycle Bin and Explorer search-results views are not supported as searchable scopes. Navigate to a real drive/folder.
- Multiple Explorer tabs vary by Windows build. The helper tries the visible address toolbar and Shell automation. It refuses detected ambiguity; if your build does not expose the selected tab reliably, use a separate Explorer window or **Choose location** to pin the exact path. Always inspect the displayed scope before asking. It does not send keyboard shortcuts or change Explorer navigation.
- The app opens documents via their default Windows app. Executable/script results are revealed in Explorer instead of executed. Opening a source does not automatically jump to the cited page.

## 5. Project layout

| Location | Responsibility |
|---|---|
| `src/` | React chat window, settings, scope/status and source cards |
| `desktop/main.cjs` | Electron window, secure IPC, scope checks, API calls and opening results |
| `desktop/index-worker.cjs` | Background indexing worker |
| `desktop/index-store.cjs` | Persistent SQLite FTS index and recursive scanning |
| `desktop/extract.cjs` | Document text extraction |
| `helper/` | C# console bridge to the foreground Windows Explorer window |
| `api/` | Authenticated loopback .NET API using Bedrock Converse |
| `scripts/` | Windows startup scripts |
| `tests/` | Scope, indexing, extraction and refresh checks |
| `sample-docs/` | Fictional documents to verify the app before using your files |

The helper references Windows UIAutomation assemblies through `UseWPF`, but there is **no WPF UI/XAML to learn or edit**. All visible interface work is React/CSS.

## 6. API contract

The desktop performs local retrieval; your remote/cloud API cannot directly read a laptop path. One question request contains the selected scope plus already-retrieved source excerpts:

```json
{
  "question": "What does the architecture say about security?",
  "scopePath": "D:\\Projects",
  "includeSubfolders": true,
  "sources": [{
    "id": "a-stable-source-id",
    "path": "D:\\Projects\\Architecture.pdf",
    "location": "Page 4",
    "excerpt": "The project uses temporary IAM role credentials..."
  }]
}
```

Response:

```json
{ "answer": "The project uses temporary IAM roles [a-stable-source-id]." }
```

Use `Authorization: Bearer <local API token>`. The provided endpoint is separate from your existing Carbonite Mobile API; to reuse that API you must implement this contract and its authentication there. For a multi-user production backend, replace the prototype token with your application's real user authentication and enforce tenant access independently. Do not treat a client-supplied path as server-side authorization.

## 7. Tests and Windows packaging

```powershell
npm test
npm run build
npm run package:win
```

Packaging must run on Windows after prerequisites are installed. The unsigned NSIS installer is written to `release`. Production distribution requires code signing, dependency review, installer testing and validation on the Windows builds you support. This source archive does not include a prebuilt EXE.

## Troubleshooting

- **Helper unavailable:** run `npm run helper`, confirm `helper\publish\ExplorerBridge.exe` exists, restart the assistant.
- **Wrong/ambiguous tab:** open the desired path in a new Explorer window; check the displayed path. Or disable Follow Explorer and use Choose location.
- **No results:** wait for indexing, check its error/skip counts, Refresh, and search a distinctive file name. Scanned PDFs require OCR.
- **API 401:** the desktop token must match the current API terminal's token.
- **API 503:** check model configuration and AWS credentials/profile.
- **API 502:** check model access, Converse support, profile region and IAM permissions. The API terminal logs the AWS error code, not document text.
- **Connection refused:** keep the API terminal open and use port 5199 in Settings. This is unrelated to your IIS Express Mobile API bindings.
- **Node SQLite error:** install Node 24+ and use the supplied Electron dependency. Do not downgrade Electron to a version without `node:sqlite`.

## Official references

- Electron security: https://www.electronjs.org/docs/latest/tutorial/security
- Electron IPC: https://www.electronjs.org/docs/latest/tutorial/ipc
- Windows Shell: https://learn.microsoft.com/en-us/windows/win32/shell/shell-entry
- AWS .NET Bedrock examples: https://docs.aws.amazon.com/sdk-for-net/v4/developer-guide/csharp_bedrock-runtime_code_examples.html
