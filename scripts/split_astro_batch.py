#!/usr/bin/env python3
"""Astro 巨石：内联 script 外提至 boot .mjs"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

SPLITS = [
    {
        'astro': 'src/components/StatusBarPanel.astro',
        'boot': 'src/lib/statusBar/panelBoot.mjs',
        'fn': 'initStatusBarPanel',
        'doc': '状态栏面板 boot（从 StatusBarPanel.astro 外提）',
    },
    {
        'astro': 'src/components/AIPanel.astro',
        'boot': 'src/lib/aiConfig/panelBoot.mjs',
        'fn': 'initAiConfigPanel',
        'doc': 'AI 配置面板 boot（从 AIPanel.astro 外提）',
        'inline': True,
    },
    {
        'astro': 'src/components/ChatPlayground.astro',
        'boot': 'src/lib/chatRuntime/playgroundBoot.mjs',
        'fn': 'initChatPlayground',
        'doc': '试聊 playground boot（从 ChatPlayground.astro 外提）',
    },
    {
        'astro': 'src/components/AccountSyncPanel.astro',
        'boot': 'src/lib/sync/accountSyncPanelBoot.mjs',
        'fn': 'initAccountSyncPanel',
        'doc': '账户/云同步面板 boot（从 AccountSyncPanel.astro 外提）',
    },
    {
        'astro': 'src/components/RegexPanel.astro',
        'boot': 'src/lib/regexPanelBoot.mjs',
        'fn': 'initRegexPanel',
        'doc': '正则面板 boot（从 RegexPanel.astro 外提）',
    },
    {
        'astro': 'src/components/TavernScriptsPanel.astro',
        'boot': 'src/lib/tavernPanelBoot.mjs',
        'fn': 'initTavernScriptsPanel',
        'doc': '酒馆脚本面板 boot（从 TavernScriptsPanel.astro 外提）',
    },
    {
        'astro': 'src/components/CardManagerPanel.astro',
        'boot': 'src/lib/card-builder/cardManagerPanelBoot.mjs',
        'fn': 'initCardManagerPanelImport',
        'doc': '卡管理面板：JSON/PNG 导入 boot（从 CardManagerPanel.astro 外提）',
        'inline': True,
    },
    {
        'astro': 'src/components/WorldbookAuditor.astro',
        'boot': 'src/lib/card-builder/worldbookAuditorBoot.mjs',
        'fn': 'initWorldbookAuditor',
        'doc': '世界书审计面板 boot（从 WorldbookAuditor.astro 外提）',
        'inline': True,
    },
    {
        'astro': 'src/components/PromptConfigPanel.astro',
        'boot': 'src/lib/promptConfigPanelBoot.mjs',
        'fn': 'initPromptConfigPanel',
        'doc': '提示词配置面板 boot（从 PromptConfigPanel.astro 外提）',
        'inline': True,
    },
    {
        'astro': 'src/components/SecurityCordon.astro',
        'boot': 'src/lib/securityCordonBoot.mjs',
        'fn': 'initSecurityCordon',
        'doc': 'SecurityCordon boot（从 SecurityCordon.astro 外提）',
        'inline': True,
    },
    {
        'astro': 'src/components/CharacterPanel.astro',
        'boot': 'src/lib/card-builder/characterPanelBoot.mjs',
        'fn': 'initCharacterPanel',
        'doc': '角色设定面板 boot（从 CharacterPanel.astro 外提）',
    },
    {
        'astro': 'src/components/PreviewPanel.astro',
        'boot': 'src/lib/card-builder/previewPanelBoot.mjs',
        'fn': 'initPreviewPanel',
        'doc': '预览面板 boot（从 PreviewPanel.astro 外提）',
        'inline': True,
    },
]

CSS_SPLITS = [
    {
        'astro': 'src/components/VariableCardPanel.astro',
        'css': 'src/styles/variable-card-panel.css',
    },
    {
        'astro': 'src/components/AssistantPanel.astro',
        'css': 'src/styles/assistant-panel.css',
    },
    {
        'astro': 'src/components/novel/NovelWorkshopStyles.astro',
        'css': 'src/styles/novel-workshop.css',
    },
    {
        'astro': 'src/components/storyStudio/StoryStudioStyles.astro',
        'css': 'src/styles/story-studio.css',
    },
]


def find_main_script(content: str):
    """Return (start, end, attrs, body) of largest script block (skip define:vars-only)."""
    best = None
    for m in re.finditer(r'<script([^>]*)>([\s\S]*?)</script>', content):
        attrs = m.group(1)
        body = m.group(2)
        if 'define:vars' in attrs and len(body.strip()) < 80:
            continue
        if len(body.strip()) < 50:
            continue
        if best is None or len(body) > len(best[3]):
            best = (m.start(), m.end(), attrs, body)
    if not best:
        raise ValueError('no script block found')
    return best


def unwrap_iife(body: str) -> str:
    b = body.strip('\n')
    # strip leading imports for separate handling
    imports = []
    rest_lines = []
    in_import = False
    for line in b.splitlines(keepends=True):
        stripped = line.strip()
        if stripped.startswith('import ') or in_import:
            imports.append(line)
            if ';' in line or (stripped.endswith("';") or stripped.endswith('";')):
                in_import = False
            elif stripped.startswith('import '):
                in_import = True
            continue
        rest_lines.append(line)
    rest = ''.join(rest_lines).strip('\n')

    # (function() { ... })();  or (function(){ ... })();
    m = re.match(r'^\(function\s*\(\s*\)\s*\{([\s\S]*)\}\s*\)\(\s*\)\s*;?\s*$', rest)
    if m:
        inner = m.group(1).strip('\n')
        return ''.join(imports), inner

    # async IIFE at end only - leave as-is inside export fn
    return ''.join(imports), rest


def rel_import(from_boot: Path, astro_path: Path) -> str:
    boot_dir = from_boot.parent
    # astro is under src/components/ — compute path from boot to boot... 
    target = ROOT / from_boot
    return './' + from_boot.as_posix().split('src/lib/')[-1]


def boot_import_path(astro_path: str, boot_path: str) -> str:
    astro = Path(astro_path)
    boot = Path(boot_path)
    # from src/components/foo.astro -> ../lib/...
    if 'components/novel/' in astro_path:
        prefix = '../../lib/'
    elif 'components/storyStudio/' in astro_path:
        prefix = '../../lib/'
    elif 'components/' in astro_path:
        prefix = '../lib/'
    else:
        prefix = '../lib/'
    return prefix + boot.as_posix().split('src/lib/')[-1]


def extract_script_split(spec):
    astro_path = ROOT / spec['astro']
    boot_path = ROOT / spec['boot']
    boot_path.parent.mkdir(parents=True, exist_ok=True)

    content = astro_path.read_text(encoding='utf-8')
    start, end, attrs, body = find_main_script(content)

    imports, inner = unwrap_iife(body)

    # fix relative imports: ../lib/ -> correct from new boot location
    boot_rel = boot_path.relative_to(ROOT / 'src/lib')
    depth = len(boot_rel.parts) - 1
    prefix = '../' * depth if depth else './'

    fixed_imports = []
    for line in imports.splitlines(keepends=True):
        m = re.match(r"(\s*import\s+[\s\S]*?\s+from\s+['\"])(\.\./lib/[^'\"]+)(['\"]\s*;?\s*)", line)
        if m:
            rest = m.group(2).replace('../lib/', '')
            fixed_imports.append(m.group(1) + prefix + rest + m.group(3))
        else:
            fixed_imports.append(line)
    imports = ''.join(fixed_imports)

    boot = f'''/**
 * {spec['doc']}
 */
{imports}
export function {spec['fn']}() {{
{inner}
}}
'''
    boot_path.write_text(boot, encoding='utf-8')

    imp = boot_import_path(spec['astro'], spec['boot'])
    thin_script = f'''<script>
  import {{ {spec['fn']} }} from '{imp}';
  {spec['fn']}();
</script>'''

    new_content = content[:start] + thin_script + content[end:]
    astro_path.write_text(new_content, encoding='utf-8')
    print(f"  script: {spec['astro']} -> {spec['boot']} ({len(inner.splitlines())} lines)")


def extract_css_split(spec):
    astro_path = ROOT / spec['astro']
    css_path = ROOT / spec['css']
    content = astro_path.read_text(encoding='utf-8')
    m = re.search(r'<style([^>]*)>([\s\S]*?)</style>', content)
    if not m:
        print(f"  skip css (no style): {spec['astro']}")
        return
    attrs = m.group(1)
    css_body = m.group(2).strip('\n') + '\n'
    css_path.parent.mkdir(parents=True, exist_ok=True)
    css_path.write_text(css_body, encoding='utf-8')

    # link from astro - use relative path from component to styles
    if 'components/novel/' in spec['astro']:
        href = '../../styles/' + css_path.name
    elif 'components/storyStudio/' in spec['astro']:
        href = '../../styles/' + css_path.name
    else:
        href = '../styles/' + css_path.name

    if 'components/novel/' in spec['astro'] or 'components/storyStudio/' in spec['astro']:
        # style-only astro files: replace entire content
        front = content.split('<style', 1)[0]
        new_content = front.rstrip() + '\n<link rel="stylesheet" href="' + href + '" />\n'
    else:
        replacement = f'<link rel="stylesheet" href="{href}" />'
        new_content = content[:m.start()] + replacement + content[m.end():]

    astro_path.write_text(new_content, encoding='utf-8')
    print(f"  css: {spec['astro']} -> {spec['css']}")


if __name__ == '__main__':
    print('Astro script splits:')
    for spec in SPLITS:
        try:
            extract_script_split(spec)
        except Exception as e:
            print(f"  FAIL {spec['astro']}: {e}")

    print('Astro CSS splits:')
    for spec in CSS_SPLITS:
        try:
            extract_css_split(spec)
        except Exception as e:
            print(f"  FAIL css {spec['astro']}: {e}")

    print('done')
