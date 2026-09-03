import fs from 'node:fs'
import path from 'node:path'

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function cleanBody(raw) {
  return decodeHtml(
    raw
      .replace(/\{`([\s\S]*?)`\}/g, '$1')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/?[^>]+>/g, '')
      .replace(/\\n/g, '\n')
      .trim()
  )
}

function extractBlocks(srcPath) {
  let text = fs.readFileSync(srcPath, 'utf8')
  const cut = text.indexOf('SUPER CRITICAL')
  if (cut >= 0) text = text.slice(0, cut)

  // Normalize lists into placeholder paragraphs we can parse in order
  text = text.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/g, (_, inner) => {
    const items = [...inner.matchAll(/<li[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/li>/g)]
    if (items.length === 0) {
      const plain = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
      return plain
        .map((x) => `<p data-list-item="1">${cleanBody(x[1])}</p>`)
        .join('\n')
    }
    return items.map((x) => `<p data-list-item="1">${x[1]}</p>`).join('\n')
  })

  const blocks = []
  const reP = /<p([^>]*)>([\s\S]*?)<\/p>/g
  let m
  while ((m = reP.exec(text)) !== null) {
    const attrs = m[1]
    const body = cleanBody(m[2])
    // Skip empty / zero-width-only paragraphs (Figma spacer rows)
    if (!body || /^[\u200b\u200c\u200d\ufeff\s]*$/.test(body)) continue

    if (attrs.includes('data-list-item')) {
      blocks.push({ t: 'li', body })
      continue
    }

    const is24 = attrs.includes('text-[24px]')
    const is20 = attrs.includes('text-[20px]')
    if (body === 'Terms of Service' || body === 'Privacy Policy') {
      blocks.push({ t: 'h1', body })
    } else if (is24) {
      blocks.push({ t: 'h2', body })
    } else if (is20) {
      blocks.push({ t: 'h3', body })
    } else {
      blocks.push({ t: 'p', body })
    }
  }

  // Privacy categories table at end (cells are divs 371:9458 / 9460 / 9462)
  const tableStart = text.indexOf('data-name="Privacy Data Categories Table"')
  if (tableStart >= 0) {
    const tableSection = text.slice(tableStart)
    const headers = [
      'Categories of Personal Data',
      'Use of Personal Data',
      'Disclosure of Personal Data',
    ]
    const cellIds = ['371:9458', '371:9460', '371:9462']
    const cells = []

    for (const id of cellIds) {
      const marker = `data-node-id="${id}"`
      const i = tableSection.indexOf(marker)
      if (i < 0) continue
      // Slice until next sibling absolute column or end of table body chunk
      const rest = tableSection.slice(i)
      const nextAbs = rest.search(/\n\s*<div className="absolute flex h-/)
      const chunk = nextAbs > 0 ? rest.slice(0, nextAbs) : rest.slice(0, 4000)

      const paras = [...chunk.matchAll(/<p([^>]*)>([\s\S]*?)<\/p>/g)]
      const intro = paras
        .filter((x) => !x[1].includes('data-list-item'))
        .map((x) => cleanBody(x[2]))
        .find((t) => t && !/^[\u200b\u200c\u200d\ufeff\s]*$/.test(t))

      let items = paras
        .filter((x) => x[1].includes('data-list-item'))
        .map((x) => cleanBody(x[2]))
        .filter(Boolean)

      if (items.length === 0) {
        items = [...chunk.matchAll(/<li[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/li>/g)].map(
          (x) => cleanBody(x[1])
        )
      }

      const parts = []
      if (intro) parts.push(intro)
      for (const item of items) parts.push(`- ${item}`)
      cells.push(parts.join('<br>'))
    }

    if (cells.length === 3) {
      const dropStarts = [
        'We collect the following information',
        'We use this information for the following purposes',
        'We may disclose this information',
      ]
      // Remove raw table content already parsed as paragraphs/list items near the end
      let cut = -1
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i]
        if (b.t === 'p' && headers.includes(b.body)) {
          cut = i
          break
        }
      }
      if (cut < 0) {
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i]
          if (b.t === 'p' && dropStarts.some((s) => b.body.startsWith(s))) {
            cut = i
            break
          }
        }
      }
      if (cut >= 0) blocks.splice(cut)
      blocks.push({ t: 'table', headers, cells })
    }
  }

  return blocks
}

function paragraphToMd(body) {
  if (!body.includes('•')) return body
  const idx = body.indexOf('•')
  const before = body.slice(0, idx).trim()
  const bullets = body.match(/•\s*[^•]+/g) || []
  const lines = []
  if (before) lines.push(before, '')
  for (const b of bullets) {
    lines.push(`- ${b.replace(/^•\s*/, '').trim()}`)
  }
  return lines.join('\n')
}

function toMd(blocks) {
  const out = []
  let inList = false
  for (const b of blocks) {
    if (b.t === 'li') {
      if (!inList) inList = true
      out.push(`- ${b.body}`)
      continue
    }
    if (inList) {
      out.push('')
      inList = false
    }
    if (b.t === 'h1') out.push(`# ${b.body}`, '')
    else if (b.t === 'h2') out.push(`## ${b.body}`, '')
    else if (b.t === 'h3') out.push(`### ${b.body}`, '')
    else if (b.t === 'table') {
      // Prefer readable sections over a wide GFM table (lists render poorly in cells)
      for (let i = 0; i < b.headers.length; i++) {
        out.push(`### ${b.headers[i]}`, '')
        const cell = (b.cells[i] || '').replace(/<br>/g, '\n')
        out.push(cell, '')
      }
    } else out.push(paragraphToMd(b.body), '')
  }
  if (inList) out.push('')
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

const termsSrc =
  'C:/Users/jinwei.yang.SWIFTPASS/.cursor/projects/d-workspace-cursor/agent-tools/6d664133-34e8-4ae8-854b-15f992c533be.txt'
const privacySrc =
  'C:/Users/jinwei.yang.SWIFTPASS/.cursor/projects/d-workspace-cursor/agent-tools/7b6f07ac-0de6-4126-b9c9-c1c851bb0fc2.txt'

const outDir = path.resolve('docs/legal')
fs.mkdirSync(outDir, { recursive: true })

const termsMd = toMd(extractBlocks(termsSrc))
const privacyMd = toMd(extractBlocks(privacySrc))

fs.writeFileSync(path.join(outDir, 'terms-of-service.md'), termsMd)
fs.writeFileSync(path.join(outDir, 'privacy-policy.md'), privacyMd)

console.log('Wrote terms', termsMd.length, 'chars')
console.log('Wrote privacy', privacyMd.length, 'chars')
