# output/

Generated media (git-ignored):
- App film: `certificate-flow-lab-v<version>.mp4` and `certificate-flow-lab-v<version>-contact-sheet.jpg`, where `<version>` comes from `package.json`. Partial renders (`--seconds N`) are written as `certificate-flow-lab-v<version>-preview.mp4` and never overwrite the release film. Create them with `npm run video` or `tools\windows\Export-Video.ps1`.
- Learning film (v0.6.0): `certificate-flow-lab-learning-film-v1.mp4` and `certificate-flow-lab-learning-film-v1-contact-sheet.jpg`, created with `npm run video:learning` (preview renders: `...-v1-preview.mp4`).

Both need FFmpeg and ffprobe on PATH.
