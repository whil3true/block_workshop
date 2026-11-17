"""Release-package contract tests; these fixtures are never included in dist."""
import importlib.util
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import warnings
import zipfile

spec = importlib.util.spec_from_file_location('validator', Path(__file__).with_name('check-yandex-build.py'))
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class YandexPackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'dist'
        self.root.mkdir()
        self.put('index.html', b'<script type="module" src="./assets/app.js"></script><link href="./assets/app.css">')
        self.put('assets/app.js', b'const sdk="/sdk.js"; window.YaGames; import "./chunk.js";')
        self.put('assets/chunk.js', b'export const value=1;')
        self.put('assets/app.css', b'@font-face{src:url(../fonts/font.woff2)}')
        self.put('fonts/font.woff2', b'font')
        self.put('assets/cozy-mosaic/tile.png', b'PNG')
        self.put('assets/cozy-mosaic/asset-manifest.json', json.dumps({'assets': [
            {'path': 'public/assets/cozy-mosaic/tile.png', 'sha256': hashlib.sha256(b'PNG').hexdigest()}
        ]}).encode())
        for sound in validator.AUDIO:
            self.put(f'audio/{sound}.wav', b'RIFF\x00\x00\x00\x00WAVE')

    def put(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    def archive(self, extras=()):
        target = Path(self.temp.name) / 'artifact.zip'
        with warnings.catch_warnings(), zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
            warnings.simplefilter('ignore', UserWarning)
            for path in sorted(self.root.rglob('*')):
                if path.is_file():
                    archive.write(path, path.relative_to(self.root).as_posix())
            for name, content in extras:
                archive.writestr(name, content)
        return target

    def test_real_artifact_shape_has_root_index_and_identical_production_bytes(self):
        report = validator.validate(self.archive(), self.root)
        self.assertEqual(report['rootEntry'], 'index.html')
        self.assertTrue(report['matchesProduction'])
        self.assertFalse(report['nestedZip'])
        self.assertNotIn('dist', report['topLevel'])

    def test_directory_validation(self):
        self.assertEqual(validator.validate(self.root)['result'], 'PASS')

    def test_missing_root_index(self):
        (self.root / 'index.html').unlink()
        with self.assertRaisesRegex(ValueError, 'index.html'):
            validator.validate(self.archive())

    def test_extra_dist_wrapper(self):
        with self.assertRaisesRegex(ValueError, 'dist wrapper'):
            validator.validate(self.archive([('dist/index.html', b'bad')]))

    def test_no_nested_zip(self):
        with self.assertRaisesRegex(ValueError, 'nested ZIP'):
            validator.validate(self.archive([('game.zip', b'PK')]))

    def test_development_paths_and_nonportable_names(self):
        for name in ['src/main.ts', 'tests/test.js', 'node_modules/module.js', '.git/config',
                     'package.json', 'assets/source.js.map', 'file name.png', 'assets/цветок.png']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                validator.validate(self.archive([(name, b'bad')]))

    def test_unsafe_zip_paths(self):
        for name in ['../outside.js', '/absolute.js', 'assets/../escape.js', 'C:\\game.js']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                validator.validate(self.archive([(name, b'bad')]))

    def test_duplicate_entries(self):
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            validator.validate(self.archive([('index.html', b'duplicate')]))

    def test_case_collisions(self):
        with self.assertRaisesRegex(ValueError, 'Case-colliding'):
            validator.validate(self.archive([('INDEX.html', b'case')]))

    def test_unpacked_size_not_compressed_zip_size(self):
        with patch.object(validator, 'MAX_BYTES', 1000), self.assertRaisesRegex(ValueError, '100 MB'):
            validator.validate(self.archive([('assets/large.bin', b'0' * 2000)]))

    def test_missing_html_entry_asset(self):
        (self.root / 'assets/app.js').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing local resource'):
            validator.validate(self.root)

    def test_missing_javascript_import(self):
        (self.root / 'assets/chunk.js').unlink()
        with self.assertRaisesRegex(ValueError, 'chunk.js'):
            validator.validate(self.root)

    def test_missing_css_font(self):
        (self.root / 'fonts/font.woff2').unlink()
        with self.assertRaisesRegex(ValueError, 'font.woff2'):
            validator.validate(self.root)

    def test_missing_dynamic_audio(self):
        (self.root / 'audio/place.wav').unlink()
        with self.assertRaisesRegex(ValueError, 'place.wav'):
            validator.validate(self.root)

    def test_missing_or_changed_raster(self):
        self.put('assets/cozy-mosaic/tile.png', b'changed')
        with self.assertRaisesRegex(ValueError, 'hash mismatch'):
            validator.validate(self.root)
        (self.root / 'assets/cozy-mosaic/tile.png').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing local resource'):
            validator.validate(self.root)

    def test_sdk_not_bundled_or_replaced(self):
        with self.assertRaisesRegex(ValueError, 'local sdk.js'):
            validator.validate(self.archive([('sdk.js', b'local stub')]))
        self.put('assets/app.js', b'window.YaGames;')
        with self.assertRaisesRegex(ValueError, 'SDK bootstrap'):
            validator.validate(self.root)

    def test_root_relative_assets_cannot_break_pages_subpaths(self):
        self.put('assets/app.css', b'@font-face{src:url(/fonts/font.woff2)}')
        with self.assertRaisesRegex(ValueError, 'Root-relative asset'):
            validator.validate(self.root)

    def test_empty_index_is_not_a_hostable_game(self):
        self.put('index.html', b'')
        with self.assertRaisesRegex(ValueError, 'JavaScript entry'):
            validator.validate(self.root)

    def test_zip_symlink(self):
        info = zipfile.ZipInfo('assets/link')
        info.create_system = 3
        info.external_attr = 0o120777 << 16
        with self.assertRaisesRegex(ValueError, 'symlink'):
            validator.validate(self.archive([(info, b'../outside')]))

    def test_directory_symlink(self):
        (self.root / 'assets/link').symlink_to(self.root / 'index.html')
        with self.assertRaisesRegex(ValueError, 'Symlink'):
            validator.validate(self.root)

    def test_actual_zip_must_match_the_tested_dist(self):
        archive = self.archive()
        self.put('fonts/font.woff2', b'another font')
        with self.assertRaisesRegex(ValueError, 'ZIP bytes differ'):
            validator.validate(archive, self.root)


if __name__ == '__main__':
    unittest.main()
