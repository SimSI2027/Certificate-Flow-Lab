# Icon sources

## Summary
**No official Microsoft icons are used (v0.3.0, v0.4.0 and v0.5.0).** Every icon in the application is a custom flat vector drawn for this project (`src/views/icons.js`, listed in `assets/icons/manifest.json`). They are **not** official Microsoft icons and are never presented as such.

## Why no official icons
The project needs icons for on-premises PKI concepts: Enterprise Issuing CA, offline Root CA, certificate template, CSR, certificate store, CRL/AIA/CDP repositories, Domain Controller and IIS binding. Microsoft's published architecture icon sets (for example the Azure architecture icons) cover cloud services and a small number of Microsoft 365 products; they do not provide accurate icons for these AD CS concepts, and an Azure service icon must not stand in for a different on-premises product. When no accurate official icon exists the policy is to draw a neutral custom icon rather than misuse an official one. No external SVGs were downloaded, and nothing is fetched at runtime.

## Custom icon family
- Simple flat vector geometry, one base shape (rack server) with a role badge: CA seal, Root padlock, DC directory tree, repository download arrow, and so on.
- Restrained flat colours, readable at 36 px, no photorealism, no pseudo-3D towers.
- Every icon has a text label and description (`manifest.json`), is hidden from assistive technology (`aria-hidden`) and is always accompanied by the object's name.

## v0.4.0 story artifact vocabulary (custom, not official)
Fifteen custom icons were added for the Domain Controller story (`a-*` ids in `manifest.json`, `added: "0.4.0"`). Each is always shown with a fixed text label and a colour token, so colour is never the only signal:
private key (key + lock, amber, "stays on DC01"), INF / CRL document (grey), CSR (envelope, blue), transfer and return package (open box + content chips, slate, "no private key" stamp), request record (ledger row, purple), issued leaf (ribbon certificate, gold), accepted leaf (ribbon + key badge, gold), Issuing CA certificate (certificate + "CA" tab, teal), Root CA certificate (certificate + anchor, green, "public copy · trust anchor"), chain (three stacked mini-cards), error record, identity card, template card, enrollment wizard and remediation checklist. All were drawn for this project; none copies or imitates a Microsoft product icon.

## v0.5.0 Website TLS story vocabulary (custom, not official)
Five custom icons were added for the redesigned Website TLS lesson (`added: "0.5.0"` in `manifest.json`). Like the DC set, each is always shown with a fixed text label and a colour token: **browser warning** (`a-browser`: a browser window with a warning triangle), **problem report** (`a-ticket`: a speech bubble), **IIS site binding** (`a-iis`: a site window with a globe and a padlock), **TLS handshake message** (`a-handshake`: two opposing arrows on indigo) and **trusted connection** (`a-padlock`: a green padlock with a check mark). They were drawn for this project; none copies or imitates a Microsoft, IIS or browser vendor icon, and they are never presented as official.

## Rules for adding official icons later
For every external icon record in this file: filename, represented product or component, official source URL, date retrieved, usage-terms URL, original name, and whether the asset was modified. Store a local copy under `assets/icons/official/`; never load icons from the internet at runtime. Do not crop, flip, rotate, distort or recolour official product icons unless the published terms allow it; keep the official product name near an official icon; do not use an icon for a different product.

## External icon register
| filename | product / component | source URL | date retrieved | terms URL | original name | modified |
|----------|--------------------|------------|----------------|-----------|---------------|----------|
| _(none)_ | | | | | | |
