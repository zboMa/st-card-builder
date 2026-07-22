#!/usr/bin/env python3
"""Astro 批次 G：剩余 CSS + GsapAnimations / AiEngineModal script 外提"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

CSS_SPLITS = [
    ('src/components/CardManagerPanel.astro', 'src/styles/card-manager-panel.css', '../styles/card-manager-panel.css'),
    ('src/components/SecurityCordon.astro', 'src/styles/security-cordon.css', '../styles/security-cordon.css'),
    ('src/components/ChatPlayground.astro', 'src/styles/chat-playground.css', '../styles/chat-playground.css'),
    ('src/components/PromptConfigPanel.astro', 'src/styles/prompt-config-panel.css', '../styles/prompt-config-panel.css'),
    ('src/components/AiEngineModal.astro', 'src/styles/ai-engine-modal.css', '../styles/ai-engine-modal.css'),
]

SCRIPT_SPLITS = [
    {
        'astro': 'src/components/GsapAnimations.astro',
        'boot': 'src/lib/layout/gsapAnimationsBoot.mjs',
        'fn': 'initGsapAnimations',
        'doc': 'GSAP 面板入场与视图切换（从 GsapAnimations.astro 外提）',
        'inline': True,
        'import_path': '../lib/layout/gsapAnimationsBoot.mjs',
    },
    {
        'astro': 'src/components/AiEngineModal.astro',
        'boot': 'src/lib/aiConfig/aiEngineModalBoot.mjs',
        'fn': 'initAiEngineModal',
        'doc': 'AI 引擎弹窗 boot（从 AiEngineModal.astro 外提）',
        'inline': True,
        'import_path': '../lib/aiConfig/aiEngineModalBoot.mjs',
    },
]


def extract_css(astro_rel, css_rel, href):
    astro_path = ROOT / astro_rel
    css_path = ROOT / css_rel
    content = astro_path.read_text(encoding='utf-8')
    m = re.search(r'<style([^>]*)>([\s\S]*?)</style>', content)
    if not m:
        raise ValueError('no style block: ' + astro_rel)
    css_body = m.group(2).strip('\n') + '\n'
    css_path.parent.mkdir(parents=True, exist_ok=True)
    css_path.write_text(css_body, encoding='utf-8')
    replacement = f'<link rel="stylesheet" href="{href}" />'
    new_content = content[:m.start()] + replacement + content[m.end():]
    astro_path.write_text(new_content, encoding='utf-8')
    print(f'  css: {astro_rel} -> {css_rel}')


def unwrap_iife(body: str):
    imports = []
    rest_lines = []
    in_import = False
    for line in body.splitlines(keepends=True):
        stripped = line.strip()
        if stripped.startswith('import ') or in_import:
            imports.append(line)
            if ';' in line:
                in_import = False
            elif stripped.startswith('import '):
                in_import = True
            continue
        rest_lines.append(line)
    rest = ''.join(rest_lines).strip('\n')
    m = re.match(r'^\(function\s*\(\s*\)\s*\{([\s\S]*)\}\s*\)\(\s*\)\s*;?\s*$', rest)
    if m:
        return ''.join(imports), m.group(1).strip('\n')
    m2 = re.match(r'^\(function\s*\(\s*\)\s*\{([\s\S]*)\}\s*\)\(\s*\)\s*;?\s*$', rest.strip())
    if m2:
        return ''.join(imports), m2.group(1).strip('\n')
    return ''.join(imports), rest


def find_main_script(content: str):
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
        raise ValueError('no script block')
    return best


def extract_script(spec):
    astro_path = ROOT / spec['astro']
    boot_path = ROOT / spec['boot']
    boot_path.parent.mkdir(parents=True, exist_ok=True)
    content = astro_path.read_text(encoding='utf-8')
    start, end, _attrs, body = find_main_script(content)
    imports, inner = unwrap_iife(body)
    boot = f'''/**
 * {spec['doc']}
 */
{imports}
export function {spec['fn']}() {{
{inner}
}}
'''
    boot_path.write_text(boot, encoding='utf-8')
    imp = spec['import_path']
    thin = f'''<script>
  import {{ {spec['fn']} }} from '{imp}';
  {spec['fn']}();
</script>'''
    astro_path.write_text(content[:start] + thin + content[end:], encoding='utf-8')
    print(f"  script: {spec['astro']} -> {spec['boot']}")


if __name__ == '__main__':
    print('CSS splits:')
    for astro, css, href in CSS_SPLITS:
        extract_css(astro, css, href)
    print('Script splits:')
    for spec in SCRIPT_SPLITS:
        extract_script(spec)
    print('batch G done')
