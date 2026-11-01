# output/

Generated media (git-ignored): `certificate-flow-lab-v<version>.mp4` and `certificate-flow-lab-v<version>-contact-sheet.jpg`, where `<version>` comes from `package.json` (v0.4.0: `certificate-flow-lab-v0.4.0.mp4`). Partial renders (`--seconds N`) are written as `certificate-flow-lab-v<version>-preview.mp4` and never overwrite the release film.

Create them with `npm run video` or `tools\windows\Export-Video.ps1` (needs FFmpeg and ffprobe on PATH).
