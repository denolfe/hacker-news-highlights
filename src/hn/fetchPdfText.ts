import { PDFParse } from 'pdf-parse'

/**
 * Parses text content from a PDF URL or raw PDF text.
 */
export async function fetchPdfText(urlOrText: string): Promise<string> {
  const isUrl = urlOrText.startsWith('http')
  const pdfBuffer = isUrl
    ? Buffer.from(await (await fetch(toRawGitHubUrl(urlOrText))).arrayBuffer())
    : Buffer.from(urlOrText, 'utf-8')
  const parser = new PDFParse({ data: pdfBuffer })
  const textResult = await parser.getText()
  return textResult.text
}

/** GitHub `blob/` URLs serve an HTML viewer page; the raw host serves the file bytes. */
export function toRawGitHubUrl(url: string): string {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/)
  if (!match) {
    return url
  }
  const [, owner, repo, refAndPath] = match
  return `https://raw.githubusercontent.com/${owner}/${repo}/${refAndPath}`
}
