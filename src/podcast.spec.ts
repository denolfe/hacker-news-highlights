import type { Mock } from 'vitest'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { uploadPodcast } from '@/podcast.js'

vi.mock('fs/promises', () => ({
  default: { readFile: vi.fn().mockResolvedValue(Buffer.from('fake-audio')) },
}))

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  statusText: ok ? 'OK' : 'Unprocessable Entity',
  json: async () => body,
})

/** Mocks authorize/upload/create; publish PATCH resolves via `publishResult`. */
function mockTransistorApi(publishResult: (init: RequestInit) => unknown): Mock {
  const fetchMock = vi.fn().mockImplementation((url: string, init: RequestInit) => {
    if (url.includes('authorize_upload')) {
      return Promise.resolve(
        jsonResponse({
          data: {
            id: '1',
            type: 'upload',
            attributes: {
              upload_url: 'https://upload.example.com/file',
              audio_url: 'https://audio.example.com/file.mp3',
              content_type: 'audio/mpeg',
              expires_in: 600,
            },
          },
        }),
      )
    }
    if (url === 'https://upload.example.com/file') {
      return Promise.resolve({ ok: true, status: 200 })
    }
    if (url.endsWith('/episodes')) {
      return Promise.resolve(jsonResponse({ data: { id: '42' } }))
    }
    if (url.endsWith('/episodes/42/publish')) {
      return Promise.resolve(publishResult(init))
    }
    throw new Error(`Unexpected fetch: ${url}`)
  })
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

const publishPatchBody = (fetchMock: Mock): Record<string, unknown> => {
  const call = fetchMock.mock.calls.find(([url]) => (url as string).endsWith('/publish'))
  expect(call).toBeDefined()
  return JSON.parse((call?.[1] as RequestInit).body as string)
}

const uploadArgs = {
  audioFilePath: '/tmp/output.mp3',
  title: 'Test Episode',
  showNotes: 'Notes',
}

describe('uploadPodcast publish behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TRANSISTOR_API_KEY = 'test-key'
  })

  it('publishes immediately when publishAt is absent', async () => {
    const fetchMock = mockTransistorApi(() =>
      jsonResponse({ data: { attributes: { status: 'published' } } }),
    )
    await uploadPodcast(uploadArgs)
    const body = publishPatchBody(fetchMock)
    expect(body.episode).toEqual({ status: 'published' })
  })

  it('schedules with ISO published_at when publishAt is set', async () => {
    const fetchMock = mockTransistorApi(() =>
      jsonResponse({ data: { attributes: { status: 'scheduled' } } }),
    )
    const publishAt = new Date('2026-07-15T10:30:00.000Z')
    await uploadPodcast({ ...uploadArgs, publishAt })
    const body = publishPatchBody(fetchMock)
    expect(body.episode).toEqual({
      status: 'scheduled',
      published_at: '2026-07-15T10:30:00.000Z',
    })
  })

  it('throws when the publish PATCH returns non-OK', async () => {
    mockTransistorApi(() => jsonResponse({ errors: ['bad'] }, false, 422))
    await expect(uploadPodcast(uploadArgs)).rejects.toThrow(/Failed to publish/)
  })

  it('accepts immediate publish when the scheduled time has already passed', async () => {
    mockTransistorApi(() => jsonResponse({ data: { attributes: { status: 'published' } } }))
    const publishAt = new Date('2026-07-15T10:30:00.000Z')
    await expect(uploadPodcast({ ...uploadArgs, publishAt })).resolves.toBeUndefined()
  })

  it('throws when the returned status does not match the requested one', async () => {
    mockTransistorApi(() => jsonResponse({ data: { attributes: { status: 'draft' } } }))
    const publishAt = new Date('2026-07-15T10:30:00.000Z')
    await expect(uploadPodcast({ ...uploadArgs, publishAt })).rejects.toThrow(/Failed to publish/)
  })
})
