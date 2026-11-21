"""Ubah svg/*.svg menjadi EPS 'vector-safe' untuk Adobe Stock:
tanpa transparansi, tanpa filter/blur, teks jadi outline. Output: vector/eps, vector/preview, vector/zip."""
import os, re, io, glob, math, zipfile
from lxml import etree
import cairosvg
from PIL import Image
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

NS = "http://www.w3.org/2000/svg"; Q = lambda t: f"{{{NS}}}{t}"
HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = {"caladea-italic": "/usr/share/fonts/truetype/crosextra/Caladea-Italic.ttf",
         "inter-300": "/usr/share/fonts/opentype/inter/Inter-Light.otf",
         "inter-800": "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf",
         "interdisplay-900": "/usr/share/fonts/opentype/inter/InterDisplay-Black.otf"}
_fc = {}

def font_for(el):
    fam = el.get("font-family", "").lower(); w = el.get("font-weight", "400")
    if "caladea" in fam: k = "caladea-italic"
    elif "inter display" in fam: k = "interdisplay-900"
    else: k = "inter-800" if int(w) >= 700 else "inter-300"
    if k not in _fc: _fc[k] = TTFont(FONTS[k])
    return _fc[k]

def text_to_path(el):
    f = font_for(el); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm
    size = float(el.get("font-size")); ls = float(el.get("letter-spacing", 0)); s = size / upm
    txt = el.text or ""; names = [cmap.get(ord(c), ".notdef") for c in txt]
    adv = [gs[n].width * s + ls for n in names]
    total = sum(adv) - (ls if adv else 0)
    x = float(el.get("x")); y = float(el.get("y"))
    anchor = el.get("text-anchor", "start")
    x -= total / 2 if anchor == "middle" else (total if anchor == "end" else 0)
    pen = SVGPathPen(gs)
    for n, a in zip(names, adv):
        gs[n].draw(TransformPen(pen, (s, 0, 0, -s, x, y))); x += a
    p = etree.Element(Q("path")); p.set("d", pen.getCommands()); p.set("fill", el.get("fill", "#000"))
    return p

# ---------- geometry ----------
def mat_mul(a, b):
    return (a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
            a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5])

def parse_tf(t):
    m = (1, 0, 0, 1, 0, 0)
    for fn, args in re.findall(r"(\w+)\(([^)]*)\)", t or ""):
        v = [float(x) for x in re.split(r"[ ,]+", args.strip()) if x]
        if fn == "translate": n = (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0)
        elif fn == "scale": n = (v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0)
        elif fn == "rotate":
            a = math.radians(v[0]); c, s_ = math.cos(a), math.sin(a)
            n = (c, s_, -s_, c, 0, 0)
            if len(v) == 3: n = mat_mul(mat_mul((1, 0, 0, 1, v[1], v[2]), n), (1, 0, 0, 1, -v[1], -v[2]))
        else: continue
        m = mat_mul(m, n)
    return m

def local_point(el):
    g = lambda k: float(el.get(k, 0))
    tag = etree.QName(el).localname
    if tag in ("circle", "ellipse"): return g("cx"), g("cy")
    if tag == "rect": return g("x") + g("width") / 2, g("y") + g("height") / 2
    if tag == "line": return (g("x1") + g("x2")) / 2, (g("y1") + g("y2")) / 2
    nums = [float(x) for x in re.findall(r"-?\d+\.?\d*", el.get("points") or el.get("d") or "")]
    pts = list(zip(nums[0::2], nums[1::2]))
    if not pts: return 0, 0
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)

# ---------- colours ----------
def hex2rgb(c):
    c = c.strip().lstrip("#")
    if len(c) == 3: c = "".join(ch * 2 for ch in c)
    return tuple(int(c[i:i+2], 16) for i in (0, 2, 4))

def solid(c, golds):
    if not c or c == "none": return None
    if c.startswith("url("):
        return golds.get(c[5:-1])  # gradient → warna rata-ratanya
    return hex2rgb(c)

