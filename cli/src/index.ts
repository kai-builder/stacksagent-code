#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { init } from './commands/init';
import { update } from './commands/update';
import { versions } from './commands/versions';

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('stacksagent')
  .description('AI Skill for building Stacks blockchain applications')
  .version(packageJson.version);

program
  .command('init')
  .description('Initialize Stacks Agent skill in your project')
  .option('--ai <platform>', 'AI platform (claude, cursor, windsurf, antigravity, copilot, kiro, codex, all)', 'claude')
  .option('--version <version>', 'Specific version to install')
  .option('--force', 'Overwrite existing files')
  .action(init);

program
  .command('update')
  .description('Update to the latest version')
  .action(update);

program
  .command('versions')
  .description('List available versions')
  .action(versions);

program.parse();
