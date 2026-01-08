import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function update() {
  console.log(chalk.blue('\n🔄 Checking for updates...\n'));

  try {
    // Check current version
    const { stdout: currentVersion } = await execAsync('npm list -g stacks-agent --depth=0');
    console.log(chalk.gray(`Current version: ${currentVersion.trim()}`));

    // Check latest version
    const { stdout: latestVersion } = await execAsync('npm view stacks-agent version');
    console.log(chalk.gray(`Latest version: ${latestVersion.trim()}\n`));

    // Update
    console.log(chalk.blue('Installing latest version...'));
    await execAsync('npm install -g stacks-agent@latest');

    console.log(chalk.green('\n✅ Successfully updated to latest version!\n'));
    console.log(chalk.gray('Run "stacks-agent init" in your project to update skill files.\n'));
  } catch (error) {
    console.log(chalk.red(`\n❌ Update failed: ${error}\n`));
    console.log(chalk.gray('Try running: npm install -g stacks-agent@latest\n'));
  }
}
