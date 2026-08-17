# Media and Publish Skill

Use this skill for asset import, media conversion, manifests, firmware package generation and SD-card publishing.

## Media

Keep source assets separate from firmware target assets. Track conversion state, target path, hash, resolution, duration and compatibility.

Use asynchronous/background processing for expensive conversion. Never block the UI thread.

Where the contract requires target conversion, perform real conversion rather than copying or renaming files.

## Publish pipeline

Use an explicit pipeline:

`ThemeProject -> validate -> resolve assets -> convert -> generate form data -> generate metadata/manifests -> assemble package -> verify package`

Publishing must fail on blocking validation errors or incomplete required conversions.

Do not export Designer-only fields as firmware fields unless the contract explicitly defines them.

Do not silently modify global device configuration from a theme package.

## User experience

Show progress and actionable errors. After a successful publish, provide the generated package location and verification result.
