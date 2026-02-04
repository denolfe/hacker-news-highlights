export type DomainHandlerParams = {
  url: string
  storyId: string
  title: string
}

export type DomainHandler = {
  type: 'github' | 'twitter' | 'youtube'
  handle: (params: DomainHandlerParams) => Promise<string>
}
