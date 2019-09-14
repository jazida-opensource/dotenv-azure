import { cd, exec, echo, touch } from 'shelljs'
import { readFileSync } from 'fs'
import { URL } from 'url'

let repoUrl: string
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
if (typeof pkg.repository === 'object') {
  if (!pkg.repository.url) {
    throw new Error('URL does not exist in repository section')
  }
  repoUrl = pkg.repository.url
} else {
  repoUrl = pkg.repository
}

const parsedUrl = new URL(repoUrl)
const repository = (parsedUrl.host || '') + (parsedUrl.pathname || '')
const ghToken = process.env.GH_TOKEN

echo('Deploying docs!!!')
cd('docs')
touch('.nojekyll')
exec('git init')
exec('git add .')
exec('git config user.name "Daniel Sousa"')
exec('git config user.email "sousa.dfs@gmail.com"')
exec('git commit -m "docs(docs): update gh-pages"')
exec(`git push --force --quiet "https://${ghToken}@${repository}" master:gh-pages`)
echo('Docs deployed!!')
