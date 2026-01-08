import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

const PLATFORMS = {
  claude: ['.claude/skills/stacks-agent'],
  cursor: ['.cursor/commands', '.shared/stacks-agent'],
  windsurf: ['.windsurf/workflows', '.shared/stacks-agent'],
  antigravity: ['.agent/workflows', '.shared/stacks-agent'],
  copilot: ['.github/prompts', '.shared/stacks-agent'],
  kiro: ['.kiro/steering', '.shared/stacks-agent'],
  codex: ['.codex/skills/stacks-agent'],
  all: [] as string[] // Special case: all platforms
};

export async function init(options: { ai: string; version?: string; force?: boolean }) {
  const { ai, force } = options;
  const cwd = process.cwd();

  console.log(chalk.blue(`\n🚀 Installing Stacks Agent skill for ${ai}...\n`));

  const platforms = ai === 'all'
    ? Object.keys(PLATFORMS).filter(p => p !== 'all')
    : [ai];

  for (const platform of platforms) {
    const folders = PLATFORMS[platform as keyof typeof PLATFORMS];

    for (const folder of folders) {
      const srcPath = path.join(__dirname, '../assets', folder);
      const destPath = path.join(cwd, folder);

      if (fs.existsSync(destPath) && !force) {
        console.log(chalk.yellow(`  ⚠️  ${folder} already exists (use --force to overwrite)`));
        continue;
      }

      try {
        await fs.copy(srcPath, destPath);
        console.log(chalk.green(`  ✅ Copied ${folder}`));
      } catch (error) {
        console.log(chalk.red(`  ❌ Failed to copy ${folder}: ${error}`));
      }
    }
  }

  console.log(chalk.blue(`\n✨ Stacks Agent skill installed successfully!\n`));
  console.log(chalk.gray('Usage:'));
  console.log(chalk.gray('  Claude Code: Skill activates automatically on Stacks tasks'));
  console.log(chalk.gray('  Cursor/Windsurf: Use /stacksagent command'));
  console.log(chalk.gray('  Copilot: Use @stacksagent in chat\n'));
  console.log(chalk.gray('Search knowledge base:'));
  console.log(chalk.gray('  python3 .claude/skills/stacks-agent/scripts/search.py "query"\n'));
}
