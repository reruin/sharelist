const child_process = require('child_process')

const COMMIT_PATTERN = /^([^)]*)(?:\(([^)]*?)\)|):(.*?(?:\[([^\]]+?)\]|))\s*$/

// const PR_REGEX = /#[1-9][\d]*/g

const SEPARATOR = '===END==='

const TYPES = {
  breaking: 'Breaking Changes',
  feat: 'New Features',
  fix: 'Bug Fixes',
}

const run = cmd => new Promise((resolve, reject) => {
  child_process.exec(cmd, (error, stdout, stderr) => {
    if (error) {
      resolve()
    } else {
      resolve(stdout)
    }
  })
})

const markdown = (commits, REPO_URL) => {
  let content = []
  Object.keys(commits).filter(type => TYPES[type]).forEach((type) => {
    content.push('##### ' + TYPES[type])
    content.push('');
    Object.keys(commits[type]).forEach(category => {

      let multiline = commits[type][category].length > 1;
      let head = category ? `* **${category}:**` : '*'

      if (multiline && category) {
        content.push(head);
        head = '  *'
      }

      commits[type][category].forEach((commit) => {
        let hashLink = REPO_URL ? `[${commit.hash.substring(0, 8)}](${REPO_URL}/commit/${commit.hash})` : `${commit.hash.substring(0, 8)}`
        content.push(`${head} ${commit.subject} (${hashLink})`)
      });
    })
    content.push('');
  })

  return content.join('\n')
}

const main = async (REPO_URL) => {
  let hash = await run(`git rev-list --tags --max-count=2`)

  let fromVer = 'HEAD'

  if (hash) {
    let lastTagHash = hash.split(/[\r\n]/g)[1]
    if (lastTagHash) {
      let hit = await run(`git describe --abbrev=0 --tags ${lastTagHash}`)
      if (hit) fromVer = hit.toString().trim()
    }
  }

  const commits = await run(`git log -E --format=%H%n%s%n%b%n${SEPARATOR} ${fromVer}..`)

  const content = markdown(commits.split('\n' + SEPARATOR + '\n').filter(Boolean).map(raw => {
    const [hash, subject, ...body] = raw.split('\n');
    const commit = {
      hash, subject
    }

    const parsed = commit.subject.match(COMMIT_PATTERN)

    if (!parsed || !parsed[1] || !parsed[3]) {
      return null
    }

    commit.type = parsed[1].toLowerCase()
    commit.category = parsed[2] || ''
    commit.subject = parsed[3]

    return commit
  }).filter(Boolean).reduce((t, c) => {
    t[c.type] = t[c.type] || {}
    t[c.type][c.category] = t[c.type][c.category] || []
    t[c.type][c.category].push(c)
    return t
  }, {}), REPO_URL)

  return content
}

// (async function () {
//   console.log(await main())
// })()
module.exports = main
