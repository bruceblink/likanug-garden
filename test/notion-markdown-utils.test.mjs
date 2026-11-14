import assert from 'node:assert/strict'
import test from 'node:test'
import {normalizeNotionMarkdown, removeDuplicateTitle} from '../lib/notion-markdown-utils.ts'

test('normalizes Notion v2 block tags without changing fenced or inline code', () => {
  const source = [
    '# Article',
    '',
    '<image source="https://example.com/image.png">Caption</image>',
    '',
    '<synced_block url="https://example.com/block">Body</synced_block>',
    '',
    '<toggle heading="h2">Outer',
    '',
    '<toggle heading="h3">Inner</toggle>',
    '</toggle>',
    '',
    '`<image source="https://example.com/inline.png">`',
    '',
    '~~~html',
    '<image source="https://example.com/code.png">Code</image>',
    '~~~'
  ].join('\n')

  const normalized = normalizeNotionMarkdown(source)
  assert.match(normalized, /<notion-image source="https:\/\/example\.com\/image\.png">Caption<\/notion-image>/)
  assert.match(normalized, /<synced-block url="https:\/\/example\.com\/block">Body<\/synced-block>/)
  assert.match(normalized, /notion-toggle-h2/)
  assert.match(normalized, /notion-toggle-h3/)
  assert.match(normalized, /`<image source="https:\/\/example\.com\/inline\.png">`/)
  assert.match(normalized, /~~~html\n<image source="https:\/\/example\.com\/code\.png">Code<\/image>\n~~~/)
})

test('removes only a matching document title at the first block', () => {
  assert.equal(removeDuplicateTitle('# Article\n\nBody', 'Article'), 'Body')
  assert.equal(removeDuplicateTitle('Body\n\n# Article', 'Article'), 'Body\n\n# Article')
  assert.equal(removeDuplicateTitle('~~~\n# Article\n~~~\n\n# Other', 'Article'), '~~~\n# Article\n~~~\n\n# Other')
})
