import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const source = join(root, 'backups', 'backup-20260623-151737', 'dist')
const target = join(root, 'dist', 'backups', 'backup-20260623-151737')

await mkdir(target, { recursive: true })
await cp(source, target, { recursive: true, force: true })

const indexPath = join(target, 'index.html')
const html = await readFile(indexPath, 'utf8')
const portableHtml = html.replaceAll('src="/assets/', 'src="./assets/').replaceAll('href="/assets/', 'href="./assets/')

await writeFile(indexPath, portableHtml)
console.log('Copied Slayfish build to dist/backups/backup-20260623-151737')
