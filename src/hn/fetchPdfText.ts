import { PDFParse } from 'pdf-parse'

/** Convert GitHub blob URLs to raw URLs for direct file access */
function toRawUrl(url: string): string {
  // https://github.com/user/repo/blob/branch/file.pdf -> https://raw.githubusercontent.com/user/repo/branch/file.pdf
  const githubBlobMatch = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)$/)
  if (githubBlobMatch) {
    return `https://raw.githubusercontent.com/${githubBlobMatch[1]}/${githubBlobMatch[2]}`
  }
  return url
}

/**
 * Parses text content from a PDF URL or raw PDF text.
 */
export async function fetchPdfText(urlOrText: string): Promise<string> {
  const isUrl = urlOrText.startsWith('http')
  const fetchUrl = isUrl ? toRawUrl(urlOrText) : urlOrText
  const pdfBuffer = isUrl
    ? Buffer.from(await (await fetch(fetchUrl)).arrayBuffer())
    : Buffer.from(urlOrText, 'utf-8')
  const parser = new PDFParse({ data: pdfBuffer })
  const textResult = await parser.getText()
  return textResult.text
}
