import { cp, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceExampleDir = join(repoRoot, 'example');
const rootPackagePath = join(repoRoot, 'package.json');
const sdkPackage: PackageJson = JSON.parse(await readFile(rootPackagePath, 'utf8'));
const sdkName = sdkPackage.name;
const sdkSpec = process.env.WORKOS_AUTHKIT_TANSTACK_START_VERSION || sdkPackage.version;
const deployArgs = process.argv.slice(2);
const keepStagingDir = process.env.KEEP_CLOUDFLARE_DEPLOY_DIR === '1';

const stagingRoot = await mkdtemp(join(tmpdir(), 'authkit-tanstack-start-cloudflare-'));
const stagedExampleDir = join(stagingRoot, 'example');

function shouldCopy(src: string): boolean {
  const name = basename(src);
  if (name === 'node_modules' || name === 'dist' || name === '.wrangler') return false;
  if (name === '.env') return false;
  if (name.startsWith('.dev.vars') && name !== '.dev.vars.example') return false;
  return true;
}

function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', rejectRun);
    child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      rejectRun(new Error(`${command} ${args.join(' ')} failed with ${signal || `exit code ${code}`}`));
    });
  });
}

try {
  await cp(sourceExampleDir, stagedExampleDir, {
    recursive: true,
    filter: shouldCopy,
  });
  await cp(rootPackagePath, join(stagingRoot, 'package.json'));
  await cp(join(repoRoot, 'pnpm-lock.yaml'), join(stagingRoot, 'pnpm-lock.yaml'));
  await cp(join(repoRoot, 'pnpm-workspace.yaml'), join(stagingRoot, 'pnpm-workspace.yaml'));
  await cp(join(repoRoot, 'tsconfig.json'), join(stagingRoot, 'tsconfig.json'));

  const packagePath = join(stagedExampleDir, 'package.json');
  const examplePackage: PackageJson = JSON.parse(await readFile(packagePath, 'utf8'));

  if (!examplePackage.dependencies?.[sdkName]) {
    throw new Error(`Expected ${sdkName} in example dependencies.`);
  }

  examplePackage.dependencies[sdkName] = sdkSpec;
  examplePackage.scripts!.deploy = 'vite build && tsc --noEmit && wrangler deploy';

  await writeFile(packagePath, `${JSON.stringify(examplePackage, null, 2)}\n`);

  console.log(`Staged Cloudflare deploy in ${stagedExampleDir}`);
  console.log(`Using published ${sdkName}@${sdkSpec}`);

  await run('pnpm', ['install'], stagingRoot);

  const dependencyLink = join(stagedExampleDir, 'node_modules', '@workos', 'authkit-tanstack-react-start');
  const dependencyTarget = resolve(dirname(dependencyLink), await readlink(dependencyLink));
  if (dependencyTarget === stagingRoot) {
    throw new Error(`Staged deploy resolved ${sdkName} to the local workspace instead of npm.`);
  }

  await run('pnpm', ['run', 'build'], stagedExampleDir);
  await run('pnpm', ['exec', 'wrangler', 'deploy', ...deployArgs], stagedExampleDir);
} finally {
  if (keepStagingDir) {
    console.log(`Kept staging directory: ${stagedExampleDir}`);
  } else {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}
