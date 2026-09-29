#!/usr/bin/env python3
"""Adapte le binaire Chromium (Chrome-for-Testing) pour qu'il accepte une
bibliotheque NSS plus ancienne (celle du paquet npm @achingbrain/nss).

Deux retouches minimales dans les tables dynamiques :
  1. Le seul symbole absent des anciennes NSS (PK11_HasAttributeSet@NSS_3.30)
     est redirige vers PK11_FindCertInSlot : on reutilise l'offset de chaine de
     ce dernier (aucun octet de .dynstr n'est touche) et on copie sa version.
  2. Le nom de version "NSS_3.30" exige par le binaire n'existe pas dans les
     anciennes NSS : le champ vna_name correspondant est redirige vers
     "NSS_3.2" (nom de version present des deux cotes).

Le symbole redirige n'est jamais appele pour un rendu local HTML -> PDF.
"""
import shutil
import struct
import sys

from elftools.elf.elffile import ELFFile

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/chromium"
DST = sys.argv[2] if len(sys.argv) > 2 else "/tmp/chromium-patched"

MISSING_SYM = "PK11_HasAttributeSet"   # @NSS_3.30, absent des vieilles NSS
FALLBACK_SYM = "PK11_FindCertInSlot"   # @NSS_3.2, present partout
OLD_VERSION_NAME = "NSS_3.30"
NEW_VERSION_NAME = "NSS_3.2"

shutil.copy2(SRC, DST)
with open(DST, "r+b") as fh:
    elf = ELFFile(fh)
    dynstr = elf.get_section_by_name(".dynstr")
    dynsym = elf.get_section_by_name(".dynsym")
    versym = elf.get_section_by_name(".gnu.version")
    verneed = elf.get_section_by_name(".gnu.version_r")

    strtab = dynstr.data()

    def str_at(off):
        return strtab[off:strtab.index(b"\0", off)].decode()

    symbols = {}
    for i, sym in enumerate(dynsym.iter_symbols()):
        symbols.setdefault(sym.name, i)

    missing_idx = symbols[MISSING_SYM]
    fallback_idx = symbols[FALLBACK_SYM]
    print(f"symbole redirige      : {MISSING_SYM} (#{missing_idx})")
    print(f"symbole de remplacement: {FALLBACK_SYM} (#{fallback_idx})")

    # --- 1. reutiliser l'offset de chaine du symbole de remplacement ---
    sym_ent = dynsym["sh_entsize"]
    fallback_name_off = dynsym.get_symbol(fallback_idx).entry.st_name
    fh.seek(dynsym["sh_offset"] + missing_idx * sym_ent)
    fh.write(struct.pack("<I", fallback_name_off))
    print("  -> nom du symbole reecrit (offset reutilise, .dynstr intact)")

    # --- 2. copier la version (versym) du symbole de remplacement ---
    ver_off = versym["sh_offset"]
    fh.seek(ver_off + fallback_idx * 2)
    (fallback_ver,) = struct.unpack("<H", fh.read(2))
    fh.seek(ver_off + missing_idx * 2)
    fh.write(struct.pack("<H", fallback_ver))
    print(f"  -> versym[{missing_idx}] = {fallback_ver}")

    def elf_hash(name):
        """Hash ELF standard (celui des versions symboliques)."""
        h = 0
        for byte in name.encode():
            h = (h << 4) + byte
            g = h & 0xF0000000
            if g:
                h ^= g >> 24
            h &= ~g & 0xFFFFFFFF
        return h

    # --- 3. rediriger le nom de version NSS_3.30 vers NSS_3.2 ---
    new_name_off = strtab.index(NEW_VERSION_NAME.encode() + b"\0")
    old_name_off = strtab.index(OLD_VERSION_NAME.encode() + b"\0")

    raw = verneed.data()
    vn_off = 0
    patched = 0
    while vn_off < len(raw):
        vn_version, vn_cnt, vn_file, vn_aux, vn_next = struct.unpack_from("<HHIII", raw, vn_off)
        aux_off = vn_off + vn_aux
        for _ in range(vn_cnt):
            vna_hash, vna_flags, vna_other, vna_name, vna_next = struct.unpack_from("<IHHII", raw, aux_off)
            if vna_name == old_name_off:
                # champs vna_name (offset +8) et vna_hash (offset +0) :
                # glibc compare les deux avec la definition de version.
                fh.seek(verneed["sh_offset"] + aux_off)
                fh.write(struct.pack("<I", elf_hash(NEW_VERSION_NAME)))
                fh.seek(verneed["sh_offset"] + aux_off + 8)
                fh.write(struct.pack("<I", new_name_off))
                patched += 1
                print(f"  -> verneed '{str_at(vn_file)}' : {OLD_VERSION_NAME} -> {NEW_VERSION_NAME}"
                      f" (hash 0x{elf_hash(NEW_VERSION_NAME):08x})")
            aux_off += vna_next
            if vna_next == 0:
                break
        if vn_next == 0:
            break
        vn_off += vn_next
    if not patched:
        print("  !! aucune entree de version a rediriger (deja patche ?)")

print("OK :", DST)
