# Raspberry Pi Trigger

GitHub `schedule` events can start many hours late or not at all. A systemd timer on a Raspberry Pi calls `workflow_dispatch` at 5:00am ET instead, and dispatch events start within seconds. The `schedule` cron in `generate-podcast.yml` stays as a backup. Whichever run comes second exits early once today's episode exists.

5:00am ET leaves 90 minutes before the 6:30am ET release for one manual rerun. HN is quiet overnight ET, so the top 10 changes little between about 00:45 and 05:00 ET. A later snapshot is slightly more settled (more of each story's eventual discussion has happened).

```
Pi: podcast-trigger.timer (5:00am America/New_York, Persistent=true)
  └─ podcast-trigger.service (DynamicUser, sandboxed, outbound HTTPS only)
       └─ curl POST /actions/workflows/generate-podcast.yml/dispatches
            inputs: skip_publish=false, voice_service=elevenlabs, scheduled_release=true
            └─ GitHub-hosted runner -> Transistor scheduled publish at 6:30am ET

GitHub: schedule cron (05:47 UTC = 00:47 EST, usually hours late)
  └─ same workflow; late: queued behind the Pi run, then skips
                    on time: runs first, then the Pi run skips
```

Unit files and install script: `deploy/pi/`

## Token

Create a fine-grained personal access token at **Settings > Developer settings > Fine-grained tokens**:

- **Repository access:** only `denolfe/hacker-news-highlights`
- **Permissions:** Actions: Read and write (Metadata: Read is added automatically). Nothing else.
- **Expiration:** 1 year. Add a calendar reminder a week before it expires.

A leaked token can start, cancel, and re-run workflows, delete caches, artifacts, and logs, and disable workflows. It cannot push code, read secrets, or change workflow files. To revoke, delete the token on the same settings page.

## Install

On the Pi (Raspberry Pi OS Bookworm or newer, for systemd credentials and `curl --fail-with-body`), from a clone of this repo:

```bash
sudo deploy/pi/install.sh
```

The script prompts for the token with input hidden and checks it against the GitHub API (read access only). It then writes the token to `/etc/podcast-trigger/github-auth-header` (root, 0600), installs and verifies the units, and enables the timer. It does not send a dispatch. Read the script before running it as root.

## Verify

`sudo systemctl start podcast-trigger.service` sends a real dispatch. If today's episode does not exist yet, this publishes it. Run it only after today's episode exists; the run then exits early, which proves the full path.

Logs, including the run URL from the dispatch response:

```bash
journalctl -u podcast-trigger.service -n 50
```

## Rotate the token

Re-run `sudo deploy/pi/install.sh` and paste the new token. Every step is safe to repeat.

## Uninstall

```bash
sudo deploy/pi/install.sh --uninstall
```

Disables the timer and removes the units and the token file. Revoke the token in GitHub settings separately.
