#!/usr/bin/env python3
"""Validate a production tree or the actual GitHub artifact ZIP (stdlib only)."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import posixpath
import re
import stat
import sys
from urllib.parse import unquote, urlsplit
import zipfile

MAX_BYTES = 100_000_000  # Conservative decimal 100 MB, unpacked.
ASSET_HASHES = json.loads((Path(__file__).resolve().parents[1] / 'docs/assets.sha256.json').read_text())
AUDIO = {path: digest for path, digest in ASSET_HASHES.items() if path.startswith('audio/')}
AUDIO_SUFFIXES = {'.ogg', '.oga', '.wav', '.mp3', '.m4a', '.flac', '.aac', '.opus', '.weba'}
BAD_DIRS = {'src', 'test', 'tests', 'node_modules', 'scripts', 'test-results', 'blob-report', 'coverage'}
BAD_SUFFIXES = {'.ts', '.tsx', '.mts', '.cts', '.map', '.py', '.sh', '.bat', '.ps1', '.md', '.yaml', '.yml', '.zip', '.lock'}
ASSET_LITERAL = re.compile(r'''["'`]((?:\./|/)?(?:public/)?(?:assets|audio|fonts)/[^"'`\s${}]+\.[a-zA-Z0-9]+(?:[?#][^"'`\s${}]*)?)["'`]''')
IMPORTS = re.compile(r'''\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']''')
URL_LITERAL = re.compile(r'''new\s+URL\(\s*["']([^"']+)["']\s*,\s*(import\.meta\.url|document\.baseURI)''')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def valid_name(name):
    require(bool(re.fullmatch(r'[A-Za-z0-9_.\-/]+', name)), f'Non-portable path: {name!r}')
    parts = name.split('/')
    require(all(p and p not in {'.', '..'} and not p.startswith('.') for p in parts), f'Unsafe/hidden path: {name}')
    require(parts[0].lower() != 'dist', f'Extra dist wrapper: {name}')
    require(not any(p.lower() in BAD_DIRS for p in parts), f'Development directory: {name}')
    base = parts[-1].lower()
    require(Path(base).suffix not in BAD_SUFFIXES, f'Source/development or nested ZIP file: {name}')
    require(base != 'sdk.js', 'Do not ship a local sdk.js; Yandex supplies /sdk.js')
    require(not re.match(r'(?:package(?:-lock)?\.json|npm-shrinkwrap\.json|(?:tsconfig|vite\.config|vitest\.config|playwright\.config)(?:\.|$)|(?:yarn|pnpm|bun)[.-].*lock)', base), f'Development config: {name}')


def inventory(source):
    """Check metadata/size before reading or decompressing any payload."""
    source = Path(source)
    if source.is_dir():
        entries = []
        for path in sorted(source.rglob('*')):
            require(not path.is_symlink(), f'Symlink: {path}')
            if path.is_file():
                entries.append((path.relative_to(source).as_posix(), path.stat().st_size, path))
        archive = None
    else:
        require(source.is_file() and zipfile.is_zipfile(source), f'Not a directory or ZIP: {source}')
        archive = zipfile.ZipFile(source)
        entries = []
        for info in archive.infolist():
            require(not stat.S_ISLNK(info.external_attr >> 16), f'ZIP symlink: {info.filename}')
            require(not info.flag_bits & 1, f'Encrypted ZIP entry: {info.filename}')
            if info.is_dir():
                valid_name(info.filename.rstrip('/'))
            else:
                entries.append((info.filename, info.file_size, info))
    try:
        names = [name for name, _, _ in entries]
        require(names and len(names) == len(set(names)), 'Empty archive/tree or duplicate ZIP entries')
        require(len(names) == len({name.lower() for name in names}), 'Case-colliding paths')
        for name in names:
            valid_name(name)
        require('index.html' in names, 'index.html must be at the ZIP root, without a dist/ wrapper')
        require(sum(size for _, size, _ in entries) <= MAX_BYTES, 'Unpacked build exceeds 100 MB')
        return {name: archive.read(entry) if archive else entry.read_bytes() for name, _, entry in entries}
    finally:
        if archive:
            archive.close()


class ResourceHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []

    def handle_starttag(self, tag, attrs):
        require(tag != 'base', 'A base element would change relative resource resolution')
        for key, value in attrs:
            if key in {'src', 'href', 'poster'} and value:
                self.references.append(value)
            if key == 'srcset' and value:
                self.references.extend(item.strip().split()[0] for item in value.split(',') if item.strip())


def validate(source, compare=None):
    files = inventory(source)
    checked = set()

    def local(reference, owner, document_relative=False):
        if reference.startswith(('#', 'data:', 'blob:')):
            return
        url = urlsplit(reference)
        require(not url.scheme and not url.netloc, f'Remote initial/module resource: {owner}: {reference}')
        path = unquote(url.path)
        if path == '/sdk.js':
            return  # Virtual official endpoint supplied by Yandex, never bundled.
        require(not path.startswith('/'), f'Root-relative asset breaks Pages/subpath portability: {owner}: {reference}')
        if path.startswith('public/'):
            path = path.removeprefix('public/')
            document_relative = True
        target = posixpath.normpath(posixpath.join('' if document_relative else posixpath.dirname(owner), path))
        require(target in files, f'Missing local resource: {owner}: {reference} -> {target}')
        checked.add((owner, target))

    combined_js = ''
    entry_scripts = []
    for name, data in files.items():
        suffix = Path(name).suffix.lower()
        if suffix not in {'.html', '.css', '.js', '.mjs', '.json'}:
            continue
        text = data.decode('utf-8')
        require('sdk.games.s3.yandex.net' not in text, f'Use the official /sdk.js portal path: {name}')
        if suffix == '.html':
            parser = ResourceHTML()
            parser.feed(text)
            for reference in parser.references:
                local(reference, name)
            if name == 'index.html':
                entry_scripts = re.findall(r'''<script\b[^>]*\bsrc=["']([^"']+)["']''', text, re.I)
        elif suffix == '.css':
            for match in re.finditer(r'''url\(\s*["']?([^\s)"']+)["']?\s*\)|@import\s+["']([^"']+)["']''', text):
                local(next(v for v in match.groups() if v is not None), name)
        elif suffix in {'.js', '.mjs'}:
            combined_js += text
            for match in IMPORTS.finditer(text):
                local(next(v for v in match.groups() if v is not None), name)
            for match in URL_LITERAL.finditer(text):
                local(match[1], name, match[2] == 'document.baseURI')
            # Vite's public assets and the embedded raster catalog use document-base paths.
            for match in ASSET_LITERAL.finditer(text):
                local(match[1], name, True)
    require(entry_scripts, 'index.html does not load the production JavaScript entry')
    require(re.search(r'''["']/sdk\.js["']''', combined_js) and 'YaGames' in combined_js, 'Official SDK bootstrap /sdk.js is missing from the compiled JavaScript')
    # These project audio URLs are assembled dynamically by the runtime.
    for path, digest in AUDIO.items():
        local(path, 'index.html', True)
        require(files[path].startswith(b'OggS'), f'Invalid OGG: {path}')
        require(hashlib.sha256(files[path]).hexdigest() == digest, f'Audio asset hash mismatch: {path}')
    extra_audio = sorted(path for path in files if path not in AUDIO and
                         (path.startswith('audio/') or Path(path).suffix.lower() in AUDIO_SUFFIXES))
    require(not extra_audio, f'Unexpected audio: {", ".join(extra_audio)}')

    manifest_name = 'assets/cozy-mosaic/asset-manifest.json'
    require(manifest_name in files, 'Production raster manifest is missing')
    manifest = json.loads(files[manifest_name])
    for asset in manifest['assets']:
        path = asset['path'].removeprefix('public/')
        local(path, manifest_name, True)
        require(hashlib.sha256(files[path]).hexdigest() == asset['sha256'], f'Raster asset hash mismatch: {path}')

    if compare is not None:
        expected = inventory(compare)
        require(files.keys() == expected.keys(), 'ZIP inventory differs from production-dist')
        require(all(data == expected[name] for name, data in files.items()), 'ZIP bytes differ from production-dist')
    digest = hashlib.sha256()
    for name in sorted(files):
        digest.update(name.encode())
        digest.update(files[name])
    report = {
        'result': 'PASS', 'rootEntry': 'index.html', 'files': len(files),
        'unpackedBytes': sum(map(len, files.values())), 'limitBytes': MAX_BYTES,
        'topLevel': sorted({name.split('/')[0] for name in files}),
        'localReferences': len(checked), 'rasterAssets': len(manifest['assets']),
        'sdkPath': '/sdk.js (provided by Yandex, not bundled)',
        'nestedZip': False, 'matchesProduction': compare is not None,
        'treeSha256': digest.hexdigest(),
    }
    if Path(source).is_file():
        report['zipSha256'] = hashlib.sha256(Path(source).read_bytes()).hexdigest()
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', help='Production directory or actual downloaded artifact ZIP')
    parser.add_argument('--compare', help='Require the same paths and bytes as this production directory')
    parser.add_argument('--report', help='JSON result outside dist; never include it in the upload artifact')
    args = parser.parse_args()
    report = validate(args.source, args.compare)
    result = json.dumps(report, indent=2)
    print(result)
    if args.report:
        Path(args.report).write_text(result + '\n', encoding='utf-8')
    if os.environ.get('GITHUB_STEP_SUMMARY') and 'zipSha256' in report:
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as summary:
            summary.write('## Yandex upload-ready ZIP verified\n\n')
            summary.write(f"[Download yandex-upload-ready.zip]({os.environ['YANDEX_ARTIFACT_URL']})\n\n")
            summary.write(f"Root: `index.html`; files: **{report['files']}**; unpacked: **{report['unpackedBytes']} bytes**.\n\n")
            summary.write('No dist wrapper, nested ZIP, TypeScript, tests, development paths or local SDK stub. All checked local references resolve; archive paths and bytes match the tested production build.\n\n')
            summary.write(f"ZIP SHA-256: `{report['zipSha256']}`\n")


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError, zipfile.BadZipFile) as error:
        print(f'Yandex build validation FAILED: {error}', file=sys.stderr)
        sys.exit(1)
