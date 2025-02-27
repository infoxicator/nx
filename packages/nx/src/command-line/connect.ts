import { output } from '../utils/output';
import { getPackageManagerCommand } from '../utils/package-manager';
import { execSync } from 'child_process';
import { readNxJson } from '../config/configuration';
import {
  getNxCloudToken,
  getNxCloudUrl,
  isNxCloudUsed,
} from '../utils/nx-cloud-utils';
import { existsSync } from 'fs';
import { join } from 'path';
import { workspaceRoot } from '../utils/workspace-root';

export async function connectToNxCloudIfExplicitlyAsked(opts: {
  [k: string]: any;
}): Promise<void> {
  if (opts['cloud'] === true) {
    const nxJson = readNxJson();
    const runners = Object.values(nxJson.tasksRunnerOptions);
    const onlyDefaultRunnerIsUsed =
      runners.length === 1 && runners[0].runner === 'nx/tasks-runners/default';
    if (!onlyDefaultRunnerIsUsed) return;

    output.log({
      title: '--cloud requires the workspace to be connected to Nx Cloud.',
    });
    const pmc = getPackageManagerCommand();
    const nxCommand = existsSync(join(workspaceRoot, 'package.json'))
      ? `${pmc.exec} nx`
      : process.platform === 'win32'
      ? './nx.bat'
      : './nx';
    execSync(`${nxCommand} connect-to-nx-cloud`, {
      stdio: [0, 1, 2],
    });
    output.success({
      title: 'Your workspace has been successfully connected to Nx Cloud.',
    });
    process.exit(0);
  }
}

export async function connectToNxCloudCommand(
  promptOverride?: string
): Promise<boolean> {
  if (isNxCloudUsed()) {
    output.log({
      title: '✅ This workspace is already connected to Nx Cloud.',
      bodyLines: [
        'This means your workspace can use computation caching, distributed task execution, and show you run analytics.',
        'Go to https://nx.app to learn more.',
        ' ',
        'If you have not done so already, please claim this workspace:',
        `${getNxCloudUrl()}/orgs/workspace-setup?accessToken=${getNxCloudToken()}`,
      ],
    });
    return false;
  }

  const res = await connectToNxCloudPrompt(promptOverride);
  if (!res) return false;
  const pmc = getPackageManagerCommand();
  const nxCommand = pmc
    ? `${pmc.exec} nx`
    : process.platform === 'win32'
    ? './nx.bat'
    : './nx';
  if (pmc) {
    execSync(`${pmc.addDev} @nrwl/nx-cloud@latest`);
  } else {
    const nxJson = readNxJson();
    if (nxJson.installation) {
      nxJson.installation.plugins ??= {};
      nxJson.installation.plugins['@nrwl/nx-cloud'] = execSync(
        `npm view @nrwl/nx-cloud@latest version`
      ).toString();
    }
  }
  execSync(`${nxCommand} g @nrwl/nx-cloud:init`, {
    stdio: [0, 1, 2],
  });
  return true;
}

async function connectToNxCloudPrompt(prompt?: string) {
  return await (
    await import('enquirer')
  )
    .prompt([
      {
        name: 'NxCloud',
        message: prompt ?? `Enable distributed caching to make your CI faster`,
        type: 'autocomplete',
        choices: [
          {
            name: 'Yes',
            hint: 'I want faster builds',
          },
          {
            name: 'No',
          },
        ],
        initial: 'Yes' as any,
      },
    ])
    .then((a: { NxCloud: 'Yes' | 'No' }) => a.NxCloud === 'Yes');
}
