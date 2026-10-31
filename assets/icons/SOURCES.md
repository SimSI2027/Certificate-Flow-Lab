# Icon sources

## Summary
**No official Microsoft icons are used in v0.3.0.** Every icon in the application is a custom flat vector drawn for this project (`src/views/icons.js`, listed in `assets/icons/manifest.json`). They are **not** official Microsoft icons and are never presented as such.

## Why no official icons
The project needs icons for on-premises PKI concepts: Enterprise Issuing CA, offline Root CA, certificate template, CSR, certificate store, CRL/AIA/CDP repositories, Domain Controller and IIS binding. Microsoft's published architecture icon sets (for example the Azure architecture icons) cover cloud services and a small number of Microsoft 365 products; they do not provide accurate icons for these AD CS concepts, and an Azure service icon must not stand in for a different on-premises product. When no accurate official icon exists the policy is to draw a neutral custom icon rather than misuse an official one. No external SVGs were downloaded, and nothing is fetched at runtime.

## Custom icon family
- Simple flat vector geometry, one base shape (rack server) with a role badge: CA seal, Root padlock, DC directory tree, repository download arrow, and so on.
- Restrained flat colours, readable at 36 px, no photorealism, no pseudo-3D towers.
- Every icon has a text label and description (`manifest.json`), is hidden from assistive technology (`aria-hidden`) and is always accompanied by the object's name.

## Rules for adding official icons later
For every external icon record in this file: filename, represented product or component, official source URL, date retrieved, usage-terms URL, original name, and whether the asset was modified. Store a local copy under `assets/icons/official/`; never load icons from the internet at runtime. Do not crop, flip, rotate, distort or recolour official product icons unless the published terms allow it; keep the official product name near an official icon; do not use an icon for a different product.

## External icon register
| filename | product / component | source URL | date retrieved | terms URL | original name | modified |
|----------|--------------------|------------|----------------|-----------|---------------|----------|
| _(none)_ | | | | | | |
