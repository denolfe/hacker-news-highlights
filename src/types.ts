export type StorySummary = {
  storyId: string
  text: string
}

export type StoryOutput = {
  content: string
  comments: SlimComment[]
  title: string
  url: string
  story_id: number
}

export type SlimComment = Pick<Comment, 'id' | 'created_at' | 'text' | 'children' | 'author'>

export type Comment = {
  id: number
  created_at: string
  author: string
  text: string
  points: number
  parent_id: number | null
  children: Comment[]
}

export type Story = {
  id: number
  created_at: string
  author: string
  title: string
  url: string
  text: string | null
  points: number
  parent_id: number | null
  children: Comment[]
}

export type HighlightResult = {
  author: {
    matchLevel: string
    matchedWords: string[]
    value: string
  }
  title: {
    matchLevel: string
    matchedWords: string[]
    value: string
  }
  url: {
    matchLevel: string
    matchedWords: string[]
    value: string
  }
}

export type Hit = {
  _highlightResult: HighlightResult
  _tags: string[]
  author: string
  children: number[]
  created_at: string
  created_at_i: number
  num_comments: number
  objectID: string
  points: number
  story_id: number
  title: string
  updated_at: string
  url: string
}

export type ProcessingTimingsMS = {
  _request: {
    roundTrip: number
  }
  total: number
}

export type Exhaustive = {
  nbHits: boolean
  typo: boolean
}

export type ResponseData = {
  exhaustive: Exhaustive
  exhaustiveNbHits: boolean
  exhaustiveTypo: boolean
  hits: Hit[]
  hitsPerPage: number
  nbHits: number
  nbPages: number
  page: number
  params: string
  processingTimeMS: number
  processingTimingsMS: ProcessingTimingsMS
  query: string
  serverTimeMS: number
}