def flatten(src_svg):
    root = etree.fromstring(src_svg.encode())
    W = float(root.get("width")); H = float(root.get("height"))
    # 1. teks -> outline
    for t in root.iter(Q("text")):
        t.getparent().replace(t, text_to_path(t))
    # 2. hapus filter & shading transparan
    for fl in list(root.iter(Q("filter"))): fl.getparent().remove(fl)
    for el in list(root.iter()):
        if not isinstance(el.tag, str): continue
        if el.get("fill") == "url(#shade)": el.getparent().remove(el); continue
        if "filter" in el.attrib: del el.attrib["filter"]
    # warna rata-rata gradient (untuk elemen transparan yang memakai gradient)
    grads = {}
    for gr in list(root.iter(Q("linearGradient"))) + list(root.iter(Q("radialGradient"))):
        cols = [hex2rgb(s.get("stop-color")) for s in gr.iter(Q("stop"))]
        grads[gr.get("id")] = tuple(sum(c[i] for c in cols) // len(cols) for i in range(3))
    # 3. hitung opasitas efektif + matriks setiap elemen
    info = []
    def walk(el, op, m):
        if not isinstance(el.tag, str) or etree.QName(el).localname in ("defs", "clipPath"): return
        op *= float(el.get("opacity", 1)); m = mat_mul(m, parse_tf(el.get("transform")))
        info.append((el, op, m))
        for ch in el: walk(ch, op, m)
    walk(root, 1.0, (1, 0, 0, 1, 0, 0))
    trans = [(el, op, m) for el, op, m in info
             if op < .999 or float(el.get("fill-opacity", 1)) < .999 or float(el.get("stroke-opacity", 1)) < .999]
    # 4. render latar (tanpa elemen transparan) untuk sampling warna di bawahnya
    base = etree.fromstring(etree.tostring(root))
    bmap = {id(a): b for a, b in zip(root.iter(), base.iter())}
    for el, _, _ in trans:
        b = bmap[id(el)]
        if b.getparent() is not None and etree.QName(b).localname != "g": b.set("visibility", "hidden")
    sc = .25
    img = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=etree.tostring(base), scale=sc))).convert("RGB")
    def bg_at(m, el):
        lx, ly = local_point(el); x = m[0]*lx + m[2]*ly + m[4]; y = m[1]*lx + m[3]*ly + m[5]
        x = min(max(x, 0), W - 1); y = min(max(y, 0), H - 1)
        return img.getpixel((int(x * sc), int(y * sc)))
    for el, op, m in trans:
        if etree.QName(el).localname == "g": continue
        if op < .01:  # elemen tak terlihat: buang
            if el.getparent() is not None: el.getparent().remove(el)
            continue
        bg = bg_at(m, el)
        for attr in ("fill", "stroke"):
            a = op * float(el.get(f"{attr}-opacity", 1))
            c = solid(el.get(attr, "#000" if attr == "fill" else "none"), grads)
            if c is None or a >= .999: continue
            mix = tuple(round(a * c[i] + (1 - a) * bg[i]) for i in range(3))
            el.set(attr, "#%02x%02x%02x" % mix)
    for el, _, _ in info:
        for k in ("opacity", "fill-opacity", "stroke-opacity"):
            el.attrib.pop(k, None)
    for s in root.iter(Q("stop")): s.attrib.pop("stop-opacity", None)
    # artboard besar (>= 24 MP) supaya lolos syarat ukuran vektor Adobe
    k = 4 if W != H else 4
    root.set("width", f"{W*k:g}pt"); root.set("height", f"{H*k:g}pt")
    return etree.tostring(root)

if __name__ == "__main__":
    out = os.path.join(HERE, "vector")
    for d in ("eps", "preview"): os.makedirs(os.path.join(out, d), exist_ok=True)
    for p in sorted(glob.glob(os.path.join(HERE, "svg", "*.svg"))):
        if "gold_bokeh" in p: continue  # bokeh butuh blur -> hanya dijual sebagai JPG
        name = os.path.basename(p)[:-4]
        flat = flatten(open(p).read())
        eps = os.path.join(out, "eps", name + ".eps")
        cairosvg.svg2eps(bytestring=flat, write_to=eps)
        data = open(eps, "rb").read()
        raster = any(k in data for k in (b"colorimage", b"/ImageType", b"image\n"))
        jpg = os.path.join(out, "preview", name + ".jpg")
        Image.open(io.BytesIO(cairosvg.svg2png(bytestring=flat, scale=0.75))).convert("RGB").save(jpg, quality=92)


        print(f"{name}: {len(data)//1024} KB, raster={'YA' if raster else 'tidak'}")
