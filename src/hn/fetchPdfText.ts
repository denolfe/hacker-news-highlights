import { PDFParse } from 'pdf-parse'

/**
 * Parses text content from a PDF URL or raw PDF text.
 */
export async function fetchPdfText(urlOrText: string): Promise<string> {
  const isUrl = urlOrText.startsWith('http')
  const pdfBuffer = isUrl
    ? Buffer.from(await (await fetch(urlOrText)).arrayBuffer())
    : Buffer.from(urlOrText, 'utf-8')
  const parser = new PDFParse({ data: pdfBuffer })
  const textResult = await parser.getText()
  return textResult.text
}
