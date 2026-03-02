import chalk from 'chalk';
import { emitKeypressEvents } from 'readline';

export interface MenuOptions {
  items: string[];
  prompt: string;
  pageSize?: number;
  colorTheme?: {
    selected: (text: string) => string;
    normal: (text: string) => string;
    prompt: (text: string) => string;
    filter: (text: string) => string;
  };
}

export class InteractiveMenu {
  private items: string[];
  private filteredItems: string[];
  private selectedIndex: number = 0;
  private scrollOffset: number = 0;
  private filterText: string = '';
  private pageSize: number;
  private colorTheme: MenuOptions['colorTheme'];
  private isActive: boolean = false;

  constructor(options: MenuOptions) {
    this.items = options.items;
    this.filteredItems = [...this.items];
    this.pageSize = options.pageSize || 15;
    this.colorTheme = options.colorTheme || {
      selected: (text) => chalk.black.bgMagenta(text),
      normal: (text) => chalk.white(text),
      prompt: (text) => chalk.magenta(text),
      filter: (text) => chalk.cyan(text)
    };
  }

  async show(): Promise<string | null> {
    return new Promise((resolve) => {
      this.isActive = true;
      const stdin = process.stdin;
      const stdout = process.stdout;

      // Setup raw mode
      if (stdin.isTTY && stdin.setRawMode) {
        stdin.setRawMode(true);
      }

      emitKeypressEvents(stdin);

      // Render initial menu
      this.render();

      const keypressHandler = (str: string, key: any) => {
        if (!this.isActive) return;

        if (key) {
          if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
            this.cleanup(stdin, keypressHandler);
            resolve(null);
            return;
          }

          if (key.name === 'return') {
            const selected = this.filteredItems[this.selectedIndex];
            this.cleanup(stdin, keypressHandler);
            resolve(selected);
            return;
          }

          if (key.name === 'up') {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.updateScroll();
            this.render();
            return;
          }

          if (key.name === 'down') {
            this.selectedIndex = Math.min(this.filteredItems.length - 1, this.selectedIndex + 1);
            this.updateScroll();
            this.render();
            return;
          }

          if (key.name === 'pageup') {
            this.selectedIndex = Math.max(0, this.selectedIndex - this.pageSize);
            this.updateScroll();
            this.render();
            return;
          }

          if (key.name === 'pagedown') {
            this.selectedIndex = Math.min(
              this.filteredItems.length - 1,
              this.selectedIndex + this.pageSize
            );
            this.updateScroll();
            this.render();
            return;
          }

          if (key.name === 'backspace') {
            if (this.filterText.length > 0) {
              this.filterText = this.filterText.slice(0, -1);
              this.updateFilter();
              this.render();
            }
            return;
          }
        }

        // Handle text input for filtering
        if (str && str.length === 1 && !key?.ctrl && !key?.meta) {
          this.filterText += str;
          this.updateFilter();
          this.render();
        }
      };

      stdin.on('keypress', keypressHandler);
    });
  }

  private updateFilter(): void {
    const filter = this.filterText.toLowerCase();
    this.filteredItems = this.items.filter(item =>
      item.toLowerCase().includes(filter)
    );
    this.selectedIndex = 0;
    this.scrollOffset = 0;
  }

  private updateScroll(): void {
    // Ensure selected item is visible
    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollOffset + this.pageSize) {
      this.scrollOffset = this.selectedIndex - this.pageSize + 1;
    }
  }

  private render(): void {
    const stdout = process.stdout;

    // Clear previous render
    if (this.isActive) {
      // Move cursor up and clear
      stdout.write('\x1b[?25l'); // Hide cursor
    }

    let output = '\n';

    // Header
    output += chalk.magenta.bold('Select a skill or command:\n');

    // Filter indicator
    if (this.filterText) {
      output += chalk.gray('Filter: ') + this.colorTheme!.filter(this.filterText) + '\n';
    }

    output += chalk.gray('─'.repeat(60)) + '\n';

    // Items
    const visibleItems = this.filteredItems.slice(
      this.scrollOffset,
      this.scrollOffset + this.pageSize
    );

    visibleItems.forEach((item, index) => {
      const actualIndex = this.scrollOffset + index;
      const isSelected = actualIndex === this.selectedIndex;

      if (isSelected) {
        output += chalk.magenta('❯ ') + this.colorTheme!.selected(item) + '\n';
      } else {
        output += '  ' + this.colorTheme!.normal(item) + '\n';
      }
    });

    // Footer
    output += chalk.gray('─'.repeat(60)) + '\n';

    const showing = Math.min(this.pageSize, this.filteredItems.length);
    const total = this.filteredItems.length;
    output += chalk.gray(`Showing ${showing} of ${total} • ↑↓ Navigate • Enter Select • Esc Cancel\n`);

    // Write output
    stdout.write(output);
  }

  private cleanup(stdin: NodeJS.ReadStream, handler: any): void {
    this.isActive = false;
    stdin.removeListener('keypress', handler);

    if (stdin.isTTY && stdin.setRawMode) {
      stdin.setRawMode(false);
    }

    // Show cursor
    process.stdout.write('\x1b[?25h');

    // Clear menu
    const linesToClear = this.pageSize + 6; // header + items + footer
    for (let i = 0; i < linesToClear; i++) {
      process.stdout.write('\x1b[1A\x1b[2K'); // Move up and clear line
    }
  }
}

export async function showSkillMenu(skills: string[]): Promise<string | null> {
  const menu = new InteractiveMenu({
    items: skills,
    prompt: 'Select a skill:',
    pageSize: 15,
    colorTheme: {
      selected: (text) => chalk.black.bgMagenta.bold(` ${text} `),
      normal: (text) => chalk.white(text),
      prompt: (text) => chalk.magenta.bold(text),
      filter: (text) => chalk.cyan.bold(text)
    }
  });

  return await menu.show();
}
