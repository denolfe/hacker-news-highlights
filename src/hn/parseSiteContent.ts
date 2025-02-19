import { Readability } from '@mozilla/readability'
import { JSDOM, VirtualConsole } from 'jsdom'

type ParseReturnType = Pick<
  NonNullable<ReturnType<Readability['parse']>>,
  'byline' | 'excerpt' | 'siteName' | 'textContent'
>

export async function parseSiteContent(htmlStringOrHtml: string): Promise<ParseReturnType> {
  // Check if the input is a URL or HTML string
  const isUrl = htmlStringOrHtml.startsWith('http')
  const htmlString = isUrl
    ? await fetch(htmlStringOrHtml).then(res => res.text())
    : htmlStringOrHtml

  const virtualConsole = new VirtualConsole()
  virtualConsole.on('error', () => {
    // Ignore errors, keeps the output clean
    // https://github.com/jsdom/jsdom/issues/2230#issuecomment-466915328
  })
  const dom = new JSDOM(htmlString, { virtualConsole })
  const parsed = new Readability(dom.window.document).parse()

  return (
    parsed ?? {
      siteName: '',
      textContent: 'No content found for this story',
      byline: '',
      excerpt: '',
    }
  )
}
