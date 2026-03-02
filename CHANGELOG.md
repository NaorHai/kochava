# Changelog

## [1.1.0] - 2026-03-02

### 🎨 Major Visual Overhaul
- **Purple/Pink Branding**: Complete rebrand with purple/magenta color scheme (similar to Claude)
- **New ASCII Banner**: Modern box-drawing characters for KOCHAVA logo
- **Consistent Colors**: Purple theme throughout interactive mode, prompts, and messages

### 🚀 Unified Installation
- **Single Setup Script**: New `setup.sh` replaces multiple installation scripts
- **Interactive Choice**: User selects Docker or Local installation
- **Streamlined Flow**: One command does everything - no confusion
- **Removed Files**: Consolidated bootstrap.sh, setup_env.sh, docker-setup.sh into one

### 📖 Documentation Improvements
- **Simplified README**: Cut from 284 lines to ~300 focused lines
- **Better Structure**: Clear sections, quick examples, no redundancy
- **Visual Examples**: ASCII art, color indicators, clear routing tables
- **Quick Start**: Single command to get started

### ✨ User Experience
- **Beautiful Banner**: Eye-catching purple KOCHAVA logo on startup
- **Color Coding**: Local=Green, Claude=Blue, Prompts=Magenta
- **Clear Guidance**: Better help messages and command suggestions
- **Professional Look**: Matches Claude's aesthetic while being unique

### 🐳 Docker Integration
- **Full Docker Support**: All local models run in containers
- **Docker Compose**: Multi-service architecture
- **Easy Commands**: Simple docker-compose commands for all modes
- **Persistent Data**: Volumes for models and embeddings

### 🔧 Technical
- **TypeScript Updates**: Rebuilt with new color schemes
- **Better Imports**: Using chalk colors more consistently
- **Code Quality**: Cleaner, more maintainable setup scripts

### 🎯 Breaking Changes
- `bootstrap.sh` removed - use `setup.sh` instead
- Installation flow changed - now interactive with choice
- Old setup scripts deprecated

## [1.0.0] - 2026-03-01

### Initial Release
- Multi-model routing system
- Local + Claude API integration
- Free local models (Ollama)
- Automatic fallback mechanism
- CLI, Server, and Plugin modes
- Token optimization
- Comprehensive logging
