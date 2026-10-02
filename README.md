# Talk to the files

**AI-Powered Desktop File Assistant for Natural-Language File Discovery**

Talk to the files is a desktop application that helps users quickly discover and interact with files stored on their local system using natural-language queries.

Instead of manually navigating through multiple drives, folders, and documents, users can ask questions in everyday language and receive relevant file results and AI-assisted responses.

## The Problem

Finding information across a large number of local files can be time-consuming, especially when users do not remember the exact file name or location.

Traditional file search generally relies on filenames or exact keywords and provides limited understanding of what the user is actually looking for.

## The Solution

Talk to the files combines **local file indexing and full-text search with Generative AI** to provide a more intelligent file-discovery experience.

Users can select a drive or folder and ask questions such as:

- "Find my AWS architecture document"
- "Where is the onboarding document?"
- "Show me files related to the AWS project"
- "Find documents related to security"

The application searches the indexed content and uses AI to understand the user's query and provide relevant results.

## Key Capabilities

- Natural-language file search
- Local drive and folder exploration
- Full-text document indexing
- Search scoped to the currently selected drive or folder
- AI-assisted query understanding
- Relevant file discovery
- Direct access to matched files
- Desktop-based user experience

## Technology Stack

| Area | Technology |
|---|---|
| Desktop Application | Electron |
| Frontend | React, JavaScript |
| Backend API | .NET / C# |
| AI | AWS Bedrock |
| LLM | Amazon Nova |
| Local Database | SQLite |
| Search / Indexing | SQLite FTS5 |
| File Processing | Node.js |
| Communication | REST APIs |

## How It Works

```text
Local Files
    ↓
File Extraction
    ↓
SQLite FTS5 Index
    ↓
Natural-Language Query
    ↓
Search & Retrieval
    ↓
.NET Answer API
    ↓
AWS Bedrock / Amazon Nova
    ↓
Relevant Files + AI-Assisted Response
```

The application maintains a local index containing searchable file information and extracted document content.

SQLite **FTS5 (Full-Text Search)** provides efficient local retrieval, while AWS Bedrock is used for AI-assisted natural-language processing.

## Architecture

The solution consists of three primary layers:

**Desktop Layer**  
Electron and React provide the desktop user interface, file navigation, search experience, and interaction with the local system.

**Search & Indexing Layer**  
Node.js-based services process supported files and maintain a searchable SQLite FTS5 index.

**AI Layer**  
The .NET API integrates with AWS Bedrock and Amazon Nova to process natural-language requests and generate contextual responses.

## Why AI?

Traditional search works well when users know the exact filename or keywords.

Talk to the files is designed for situations where users remember the **meaning or context** of what they are looking for but not necessarily the exact filename.

The combination of deterministic local search and Generative AI allows the application to retain efficient file retrieval while providing a more natural way for users to interact with their information.

## Privacy & Security

- Local files are indexed on the user's machine.
- Generated index/database files are excluded from source control.
- AWS credentials are not stored in the repository.
- Environment-specific and generated files are excluded through `.gitignore`.

## Running the Project

### Prerequisites

- Node.js
- npm
- .NET SDK
- AWS account with Amazon Bedrock access
- Appropriate AWS credentials/profile configured locally

### Install dependencies

```bash
npm install
```

### Start the .NET Answer API

Use the provided PowerShell script:

```powershell
.\scripts\Start-AnswerApi.ps1
```

### Start the desktop application

```powershell
.\scripts\Start-Desktop.ps1
```

Configuration such as the AWS region, profile, and Bedrock model should be provided through the appropriate local configuration/environment rather than committed credentials.

## Future Enhancements

- Semantic/vector search for improved contextual retrieval
- Hybrid keyword + semantic ranking
- Improved document chunking and relevance scoring
- Support for additional document formats
- Conversation history and contextual follow-up questions
- Incremental/background indexing
- Enhanced metadata extraction
- Performance optimization for large file collections
- Local/private LLM support

## Project Status

**Working prototype / proof of concept**

The current implementation demonstrates local file exploration, indexing, full-text retrieval, AI-assisted query processing, and desktop integration.

---

### Author

**Sonam Sharma**  
Senior Software Engineer | Full Stack | .NET | AWS | Azure | React Native