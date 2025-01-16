# HN Recap Clone

> My attempt to recreate the Hacker News Recap podcast

## Proposed Steps

- [x] Fetch top 10 stories from Hacker News
- [x] For each story:
  - Get the title
  - Get the content
  - Get the comments
  - Summarize the content - scrape using readability
  - Summarize the comments
- [x] Generate a podcast script
- [x] Save the podcast script to a file
- [x] Generate an audio file from the podcast script

## TODO

- [ ] Upload the audio file to a podcast hosting service or generate RSS feed
- [ ] CI: generate mp3 on a daily basis
- [ ] Add logic to avoid duplicates
- [ ] Add actual logger
- [ ] Add arg parser
