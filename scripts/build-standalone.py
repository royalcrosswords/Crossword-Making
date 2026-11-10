from html import escape as escape_html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / "index.html").read_text(encoding="utf-8")
css = (ROOT / "styles.css").read_text(encoding="utf-8")
model = (ROOT / "src" / "model.js").read_text(encoding="utf-8")
autofill = (ROOT / "src" / "autofill.js").read_text(encoding="utf-8")
export_formats = (ROOT / "src" / "export-formats.js").read_text(encoding="utf-8")
jspdf = (ROOT / "vendor" / "jspdf.umd.min.js").read_text(encoding="utf-8")
jspdf_autotable = (ROOT / "vendor" / "jspdf.plugin.autotable.min.js").read_text(encoding="utf-8")
pdf_export = (ROOT / "src" / "pdf-export.js").read_text(encoding="utf-8")
default_words = (ROOT / "src" / "default-words.js").read_text(encoding="utf-8")
british_word_priority = (ROOT / "src" / "british-word-priority.js").read_text(encoding="utf-8")
app = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
phil_license = (ROOT / "LICENSE-APACHE-2.0-Phil.txt").read_text(encoding="utf-8")
jspdf_license = (ROOT / "vendor" / "LICENSE-jspdf.txt").read_text(encoding="utf-8")
autotable_license = (ROOT / "vendor" / "LICENSE-jspdf-autotable.txt").read_text(encoding="utf-8")

html = html.replace('  <link rel="icon" href="assets/gridwright.svg" type="image/svg+xml">\n', "")
html = html.replace('  <link rel="stylesheet" href="styles.css">', f"  <style>\n{css}\n  </style>")
for link_id, href, label, license_id, license_text in (
    ("philLicenseLink", "LICENSE-APACHE-2.0-Phil.txt", "View license", "philLicenseText", phil_license),
    ("jspdfLicenseLink", "vendor/LICENSE-jspdf.txt", "View license", "jspdfLicenseText", jspdf_license),
    ("autotableLicenseLink", "vendor/LICENSE-jspdf-autotable.txt", "View license", "autotableLicenseText", autotable_license),
):
    link = f'<a id="{link_id}" href="{href}">{label}</a>'
    html = html.replace(link, f'<span>{label} (text below)</span>')
    placeholder = f'<pre id="{license_id}">'
    start = html.find(placeholder)
    if start >= 0:
        end = html.find("</pre>", start)
        html = html[:start] + f'<pre id="{license_id}">{escape_html(license_text, quote=False)}</pre>' + html[end + len("</pre>"):]
for script in (
    '  <script src="src/model.js" defer></script>\n',
    '  <script src="src/autofill.js" defer></script>\n',
    '  <script src="src/export-formats.js" defer></script>\n',
    '  <script src="vendor/jspdf.umd.min.js" defer></script>\n',
    '  <script src="vendor/jspdf.plugin.autotable.min.js" defer></script>\n',
    '  <script src="src/pdf-export.js" defer></script>\n',
    '  <script src="src/default-words.js" defer></script>\n',
    '  <script src="src/british-word-priority.js" defer></script>\n',
    '  <script src="src/app.js" defer></script>\n',
):
    html = html.replace(script, "")
inline_scripts = (
    f"\n<script>\n{model}\n</script>\n"
    f"<script>\n{autofill}\n</script>\n"
    f"<script>\n{export_formats}\n</script>\n"
    f"<script>\n{jspdf}\n</script>\n"
    f"<script>\n{jspdf_autotable}\n</script>\n"
    f"<script>\n{pdf_export}\n</script>\n"
    f"<script>\n{default_words}\n</script>\n"
    f"<script>\n{british_word_priority}\n</script>\n"
    f"<script>\n{app}\n</script>\n"
)
html = html.replace("</body>", f"{inline_scripts}</body>")

output = ROOT / "Gridwright-US-UK-Crossword.html"
output.write_text(html, encoding="utf-8")
print(f"Wrote {output} ({output.stat().st_size:,} bytes)")
