#!/usr/bin/env python3
"""Assemble boss/src/modele/parts/*.js en un seul module boss/src/boss-modele.js (global BossB7Modele)."""
import os, glob, subprocess, sys

ICI = os.path.dirname(os.path.abspath(__file__))
MODELE = os.path.dirname(ICI)
SRC = os.path.dirname(MODELE)
parts = sorted(glob.glob(os.path.join(MODELE, 'parts', '*.js')))
entete = open(os.path.join(MODELE, 'parts', 'entete.txt'), encoding='utf-8').read()
corps = [open(p, encoding='utf-8').read() for p in parts]
out = entete + "(function (root) {\n  'use strict';\n\n" + '\n'.join(corps) + """
  const api = { version: VERSION, creer: creer, actions: ACTIONS_API.slice(), locomotions: LOCOMOTIONS_API.slice(), clips: Object.keys(CLIPS) };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.BossB7Modele = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
"""
dst = os.path.join(SRC, 'boss-modele.js')
open(dst, 'w', encoding='utf-8').write(out)
r = subprocess.run(['node', '--check', dst], capture_output=True, text=True)
if r.returncode:
    print(r.stderr)
    sys.exit(1)
print(dst, len(out.encode()), 'octets')
