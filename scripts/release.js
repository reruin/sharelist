
/**
 * modified from https://github.com/vuejs/vue-next/blob/master/scripts/release.js
 */
const execa = require('execa')
const path = require('path')
const fs = require('fs')
const args = require('minimist')(process.argv.slice(2))
const semver = require('semver')
const chalk = require('chalk')
const prompts = require('prompts')

const pkgDir = process.cwd()
const pkgPath = path.resolve(pkgDir, 'package.json')

const remote = 'origin'

/**
 * @type {{ name: string, version: string }}
 */
const pkg = require(pkgPath)
const pkgName = pkg.name.replace(/^@sharelist\//, '')
const currentVersion = pkg.version

const isDryRun = args.dry

const skipBuild = args.skipBuild

const skipNpmPublish = args.skipNpmPublish

/**
 * @type {import('semver').ReleaseType[]}
 */
const versionIncrements = [
  'patch',
  'minor',
  'major',
  'prepatch',
  'preminor',
  'premajor',
  'prerelease'
]


const inc = (i) => semver.inc(currentVersion, i, 'beta')

const run = isDryRun ? (bin, args, opts = {}) =>
  console.log(chalk.blue(`[dryrun] ${bin} ${args.join(' ')}`), opts) : (bin, args, opts = {}) =>
  execa(bin, args, { stdio: 'inherit', ...opts })


const step = (msg) => console.log(chalk.cyan(msg))

async function main() {
  let targetVersion = args._[0]

  if (!targetVersion) {
    // no explicit version, offer suggestions
    /**
     * @type {{ release: string }}
     */
    const { release } = await prompts({
      type: 'select',
      name: 'release',
      message: 'Select release type',
      choices: versionIncrements
        .map((i) => `${i} (${inc(i)})`)
        .concat(['custom'])
        .map((i) => ({ value: i, title: i }))
    })

    if (release === 'custom') {
      /**
       * @type {{ version: string }}
       */
      const res = await prompts({
        type: 'text',
        name: 'version',
        message: 'Input custom version',
        initial: currentVersion
      })
      targetVersion = res.version
    } else {
      targetVersion = release.match(/\((.*)\)/)[1]
    }
  }

  if (!semver.valid(targetVersion)) {
    throw new Error(`invalid target version: ${targetVersion}`)
  }

  const tag =
    pkgName === 'sharelist' ? `v${targetVersion}` : `${pkgName}@${targetVersion}`

  if (targetVersion.includes('beta') && !args.tag) {
    /**
     * @type {{ tagBeta: boolean }}
     */
    const { tagBeta } = await prompts({
      type: 'confirm',
      name: 'tagBeta',
      message: `Publish under dist-tag "beta"?`
    })

    if (tagBeta) args.tag = 'beta'
  }

  /**
   * @type {{ yes: boolean }}
   */
  const { yes } = await prompts({
    type: 'confirm',
    name: 'yes',
    message: `Releasing ${tag}. Confirm?`
  })

  if (!yes) {
    return
  }

  step('\nUpdating package version...')
  updateVersion(targetVersion)

  step('\nBuilding package...')
  if (!skipBuild && !isDryRun) {
    await run('yarn', ['build'])
  } else {
    console.log(`(skipped)`)
  }

  step('\nGenerating changelog...')
  await run('yarn', ['changelog'])

  const { stdout } = await run('git', ['diff'], { stdio: 'pipe' })
  if (stdout) {
    step('\nCommitting changes...')
    await run('git', ['add', '-A'])
    await run('git', ['commit', '-m', `release: ${tag}`])
  } else {
    console.log('No changes to commit.')
  }

  if (!skipNpmPublish) {
    step('\nPublishing package...')
    await publishPackage(targetVersion, run)
  }

  step('\nPushing to GitHub...')
  await run('git', ['tag', tag])
  await run('git', ['push', remote, `refs/tags/${tag}`])
  await run('git', ['push', remote, 'master'])

  if (isDryRun) {
    console.log(`\nDry run finished - run git diff to see package changes.`)
  }

  console.log()
}

/**
 * @param {string} version
 */
function updateVersion(version) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  pkg.version = version
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

/**
 * @param {string} version
 * @param {Function} run
 */
async function publishPackage(version, run) {
  const publicArgs = [
    'publish',
    '--no-git-tag-version',
    '--new-version',
    version,
    '--registry',
    'http://registry.npmjs.org/',
    '--access',
    'public'
  ]
  if (args.tag) {
    publicArgs.push(`--tag`, args.tag)
  }
  try {
    await run('yarn', publicArgs, {
      stdio: 'pipe'
    })
    console.log(chalk.green(`Successfully published ${pkgName}@${version}`))
  } catch (e) {
    if (e.stderr.match(/previously published/)) {
      console.log(chalk.red(`Skipping already published: ${pkgName}`))
    } else {
      throw e
    }
  }
}

main().catch((err) => {
  console.error(err)
})