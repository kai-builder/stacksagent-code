import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function versions() {
  console.log(chalk.blue('\n📦 Stacks Agent versions:\n'));

  try {
    const { stdout } = await execAsync('npm view stacksagent versions --json');
    const versionList = JSON.parse(stdout);

    console.log(chalk.gray('Available versions:'));
    versionList.slice(-10).forEach((v: string) => {
      console.log(chalk.green(`  • ${v}`));
    });

    if (versionList.length > 10) {
      console.log(chalk.gray(`  ... and ${versionList.length - 10} more\n`));
    } else {
      console.log('');
    }

    console.log(chalk.gray('Install specific version:'));
    console.log(chalk.gray('  npm install -g stacksagent@<version>\n'));
  } catch (error) {
    console.log(chalk.red(`\n❌ Failed to fetch versions: ${error}\n`));
  }
}
