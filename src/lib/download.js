// Browser file download, extracted from Export.jsx so the guide route can reuse
// it without importing the export page.

export function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Slug from the dataset name, falling back to a generic stem.
export const slugify = (name, fallback) =>
  (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;

export const guideFilename = (record) =>
  `${slugify(record?.dataset?.name, 'dataset')}-collection-guide.md`;
