import { Readability } from '@mozilla/readability'
import { JSDOM, VirtualConsole } from 'jsdom'

import { fetchPdfText } from './fetchPdfText.js'

type ParseReturnType = Pick<
  NonNullable<ReturnType<Readability['parse']>>,
  'byline' | 'excerpt' | 'siteName' | 'textContent'
>

/**
 * Parse the HTML content of a site and extract the main text content, byline, excerpt, and site name.
 * If the input is a URL ending with .pdf, it will parse the PDF content instead.
 */
export async function parseSiteContent(htmlStringOrHtml: string): Promise<ParseReturnType> {
  // Check if the input is a URL or HTML string
  const isUrl = htmlStringOrHtml.startsWith('http')

  // Safeguard for PDF URLs
  if (isUrl && htmlStringOrHtml.endsWith('.pdf')) {
    const pdfText = await fetchPdfText(htmlStringOrHtml)
    return {
      siteName: '',
      textContent: pdfText,
      byline: '',
      excerpt: '',
    }
  }

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
