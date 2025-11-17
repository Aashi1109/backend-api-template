# Backend Template Scaffold

A powerful, feature-based backend project template with an interactive CLI scaffold tool. Quickly bootstrap backend projects with optional features like Cloudinary integration, request context tracking, background workers, and more.

## Features

- 🎯 **Base Template**: Solid foundation with Express, TypeScript, middleware, error handling, and logging
- 🎨 **Optional Modules**: Choose only the features you need
- 🚀 **Interactive CLI**: Simple prompts to select and install features
- 📦 **Automatic Setup**: Copies files, injects code, and merges dependencies
- 🔧 **Clean Output**: Removes injection markers for production-ready code

## Available Features

### Cloudinary Integration
File upload and management with Cloudinary CDN. Includes upload, delete, and signed URL generation.

### Request Context Middleware
Per-request async context tracking using Node.js AsyncLocalStorage. Track request IDs, timings, and metrics throughout the request lifecycle.

### Background Workers
Infrastructure for running background workers to process async jobs.

### Queue System
Job queue system for managing background tasks.

## Installation

1. **Clone this repository**:
```bash
git clone <repository-url>
cd backend-template
```

2. **Install scaffold dependencies**:
```bash
npm install
```

> **Note**: The `templates/` directory contains incomplete TypeScript files that will show linter errors. This is expected - they're template files that become complete only after scaffolding. The `.eslintignore`, `.cursorignore`, and `tsconfig.json` files are configured to ignore the templates directory. You may need to reload your IDE window for these settings to take effect.

## Usage

### Method 1: Using npm script (from template directory)

Navigate to where you want to create your new project and run:

```bash
cd /path/to/your/new/project
node /path/to/backend-template/bin/scaffold.js
```

### Method 2: Using npm link (recommended)

From the template directory:

```bash
npm link
```

Then from any directory where you want to create a project:

```bash
backend-scaffold
```

### Method 3: Using npx (if published to npm)

```bash
npx backend-template
```

## Scaffold Process

1. **Feature Selection**: The CLI will present a list of available features. Use arrow keys to navigate and spacebar to select/deselect features.

2. **Installation**: Choose whether to automatically install npm dependencies after scaffolding.

3. **File Copying**: The tool will:
   - Copy the entire base template
   - Copy selected feature files to appropriate locations
   - Inject feature-specific code at designated markers
   - Merge dependencies into package.json
   - Clean up injection markers

4. **Result**: A clean, production-ready project with only the features you selected!

## Project Structure

```
backend-template/
├── bin/
│   └── scaffold.js          # CLI scaffold tool
├── templates/
│   ├── base/                # Always copied
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── config/
│   │   │   ├── features/
│   │   │   ├── shared/
│   │   │   └── app.ts
│   │   ├── Dockerfile
│   │   └── tsconfig.json
│   ├── modules/             # Optional features
│   │   ├── features/
│   │   │   └── ccloudinary/
│   │   ├── middlewares/
│   │   │   └── contexts/
│   │   ├── shared/
│   │   │   └── contexts/
│   │   ├── workers/
│   │   └── queues/
│   └── features-config.json # Feature registry
└── package.json
```

## Adding New Features

To add a new optional feature to the template:

1. **Create feature files** in `templates/modules/`

2. **Update `features-config.json`**:

```json
{
  "my-feature": {
    "name": "My Feature",
    "description": "Description of what this feature does",
    "files": ["path/to/feature/**"],
    "dependencies": {
      "some-package": "^1.0.0"
    },
    "injections": [
      {
        "file": "src/path/to/file.ts",
        "marker": "// INJECT:MY_FEATURE_MARKER",
        "code": "// Code to inject"
      }
    ]
  }
}
```

3. **Add injection markers** to base template files where feature code should be inserted:

```typescript
// INJECT:MY_FEATURE_MARKER
```

4. The scaffold tool will automatically:
   - Show your feature in the selection menu
   - Copy files when selected
   - Inject code at markers
   - Add dependencies to package.json

## How It Works

### Code Injection System

The scaffold uses a marker-based injection system. Features define markers like `// INJECT:CLOUDINARY_CONFIG` in base template files. When a feature is selected:

1. Files are copied to the target directory
2. Markers are located in base template files
3. Feature-specific code is injected at marker locations
4. Markers are removed for clean output

### Example

**Base template** (`src/config/index.ts`):
```typescript
const config = {
  // INJECT:CLOUDINARY_CONFIG
};
```

**After selecting Cloudinary**:
```typescript
const config = {
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    apiSecret: process.env.CLOUDINARY_API_SECRET!,
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET!,
    secure: true,
  },
};
```

## Development

### Working with the Template

The `templates/` directory is excluded from linting and type-checking because the template files are intentionally incomplete:

- **`.eslintignore`**: Excludes templates from ESLint
- **`.cursorignore`**: Excludes templates from Cursor IDE linting  
- **`tsconfig.json`**: Root config that excludes templates from TypeScript checking

The template files will only be complete and error-free after scaffolding into a real project with proper dependencies installed.

### Modifying the Scaffold Tool

To modify the scaffold tool:

1. Edit `bin/scaffold.js` - Update CLI logic, file copying, or injection behavior
2. Update `templates/features-config.json` - Add/modify features and their injections
3. Edit template files in `templates/base/` or `templates/modules/` - Add new functionality
4. Test by running `npm run scaffold` from a test directory

## Next Steps After Scaffolding

1. **Configure environment variables**: Copy `.env.example` to `.env` and fill in your values
2. **Install dependencies** (if not done automatically): `npm install`
3. **Start development**: `npm run dev`
4. **Build for production**: `npm run build`

## Contributing

When adding new features to the template:
- Keep features modular and independent
- Use descriptive marker names: `// INJECT:FEATURE_NAME_LOCATION`
- Document any required environment variables
- Update this README with feature descriptions

## License

ISC

---

**Happy coding!** 🚀

