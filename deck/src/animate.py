"""Adds motion to the generated deck:

* Morph transitions (with a Fade fallback) on every slide, so elements named "!!orb" / "!!logo"
  glide and rescale between slides.
* Auto-playing entrance choreography: shapes named "anim-<step>-<effect>-<id>" fade, rise or zoom in,
  step by step, right after the slide transition. No clicking needed while presenting.

Usage: python3 animate.py ../Consentry-pitch.pptx
"""
import re
import sys
import zipfile
from collections import defaultdict

from lxml import etree

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}
NAME_RE = re.compile(r"^anim-(\d+)-(fade|rise|zoom)-")
STEP_MS = 330
STAGGER_MS = 55

MORPH = (
    '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">'
    '<mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159">'
    '<p:transition xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" spd="slow" p14:dur="1400"><p159:morph option="byObject"/></p:transition>'
    "</mc:Choice>"
    '<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback>'
    "</mc:AlternateContent>"
)
FADE = '<p:transition spd="slow"><p:fade/></p:transition>'


class Ids:
    def __init__(self, start=3):
        self.n = start

    def __call__(self):
        self.n += 1
        return self.n


def tgt(spid):
    return f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>'


def visible(ids, spid):
    return (
        f'<p:set><p:cBhvr><p:cTn id="{ids()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>'
        f'{tgt(spid)}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>'
        '<p:to><p:strVal val="visible"/></p:to></p:set>'
    )


def fade(ids, spid, dur):
    return f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{ids()}" dur="{dur}"/>{tgt(spid)}</p:cBhvr></p:animEffect>'


def prop(ids, spid, attr, frm, to, dur, decel=False):
    d = ' decel="100000"' if decel else ""
    return (
        f'<p:anim calcmode="lin" valueType="num"><p:cBhvr><p:cTn id="{ids()}" dur="{dur}"{d} fill="hold"/>{tgt(spid)}'
        f"<p:attrNameLst><p:attrName>{attr}</p:attrName></p:attrNameLst></p:cBhvr>"
        f'<p:tavLst><p:tav tm="0"><p:val><p:strVal val="{frm}"/></p:val></p:tav>'
        f'<p:tav tm="100000"><p:val><p:strVal val="{to}"/></p:val></p:tav></p:tavLst></p:anim>'
    )


def effect(ids, spid, kind, delay, first):
    node = "afterEffect" if first else "withEffect"
    if kind == "fade":
        preset, dur = "10", 650
        body = visible(ids, spid) + fade(ids, spid, dur)
    elif kind == "rise":
        preset, dur = "42", 750
        body = visible(ids, spid) + fade(ids, spid, dur) + prop(ids, spid, "ppt_x", "#ppt_x", "#ppt_x", dur) + prop(ids, spid, "ppt_y", "#ppt_y+.06", "#ppt_y", dur, decel=True)
    else:  # zoom
        preset, dur = "53", 700
        body = visible(ids, spid) + prop(ids, spid, "ppt_w", "0", "#ppt_w", dur, decel=True) + prop(ids, spid, "ppt_h", "0", "#ppt_h", dur, decel=True) + fade(ids, spid, dur)
    sub = ' presetSubtype="16"' if kind == "zoom" else ' presetSubtype="0"'
    return (
        f'<p:par><p:cTn id="{ids()}" presetID="{preset}" presetClass="entr"{sub} fill="hold" grpId="0" nodeType="{node}">'
        f'<p:stCondLst><p:cond delay="{delay}"/></p:stCondLst><p:childTnLst>{body}</p:childTnLst></p:cTn></p:par>'
    )


def build_timing(shapes):
    """shapes: list of (spid, kind, step, is_sp) in document order."""
    steps = defaultdict(list)
    for spid, kind, step, is_sp in shapes:
        steps[step].append((spid, kind, is_sp))
    ids = Ids(3)
    effects = []
    first = True
    for i, step in enumerate(sorted(steps)):
        base = 250 + i * STEP_MS
        for j, (spid, kind, _) in enumerate(steps[step]):
            effects.append(effect(ids, spid, kind, base + j * STAGGER_MS, first))
            first = False
    bld = "".join(f'<p:bldP spid="{spid}" grpId="0" animBg="1"/>' for spid, _, _, is_sp in shapes if is_sp)
    return (
        '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
        '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
        '<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>'
        f'<p:par><p:cTn id="{ids()}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
        + "".join(effects)
        + "</p:childTnLst></p:cTn></p:par>"
        "</p:childTnLst></p:cTn></p:par>"
        "</p:childTnLst></p:cTn>"
        '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
        '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>'
        "</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>"
        + (f"<p:bldLst>{bld}</p:bldLst>" if bld else "")
        + "</p:timing>"
    )


def process(xml: bytes, index: int) -> bytes:
    root = etree.fromstring(xml)
    shapes = []
    tree = root.find(".//p:cSld/p:spTree", NS)
    for el in tree:
        tag = etree.QName(el).localname
        cnv = el.find(".//p:cNvPr", NS)
        if cnv is None:
            continue
        m = NAME_RE.match(cnv.get("name", ""))
        if m:
            shapes.append((cnv.get("id"), m.group(2), int(m.group(1)), tag == "sp"))
    s = xml.decode("utf-8")
    s = re.sub(r"<p:transition[\s\S]*?</p:transition>|<p:transition[^>]*/>", "", s)
    s = re.sub(r"<p:timing>[\s\S]*?</p:timing>", "", s)
    addition = (FADE if index == 1 else MORPH) + (build_timing(shapes) if shapes else "")
    if "</p:clrMapOvr>" in s:
        s = s.replace("</p:clrMapOvr>", "</p:clrMapOvr>" + addition, 1)
    else:
        s = s.replace("</p:cSld>", "</p:cSld>" + addition, 1)
    return s.encode("utf-8"), len(shapes)


def main(path):
    src = zipfile.ZipFile(path)
    items = {i.filename: src.read(i.filename) for i in src.infolist()}
    order = [i.filename for i in src.infolist()]
    src.close()
    for name in order:
        m = re.match(r"ppt/slides/slide(\d+)\.xml$", name)
        if m:
            items[name], n = process(items[name], int(m.group(1)))
            print(f"slide {m.group(1)}: {n} animated elements")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as out:
        for name in order:
            out.writestr(name, items[name])


if __name__ == "__main__":
    main(sys.argv[1])
