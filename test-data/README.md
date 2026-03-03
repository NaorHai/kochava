# Test Data Directory

This directory contains test fixtures for comprehensive bash translator testing.

## Structure

```
test-data/
├── code/                  # Programming language files
│   ├── example.py        # Python with TODO markers
│   ├── example.js        # JavaScript with TODO markers
│   ├── example.ts        # TypeScript interface
│   └── example.java      # Java class
├── documents/            # Text documents
│   ├── readme.txt        # Plain text
│   └── notes.md          # Markdown
├── hidden/               # Hidden files
│   └── .hidden-file      # Dotfile
├── large/                # Large files
│   └── large-file.bin    # 101MB binary file
└── nested/               # Deeply nested structure
    └── deep/
        └── structure/
            └── deep-file.txt

```

## Purpose

These files are used by `test/comprehensive-bash-test.js` to validate:

- File listing operations (ls, find)
- Content search (grep)
- File type filtering (*.py, *.js, *.ts)
- Size-based searches (>100MB)
- Hidden file detection
- Nested directory traversal
- Line counting
- Permission checks

## Usage

Tests run against this data:

```bash
npm run test:comprehensive
```

Example test queries:
- "show me all python files in test-data"
- "find large files bigger than 100MB in test-data"
- "search for TODO in test-data"
- "count files in test-data/documents"
- "list hidden files in test-data"

## Maintenance

Do not modify or delete these files - they are critical for regression testing.
