"""Generator 20 ilustrasi Natal untuk Adobe Stock (SVG). Jalankan: python3 generate.py"""
import math, random, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "svg")
W, H = 1500, 1000

def f(v): return f"{v:.1f}"

# ---------- helpers ----------
def star(cx, cy, r, fill, rot=-90, inner=0.42, pts=5, extra=""):
    p = []
    for i in range(pts * 2):
        rr = r if i % 2 == 0 else r * inner
        a = math.radians(rot + i * 180 / pts)
        p.append(f"{f(cx + rr*math.cos(a))},{f(cy + rr*math.sin(a))}")
    return f'<polygon points="{" ".join(p)}" fill="{fill}" {extra}/>'

def sparkle(cx, cy, r, fill, op=1):
    k = r * 0.18
    d = (f"M{f(cx)},{f(cy-r)} Q{f(cx+k)},{f(cy-k)} {f(cx+r)},{f(cy)} Q{f(cx+k)},{f(cy+k)} {f(cx)},{f(cy+r)} "
         f"Q{f(cx-k)},{f(cy+k)} {f(cx-r)},{f(cy)} Q{f(cx-k)},{f(cy-k)} {f(cx)},{f(cy-r)}Z")
    return f'<path d="{d}" fill="{fill}" opacity="{op}"/>'

def snowflake(cx, cy, r, color, sw=None, op=1, rot=0):
    sw = sw or max(1.2, r * 0.09)
    s = [f'<g transform="translate({f(cx)},{f(cy)}) rotate({rot})" stroke="{color}" stroke-width="{f(sw)}" stroke-linecap="round" fill="none" opacity="{op}">']
    for i in range(6):
        s.append(f'<g transform="rotate({i*60})"><line x1="0" y1="0" x2="0" y2="{f(-r)}"/>'
                 f'<polyline points="{f(-r*.25)},{f(-r*.75)} 0,{f(-r*.5)} {f(r*.25)},{f(-r*.75)}"/>'
                 f'<polyline points="{f(-r*.18)},{f(-r*.42)} 0,{f(-r*.27)} {f(r*.18)},{f(-r*.42)}"/></g>')
    s.append("</g>")
    return "".join(s)

def bauble(cx, cy, r, color, cap="#d4a73a", hl=True, pattern=None):
    s = [f'<rect x="{f(cx-r*.22)}" y="{f(cy-r*1.16)}" width="{f(r*.44)}" height="{f(r*.26)}" rx="{f(r*.05)}" fill="{cap}"/>',
         f'<circle cx="{f(cx)}" cy="{f(cy-r*1.22)}" r="{f(r*.09)}" fill="none" stroke="{cap}" stroke-width="{f(r*.04)}"/>',
         f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{color}"/>']
    if pattern == "band":
        s.append(f'<path d="M{f(cx-r*.96)},{f(cy-r*.2)} Q{f(cx)},{f(cy+r*.05)} {f(cx+r*.96)},{f(cy-r*.2)} L{f(cx+r*.96)},{f(cy+r*.12)} Q{f(cx)},{f(cy+r*.37)} {f(cx-r*.96)},{f(cy+r*.12)}Z" fill="{cap}" opacity=".9"/>')
    if pattern == "dots":
        for a in range(0, 360, 45):
            s.append(f'<circle cx="{f(cx+r*.6*math.cos(math.radians(a)))}" cy="{f(cy+r*.6*math.sin(math.radians(a)))}" r="{f(r*.08)}" fill="{cap}"/>')
    if pattern == "flake":
        s.append(snowflake(cx, cy, r*.55, cap, sw=r*.06))
    if hl:
        s.append(f'<ellipse cx="{f(cx-r*.38)}" cy="{f(cy-r*.4)}" rx="{f(r*.22)}" ry="{f(r*.13)}" transform="rotate(-35 {f(cx-r*.38)} {f(cy-r*.4)})" fill="#fff" opacity=".45"/>')
        s.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="url(#shade)"/>')
    return "".join(s)

def pine(x, base, w, h, color, layers=3, snow=None, trunk="#5a3a22"):
    s = [f'<rect x="{f(x-w*.07)}" y="{f(base-h*.12)}" width="{f(w*.14)}" height="{f(h*.12)}" fill="{trunk}"/>']
    for i in range(layers):
        t = i / layers
        top = base - h + h * t * .55
        bot = base - h * .1 - (layers - 1 - i) * h * .17
        ww = w * (.55 + .45 * (i + 1) / layers)
        s.append(f'<polygon points="{f(x)},{f(top)} {f(x+ww/2)},{f(bot)} {f(x-ww/2)},{f(bot)}" fill="{color}"/>')
        if snow:
            s.append(f'<path d="M{f(x)},{f(top)} L{f(x+ww*.16)},{f(top+(bot-top)*.32)} Q{f(x)},{f(top+(bot-top)*.4)} {f(x-ww*.16)},{f(top+(bot-top)*.32)}Z" fill="{snow}"/>')
    return "".join(s)

def gift(x, y, w, h, color, ribbon, lid=True):
    s = [f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="{color}"/>',
         f'<rect x="{f(x+w*.42)}" y="{f(y)}" width="{f(w*.16)}" height="{f(h)}" fill="{ribbon}"/>']
    if lid:
        s.append(f'<rect x="{f(x-w*.05)}" y="{f(y-h*.04)}" width="{f(w*1.1)}" height="{f(h*.2)}" fill="{color}"/>')
        s.append(f'<rect x="{f(x-w*.05)}" y="{f(y+h*.16)}" width="{f(w*1.1)}" height="{f(h*.03)}" fill="#000" opacity=".12"/>')
        s.append(f'<rect x="{f(x+w*.42)}" y="{f(y-h*.04)}" width="{f(w*.16)}" height="{f(h*.2)}" fill="{ribbon}"/>')
    bx, by, r = x + w / 2, y - h * .04, w * .2
    s.append(f'<ellipse cx="{f(bx-r*.8)}" cy="{f(by-r*.45)}" rx="{f(r)}" ry="{f(r*.5)}" transform="rotate(-25 {f(bx-r*.8)} {f(by-r*.45)})" fill="none" stroke="{ribbon}" stroke-width="{f(w*.06)}"/>')
    s.append(f'<ellipse cx="{f(bx+r*.8)}" cy="{f(by-r*.45)}" rx="{f(r)}" ry="{f(r*.5)}" transform="rotate(25 {f(bx+r*.8)} {f(by-r*.45)})" fill="none" stroke="{ribbon}" stroke-width="{f(w*.06)}"/>')
    s.append(f'<circle cx="{f(bx)}" cy="{f(by)}" r="{f(w*.06)}" fill="{ribbon}"/>')
    return "".join(s)

def gift_top(cx, cy, size, color, ribbon, rot=0):
    h = size / 2
    return (f'<g transform="rotate({rot} {f(cx)} {f(cy)})">'
            f'<rect x="{f(cx-h+6)}" y="{f(cy-h+10)}" width="{f(size)}" height="{f(size)}" rx="6" fill="#000" opacity=".18"/>'
            f'<rect x="{f(cx-h)}" y="{f(cy-h)}" width="{f(size)}" height="{f(size)}" rx="6" fill="{color}"/>'
            f'<rect x="{f(cx-size*.07)}" y="{f(cy-h)}" width="{f(size*.14)}" height="{f(size)}" fill="{ribbon}"/>'
            f'<rect x="{f(cx-h)}" y="{f(cy-size*.07)}" width="{f(size)}" height="{f(size*.14)}" fill="{ribbon}"/>'
            f'<ellipse cx="{f(cx-size*.15)}" cy="{f(cy-size*.06)}" rx="{f(size*.17)}" ry="{f(size*.09)}" transform="rotate(-30 {f(cx-size*.15)} {f(cy-size*.06)})" fill="{ribbon}" stroke="#000" stroke-opacity=".12" stroke-width="2"/>'
            f'<ellipse cx="{f(cx+size*.15)}" cy="{f(cy-size*.06)}" rx="{f(size*.17)}" ry="{f(size*.09)}" transform="rotate(30 {f(cx+size*.15)} {f(cy-size*.06)})" fill="{ribbon}" stroke="#000" stroke-opacity=".12" stroke-width="2"/>'
            f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(size*.08)}" fill="{ribbon}" stroke="#000" stroke-opacity=".15" stroke-width="2"/></g>')

def leaf(cx, cy, l, w, ang, color):
    return (f'<path d="M0,0 Q{f(l*.5)},{f(-w)} {f(l)},0 Q{f(l*.5)},{f(w)} 0,0Z" fill="{color}" '
            f'transform="translate({f(cx)},{f(cy)}) rotate({f(ang)})"/>')

def holly(cx, cy, s, rot=0):
    return (f'<g transform="translate({f(cx)},{f(cy)}) rotate({rot}) scale({s})">'
            f'<path d="M0,0 C20,-12 30,-6 38,-18 C42,-8 52,-8 58,-4 C52,2 54,10 60,16 C48,16 40,14 34,22 C30,12 18,8 0,0Z" fill="#1f6b3a"/>'
            f'<path d="M0,0 C-20,-12 -30,-6 -38,-18 C-42,-8 -52,-8 -58,-4 C-52,2 -54,10 -60,16 C-48,16 -40,14 -34,22 C-30,12 -18,8 0,0Z" fill="#2e8b4a"/>'
            f'<circle cx="-7" cy="-6" r="8" fill="#c8102e"/><circle cx="7" cy="-6" r="8" fill="#b00d27"/><circle cx="0" cy="5" r="8" fill="#d91f3a"/></g>')

def falling_snow(rnd, n, rmin, rmax, color="#fff", ymax=H, opmin=.5):
    return "".join(f'<circle cx="{f(rnd.uniform(0,W))}" cy="{f(rnd.uniform(0,ymax))}" r="{f(rnd.uniform(rmin,rmax))}" fill="{color}" opacity="{f(rnd.uniform(opmin,1))}"/>' for _ in range(n))

DEFS = """<defs>
<radialGradient id="shade" cx="35%" cy="30%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".35"/></radialGradient>
<filter id="blur4"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="blur10"><feGaussianBlur stdDeviation="10"/></filter>
<filter id="blur25"><feGaussianBlur stdDeviation="25"/></filter>
<filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>"""

def svg(body, w=W, h=H, extra_defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
            f'{DEFS}{"<defs>"+extra_defs+"</defs>" if extra_defs else ""}{body}</svg>')

# ---------- scenes ----------
def s01_red_baubles():
    rnd = random.Random(1)
    b = ['<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c1121f"/><stop offset="1" stop-color="#6d0a12"/></linearGradient></defs>',
         f'<rect width="{W}" height="{H}" fill="url(#bg)"/>']
    for _ in range(140):
        b.append(f'<circle cx="{f(rnd.uniform(0,W))}" cy="{f(rnd.uniform(0,H))}" r="{f(rnd.uniform(1,3.5))}" fill="#f4d27a" opacity="{f(rnd.uniform(.2,.8))}"/>')
    items = [(120, 330, 70, "#f1c84b", "band"), (250, 520, 95, "#ffffff", "flake"), (390, 260, 60, "#8a0d17", "dots"),
             (520, 600, 80, "#e9b949", "flake"), (640, 380, 55, "#fdf6e3", "dots"), (70, 690, 50, "#9e1020", "band")]
    for x, y, r, c, p in items:
        b.append(f'<line x1="{x}" y1="0" x2="{x}" y2="{f(y-r*1.3)}" stroke="#e8c15a" stroke-width="2.5"/>')
        cap = "#d4a73a" if c not in ("#f1c84b", "#e9b949") else "#9e1020"
        b.append(bauble(x, y, r, c, cap="#d4a73a" if p != "flake" or c == "#ffffff" else "#ffffff", pattern=p))
    for _ in range(10):
        b.append(sparkle(rnd.uniform(800, 1450), rnd.uniform(60, 940), rnd.uniform(8, 22), "#ffe7a3", .8))
    return svg("".join(b))

def tile_pattern(cells, period, draw, rnd):
    out = []
    for (x, y, kind) in cells:
        for dx in (-period, 0, period):
            for dy in (-period, 0, period):
                xx, yy = x + dx, y + dy
                if -120 < xx < period + 120 and -120 < yy < period + 120:
                    out.append(draw(xx, yy, kind))
    return "".join(out)

def s02_pattern_cream():
    P = 1200; rnd = random.Random(2); cells = []
    n = 6; c = P / n
    kinds = ["tree", "flake", "gift", "star", "bauble", "tree2"]
    for j in range(n):
        for i in range(n):
            x = i * c + (c / 2 if j % 2 else 0) + c / 4
            y = j * c + c / 2
            cells.append((x, y, kinds[(i + j * 2) % len(kinds)]))
    def draw(x, y, k):
        if k == "tree": return pine(x, y + 55, 90, 120, "#1f6b4a", snow="#fff")
        if k == "tree2": return pine(x, y + 55, 80, 110, "#c8102e", layers=3)
        if k == "flake": return snowflake(x, y, 42, "#2f6fa3", sw=4)
        if k == "gift": return gift(x - 40, y - 25, 80, 70, "#c8102e", "#f2c14e")
        if k == "star": return star(x, y, 40, "#e2a93b")
        if k == "bauble": return bauble(x, y + 10, 36, "#2f6fa3", cap="#e2a93b", pattern="band", hl=False)
    dots = "".join(f'<circle cx="{f(i*c/2)}" cy="{f(j*c/2+c/4)}" r="4" fill="#c8102e" opacity=".35"/>' for i in range(n*2) for j in range(n*2))
    return svg(f'<rect width="{P}" height="{P}" fill="#fbf4e6"/>{dots}' + tile_pattern(cells, P, draw, rnd), P, P)

def s03_navy_greeting():
    rnd = random.Random(3)
    b = ['<defs><radialGradient id="bg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#1d2b55"/><stop offset="1" stop-color="#0a1128"/></radialGradient>'
         '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7e3a1"/><stop offset=".5" stop-color="#d4a73a"/><stop offset="1" stop-color="#a87b1f"/></linearGradient></defs>',
         f'<rect width="{W}" height="{H}" fill="url(#bg)"/>',
         f'<rect x="60" y="60" width="{W-120}" height="{H-120}" fill="none" stroke="url(#gold)" stroke-width="3"/>',
         f'<rect x="78" y="78" width="{W-156}" height="{H-156}" fill="none" stroke="url(#gold)" stroke-width="1" opacity=".7"/>']
    for _ in range(90):
        x, y = rnd.uniform(90, W-90), rnd.uniform(90, H-90)
        if 330 < x < 1170 and 330 < y < 680: continue
        b.append(star(x, y, rnd.uniform(4, 14), "url(#gold)", rot=rnd.uniform(0, 72), extra=f'opacity="{f(rnd.uniform(.5,1))}"'))
    b.append(star(750, 300, 46, "url(#gold)"))
    b.append('<text x="750" y="530" text-anchor="middle" font-family="Caladea, Liberation Serif, serif" font-style="italic" font-size="150" fill="url(#gold)">Merry Christmas</text>')
    b.append('<text x="750" y="620" text-anchor="middle" font-family="Inter, sans-serif" font-weight="300" letter-spacing="18" font-size="34" fill="#f2dfa6">AND A HAPPY NEW YEAR</text>')
    b.append('<line x1="560" y1="680" x2="940" y2="680" stroke="url(#gold)" stroke-width="2"/>')
    return svg("".join(b))

def house(x, base, w, h, wall, roof, rnd):
    s = [f'<rect x="{f(x)}" y="{f(base-h)}" width="{f(w)}" height="{f(h)}" fill="{wall}"/>',
         f'<polygon points="{f(x-w*.12)},{f(base-h)} {f(x+w/2)},{f(base-h-h*.65)} {f(x+w*1.12)},{f(base-h)}" fill="{roof}"/>',
         f'<path d="M{f(x-w*.12)},{f(base-h)} L{f(x+w/2)},{f(base-h-h*.65)} L{f(x+w*1.12)},{f(base-h)} Q{f(x+w*.9)},{f(base-h+12)} {f(x+w*.7)},{f(base-h-4)} Q{f(x+w*.4)},{f(base-h+14)} {f(x+w*.1)},{f(base-h-2)}Z" fill="#eef3fb" opacity=".95" transform="translate(0,-6)"/>']
    for k in range(2):
        wx = x + w * (.18 + .44 * k)
        s.append(f'<rect x="{f(wx)}" y="{f(base-h*.75)}" width="{f(w*.2)}" height="{f(h*.26)}" fill="#ffd36b" filter="url(#glow)"/>')
    s.append(f'<rect x="{f(x+w*.4)}" y="{f(base-h*.4)}" width="{f(w*.2)}" height="{f(h*.4)}" fill="#6b3b22"/>')
    return "".join(s)

def s04_snowy_village():
    rnd = random.Random(4)
    b = ['<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1a3a"/><stop offset=".7" stop-color="#2b4a7e"/><stop offset="1" stop-color="#4f6fa5"/></linearGradient></defs>',
         f'<rect width="{W}" height="{H}" fill="url(#sky)"/>']
    for _ in range(160):
        b.append(f'<circle cx="{f(rnd.uniform(0,W))}" cy="{f(rnd.uniform(0,520))}" r="{f(rnd.uniform(.6,2.2))}" fill="#fff" opacity="{f(rnd.uniform(.3,1))}"/>')
    b.append('<circle cx="1220" cy="190" r="110" fill="#fff6d8" opacity=".18" filter="url(#blur25)"/><circle cx="1220" cy="190" r="70" fill="#fff6d8"/>')
    b.append(f'<path d="M0,640 Q300,560 650,620 T1500,590 L1500,{H} L0,{H}Z" fill="#c9d8ee"/>')
    for i in range(14):
        x = 40 + i * 110 + rnd.uniform(-20, 20)
        b.append(pine(x, 640 + rnd.uniform(-20, 10), 90, rnd.uniform(160, 230), "#1c3b4a", snow="#e8f0fa"))
    b.append(f'<path d="M0,760 Q400,690 800,740 T1500,720 L1500,{H} L0,{H}Z" fill="#e6eef9"/>')
    for x, w, h, wall, roof in [(160, 170, 130, "#8c2f2f", "#3a2a2a"), (430, 200, 150, "#d9b382", "#5b3a2a"), (760, 160, 120, "#2f5d62", "#3a2a2a"), (1040, 210, 160, "#a8432f", "#4a2f2a")]:
        b.append(house(x, 790, w, h, wall, roof, rnd))
    b.append(f'<path d="M0,820 Q500,770 900,810 T1500,800 L1500,{H} L0,{H}Z" fill="#f7fbff"/>')
    b.append(pine(1360, 860, 140, 320, "#163a2c", snow="#fff"))
    for k in range(18):
        t = k / 17; x = 1360 + (t - .5) * 120 * t; y = 560 + t * 260
        b.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="5" fill="{["#ffd36b","#ff6b6b","#7fd1ff"][k%3]}" filter="url(#glow)"/>')
    b.append(star(1360, 545, 22, "#ffd36b", extra='filter="url(#glow)"'))
    b.append(falling_snow(rnd, 220, 1.5, 4.5))
    return svg("".join(b))

def sprig(cx, cy, length, ang, rnd, color="#2d6a4f"):
    s = [f'<g transform="translate({f(cx)},{f(cy)}) rotate({f(ang)})"><line x1="0" y1="0" x2="{f(length)}" y2="0" stroke="#5a3a22" stroke-width="4"/>']
    n = int(length / 9)
    for i in range(n):
        x = i * length / n
        for sgn in (-1, 1):
            s.append(f'<line x1="{f(x)}" y1="0" x2="{f(x+18)}" y2="{f(sgn*rnd.uniform(26,34))}" stroke="{color}" stroke-width="4.5" stroke-linecap="round"/>')
    s.append("</g>")
    return "".join(s)

def s05_flatlay_gifts():
    rnd = random.Random(5)
    b = [f'<rect width="{W}" height="{H}" fill="#1e4d3b"/>']
    for _ in range(4000):
        b.append(f'<circle cx="{f(rnd.uniform(0,W))}" cy="{f(rnd.uniform(0,H))}" r="1.2" fill="#fff" opacity=".04"/>')
    b.append(sprig(-20, 120, 330, 15, rnd)); b.append(sprig(1520, 880, 330, 195, rnd)); b.append(sprig(1250, -20, 260, 115, rnd, "#357a5c")); b.append(sprig(180, 1020, 260, -70, rnd, "#357a5c"))
    b.append(gift_top(170, 280, 190, "#c8102e", "#f2c14e", 8))
    b.append(gift_top(330, 720, 150, "#f4efe6", "#c8102e", -10))
    b.append(gift_top(1250, 690, 210, "#d9a441", "#7a0c14", -6))
    b.append(gift_top(1100, 260, 130, "#7a0c14", "#f4efe6", 14))
    for x, y, r, c in [(520, 180, 34, "#c8102e"), (1320, 420, 40, "#f2c14e"), (980, 870, 30, "#f4efe6"), (110, 520, 28, "#d9a441")]:
        b.append(f'<circle cx="{x+6}" cy="{y+8}" r="{r}" fill="#000" opacity=".2"/>' + bauble(x, y, r, c, cap="#c9c9c9"))
    for _ in range(50):
        b.append(f'<circle cx="{f(rnd.uniform(0,W))}" cy="{f(rnd.uniform(0,H))}" r="{f(rnd.uniform(3,7))}" fill="#c8102e"/>' if rnd.random() < .3 else
                 star(rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(5, 10), "#f2c14e", rot=rnd.uniform(0, 72)))
    return svg("".join(b))

def s06_geometric_tree():
    rnd = random.Random(6)
    b = [f'<rect width="{W}" height="{H}" fill="#f6f1e9"/>']
    cx, top, base, half = 420, 150, 860, 290
    greens = ["#1b4332", "#2d6a4f", "#40916c", "#52b788", "#74c69d", "#d4a73a"]
    rows = 7
    for r in range(rows):
        y0 = top + (base - top) * r / rows; y1 = top + (base - top) * (r + 1) / rows
        w0 = half * r / rows; w1 = half * (r + 1) / rows
        n = r + 1
        for i in range(n):
            xa0 = cx - w0 + 2 * w0 * i / max(n - 1, 1) if n > 1 else cx
            xb0 = cx - w1 + 2 * w1 * i / n; xb1 = cx - w1 + 2 * w1 * (i + 1) / n
            c = rnd.choice(greens[:5]) if rnd.random() > .12 else greens[5]
            b.append(f'<polygon points="{f(xa0)},{f(y0)} {f(xb0)},{f(y1)} {f(xb1)},{f(y1)}" fill="{c}" stroke="#f6f1e9" stroke-width="2"/>')
            if i < n - 1:
                xa1 = cx - w0 + 2 * w0 * (i + 1) / max(n - 1, 1)
                c = rnd.choice(greens[:5]) if rnd.random() > .12 else greens[5]
                b.append(f'<polygon points="{f(xa0)},{f(y0)} {f(xa1)},{f(y0)} {f(xb1)},{f(y1)}" fill="{c}" stroke="#f6f1e9" stroke-width="2"/>')
    b.append(f'<rect x="{cx-30}" y="{base}" width="60" height="60" fill="#7f5539"/>')
    b.append(star(cx, top - 20, 48, "#d4a73a"))
    b.append(f'<ellipse cx="{cx}" cy="{base+66}" rx="260" ry="12" fill="#000" opacity=".08"/>')
    for _ in range(14):
        b.append(sparkle(rnd.uniform(80, 780), rnd.uniform(60, 940), rnd.uniform(6, 14), "#d4a73a", .7))
    return svg("".join(b))

def gnome(x, base, s, hat, body, rnd):
    g = [f'<g transform="translate({f(x)},{f(base)}) scale({s})">',
         '<ellipse cx="0" cy="0" rx="120" ry="14" fill="#000" opacity=".12"/>',
         '<ellipse cx="-42" cy="-10" rx="34" ry="16" fill="#3b2a20"/><ellipse cx="42" cy="-10" rx="34" ry="16" fill="#3b2a20"/>',
         f'<path d="M-90,-20 Q-100,-150 0,-170 Q100,-150 90,-20Z" fill="{body}"/>',
         '<path d="M-78,-150 Q-95,-60 -40,-30 Q0,-10 40,-30 Q95,-60 78,-150 Q60,-120 0,-125 Q-60,-120 -78,-150Z" fill="#f4f1ec"/>',
         '<path d="M-60,-130 Q-70,-80 -35,-60 M60,-130 Q70,-80 35,-60 M0,-120 L0,-50" stroke="#ddd6cb" stroke-width="5" fill="none" stroke-linecap="round"/>',
         '<ellipse cx="0" cy="-160" rx="30" ry="26" fill="#e8a587"/>',
         f'<path d="M-95,-170 Q-100,-200 -60,-210 Q-30,-330 40,-430 Q50,-300 70,-210 Q100,-200 95,-170 Q0,-150 -95,-170Z" fill="{hat}"/>',
         '<path d="M-98,-175 Q0,-150 98,-175 L96,-158 Q0,-132 -96,-158Z" fill="#f4f1ec"/>',
         '</g>']
    return "".join(g)

def s07_gnomes():
    rnd = random.Random(7)
    b = [f'<rect width="{W}" height="{H}" fill="#efe6da"/>',
         f'<path d="M0,820 Q750,770 1500,820 L1500,{H} L0,{H}Z" fill="#fbf8f3"/>']
    for _ in range(26):
        b.append(snowflake(rnd.uniform(0, W), rnd.uniform(0, 700), rnd.uniform(10, 26), "#c9b8a3", op=.7, rot=rnd.uniform(0, 60)))
    b.append(pine(250, 840, 200, 420, "#2f5d50", snow="#fbf8f3"))
    b.append(pine(1260, 840, 220, 460, "#2f5d50", snow="#fbf8f3"))
    b.append(gnome(520, 850, 1.0, "#2f5d50", "#9a8b7a", rnd))
    b.append(gnome(750, 860, 1.18, "#b3202a", "#6d6259", rnd))
    b.append(gnome(980, 850, .95, "#f4f1ec", "#b3202a", rnd))
    b.append(gift(1060, 780, 90, 70, "#b3202a", "#f2c14e"))
    b.append(gift(360, 790, 80, 60, "#2f5d50", "#f4f1ec"))
    return svg("".join(b))

def s08_wreath():
    rnd = random.Random(8)
    b = [f'<rect width="{W}" height="{H}" fill="#fbf7f0"/>']
    cx, cy, R = 750, 500, 330
    greens = ["#1b4332", "#2d6a4f", "#40916c", "#245c45"]
    for k in range(420):
        a = rnd.uniform(0, 360); rr = R + rnd.uniform(-45, 45)
        x = cx + rr * math.cos(math.radians(a)); y = cy + rr * math.sin(math.radians(a))
        b.append(leaf(x, y, rnd.uniform(40, 70), rnd.uniform(8, 14), a + 90 + rnd.uniform(-50, 50), rnd.choice(greens)))
    for k in range(40):
        a = rnd.uniform(0, 360); rr = R + rnd.uniform(-35, 35)
        x = cx + rr * math.cos(math.radians(a)); y = cy + rr * math.sin(math.radians(a))
        b.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(rnd.uniform(7,11))}" fill="{rnd.choice(["#c8102e","#a50d22","#e02a45"])}"/>')
    for k in range(10):
        a = math.radians(rnd.uniform(0, 360))
        b.append(star(cx + R * math.cos(a), cy + R * math.sin(a), 14, "#d4a73a", rot=rnd.uniform(0, 72)))
    by = cy + R + 10
    b.append(f'<path d="M{cx},{by} C{cx-70},{by-90} {cx-170},{by-40} {cx-120},{by+10} C{cx-90},{by+40} {cx-30},{by+20} {cx},{by}Z" fill="#c8102e"/>')
    b.append(f'<path d="M{cx},{by} C{cx+70},{by-90} {cx+170},{by-40} {cx+120},{by+10} C{cx+90},{by+40} {cx+30},{by+20} {cx},{by}Z" fill="#b00d27"/>')
    b.append(f'<path d="M{cx-10},{by} L{cx-80},{by+140} L{cx-50},{by+125} L{cx-35},{by+150} L{cx},{by}Z" fill="#a50d22"/>')
    b.append(f'<path d="M{cx+10},{by} L{cx+70},{by+145} L{cx+45},{by+130} L{cx+25},{by+150} L{cx},{by}Z" fill="#c8102e"/>')
    b.append(f'<ellipse cx="{cx}" cy="{by}" rx="26" ry="22" fill="#d91f3a"/>')
    return svg("".join(b))

def s09_pastel_trees():
    rnd = random.Random(9)
    b = [f'<rect width="{W}" height="{H}" fill="#f7d6dc"/>', f'<rect y="800" width="{W}" height="200" fill="#fbe9ec"/>']
    cols = ["#f4a7b9", "#a8dcc9", "#fffaf2", "#f9c9a8", "#c7b8ea", "#e56b8a"]
    xs = [170, 360, 540, 720, 900, 1090, 1290]
    for i, x in enumerate(xs):
        h = rnd.uniform(330, 560); w = h * .55; c = cols[i % len(cols)]
        b.append(f'<rect x="{f(x-10)}" y="790" width="20" height="30" fill="#c08f72"/>')
        b.append(f'<path d="M{f(x)},{f(800-h)} Q{f(x+w*.15)},{f(800-h*.5)} {f(x+w/2)},790 L{f(x-w/2)},790 Q{f(x-w*.15)},{f(800-h*.5)} {f(x)},{f(800-h)}Z" fill="{c}"/>')
        for k in range(6):
            yy = 800 - h + h * (k + 1) / 7
            ww = w * .5 * (k + 1) / 7
            b.append(f'<path d="M{f(x-ww)},{f(yy)} Q{f(x)},{f(yy+18)} {f(x+ww)},{f(yy-6)}" stroke="#fff" stroke-width="3" fill="none" opacity=".8"/>')
            b.append(f'<circle cx="{f(x+rnd.uniform(-ww,ww)*.8)}" cy="{f(yy+6)}" r="6" fill="{rnd.choice(["#fff","#f2c14e","#e56b8a"])}"/>')
        b.append(star(x, 800 - h - 6, 16, "#f2c14e"))
    b.append(falling_snow(rnd, 120, 2, 5, opmin=.6, ymax=780))
    return svg("".join(b))

def s10_gold_bokeh():
    rnd = random.Random(10)
    b = ['<defs><radialGradient id="bg" cx="70%" cy="40%" r="90%"><stop offset="0" stop-color="#1e5240"/><stop offset="1" stop-color="#06140f"/></radialGradient></defs>',
         f'<rect width="{W}" height="{H}" fill="url(#bg)"/>']
    for _ in range(70):
        x = rnd.uniform(0, W); y = rnd.uniform(0, H); r = rnd.uniform(20, 90)
        b.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{rnd.choice(["#f7d774","#e8b04b","#fff1c1"])}" opacity="{f(rnd.uniform(.08,.35))}" filter="url(#blur10)"/>')
    for _ in range(45):
        x = rnd.uniform(0, W); y = rnd.uniform(0, H); r = rnd.uniform(10, 40)
        b.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="#f7d774" opacity="{f(rnd.uniform(.15,.4))}" stroke="#fff1c1" stroke-opacity=".5" stroke-width="2"/>')
    for _ in range(40):
        b.append(sparkle(rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(5, 18), "#fff4d0", rnd.uniform(.6, 1)))
    b.append(f'<rect width="{W}" height="{H}" fill="url(#bg)" opacity=".0"/>')
    return svg("".join(b))

def s11_snowman():
    rnd = random.Random(11)
    b = ['<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc6ea"/><stop offset="1" stop-color="#e5f2fb"/></linearGradient></defs>',
         f'<rect width="{W}" height="{H}" fill="url(#sky)"/>',
         f'<path d="M0,600 Q350,520 760,590 T1500,560 L1500,{H} L0,{H}Z" fill="#d9e8f5"/>']
    for i in range(16):
        b.append(pine(30 + i * 100 + rnd.uniform(-20, 20), 610, 100, rnd.uniform(160, 260), "#2f6b5a", snow="#fff"))
    b.append(f'<path d="M0,720 Q500,650 1000,710 T1500,690 L1500,{H} L0,{H}Z" fill="#fbfdff"/>')
    cx = 750
    b.append(f'<ellipse cx="{cx}" cy="865" rx="190" ry="24" fill="#b8cde0" opacity=".6"/>')
    b.append(f'<line x1="{cx-110}" y1="580" x2="{cx-270}" y2="480" stroke="#5a3a22" stroke-width="10" stroke-linecap="round"/><line x1="{cx-220}" y1="510" x2="{cx-250}" y2="460" stroke="#5a3a22" stroke-width="7" stroke-linecap="round"/>')
    b.append(f'<line x1="{cx+110}" y1="580" x2="{cx+270}" y2="490" stroke="#5a3a22" stroke-width="10" stroke-linecap="round"/><line x1="{cx+225}" y1="515" x2="{cx+265}" y2="470" stroke="#5a3a22" stroke-width="7" stroke-linecap="round"/>')
    for y, r in [(760, 150), (560, 115), (395, 85)]:
        b.append(f'<circle cx="{cx}" cy="{y}" r="{r}" fill="#ffffff"/><circle cx="{cx}" cy="{y}" r="{r}" fill="url(#shade)" opacity=".5"/>')
    b.append(f'<rect x="{cx-70}" y="300" width="140" height="18" rx="6" fill="#222"/><rect x="{cx-48}" y="200" width="96" height="110" rx="8" fill="#222"/><rect x="{cx-48}" y="280" width="96" height="20" fill="#c8102e"/>')
    b.append(f'<circle cx="{cx-30}" cy="380" r="9" fill="#222"/><circle cx="{cx+30}" cy="380" r="9" fill="#222"/>')
    b.append(f'<polygon points="{cx},{398} {cx+90},{415} {cx},{422}" fill="#f28c28"/>')
    for k in range(6):
        a = math.radians(20 + k * 28); b.append(f'<circle cx="{f(cx+50*math.cos(a)-0)}" cy="{f(430+22*math.sin(a))}" r="5" fill="#222"/>')
    b.append(f'<path d="M{cx-100},470 Q{cx},510 {cx+100},470 L{cx+100},500 Q{cx},540 {cx-100},500Z" fill="#c8102e"/>')
    b.append(f'<path d="M{cx+40},500 L{cx+70},640 L{cx+110},630 L{cx+80},495Z" fill="#a50d22"/>')
    for y in (520, 590, 660): b.append(f'<circle cx="{cx}" cy="{y}" r="11" fill="#222"/>')
    b.append(falling_snow(rnd, 160, 2, 5, opmin=.7))
    return svg("".join(b))

def gingerman(x, y, s, rot):
    return (f'<g transform="translate({f(x)},{f(y)}) rotate({f(rot)}) scale({s})">'
            '<path d="M0,-70 a26,26 0 1,1 0.1,0 Z" fill="#b06a35"/>'
            '<path d="M-22,-48 Q-60,-50 -62,-28 Q-60,-10 -26,-14 L-30,20 Q-46,58 -34,66 Q-18,70 -4,34 L4,34 Q18,70 34,66 Q46,58 30,20 L26,-14 Q60,-10 62,-28 Q60,-50 22,-48Z" fill="#b06a35"/>'
            '<circle cx="0" cy="-44" r="26" fill="#b06a35"/>'
            '<circle cx="-9" cy="-50" r="4" fill="#fff"/><circle cx="9" cy="-50" r="4" fill="#fff"/>'
            '<path d="M-10,-36 Q0,-28 10,-36" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>'
            '<path d="M-52,-32 q4,-6 8,0 q4,6 8,0 M44,-32 q4,-6 8,0 q4,6 8,0 M-36,52 q4,-6 8,0 M28,52 q4,-6 8,0" stroke="#fff" stroke-width="3" fill="none"/>'
            '<circle cx="0" cy="-8" r="5" fill="#c8102e"/><circle cx="0" cy="8" r="5" fill="#2d6a4f"/><circle cx="0" cy="-8" r="0"/></g>')

def candy_cane(x, y, s, rot):
    return (f'<g transform="translate({f(x)},{f(y)}) rotate({f(rot)}) scale({s})">'
            '<path d="M0,60 L0,-30 A22,22 0 0,1 44,-30 L44,-20" stroke="#fff" stroke-width="16" fill="none" stroke-linecap="round"/>'
            '<path d="M0,60 L0,-30 A22,22 0 0,1 44,-30 L44,-20" stroke="#c8102e" stroke-width="16" fill="none" stroke-linecap="round" stroke-dasharray="10 10"/></g>')

def s12_gingerbread_pattern():
    P = 1200; rnd = random.Random(12); n = 5; c = P / n; cells = []
    for j in range(n):
        for i in range(n):
            cells.append((i * c + (c / 2 if j % 2 else 0) + c / 4, j * c + c / 2, ["man", "cane", "star", "man", "flake"][(i + j) % 5]))
    def draw(x, y, k):
        if k == "man": return gingerman(x, y, 1.1, (x * 7 + y) % 30 - 15)
        if k == "cane": return candy_cane(x - 20, y, 1.1, (x + y) % 40 - 20)
        if k == "star": return star(x, y, 40, "#b06a35", extra='stroke="#fff" stroke-width="3" stroke-dasharray="6 5"')
        if k == "flake": return snowflake(x, y, 38, "#ffffff", sw=4)
    dots = "".join(f'<circle cx="{f(i*c/2+c/4)}" cy="{f(j*c/2)}" r="5" fill="#fff" opacity=".5"/>' for i in range(n*2) for j in range(n*2))
    return svg(f'<rect width="{P}" height="{P}" fill="#8fbfa8"/>{dots}' + tile_pattern(cells, P, draw, rnd), P, P)

def s13_candy_frame():
    rnd = random.Random(13)
    stripes = "".join(f'<rect x="{i*40-H}" y="-100" width="20" height="{H+400}" fill="#c8102e" transform="rotate(45 {i*40-H} 0)"/>' for i in range(0, 120))
    b = ['<defs><clipPath id="frame"><path fill-rule="evenodd" d="M0,0 H1500 V1000 H0Z M70,70 V930 H1430 V70Z"/></clipPath></defs>',
         f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
         f'<g clip-path="url(#frame)"><rect width="{W}" height="{H}" fill="#fff"/>{stripes}</g>',
         f'<rect x="70" y="70" width="{W-140}" height="{H-140}" fill="#fff8ef"/>',
         f'<rect x="96" y="96" width="{W-192}" height="{H-192}" fill="none" stroke="#d4a73a" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>']
    for x, y, r in [(140, 140, 30), (1360, 140, 120), (140, 860, -60), (1360, 860, 210)]:
        b.append(holly(x, y, 1.4, r))
    for _ in range(18):
        b.append(snowflake(rnd.uniform(200, 1300), rnd.uniform(180, 820), rnd.uniform(8, 16), "#e9d5c0", op=.8))
    return svg("".join(b))

def palm(x, base, h, lean):
    tx, ty = x + lean, base - h
    s = [f'<path d="M{x-14},{base} Q{x+lean*.3},{base-h*.5} {tx-6},{ty} L{tx+6},{ty} Q{x+lean*.3+16},{base-h*.5} {x+14},{base}Z" fill="#6b4226"/>']
    for k in range(8):
        y = base - h * k / 8
        s.append(f'<path d="M{f(x+lean*(k/8)**1.6-12)},{f(y)} l26,-4" stroke="#4e2f1a" stroke-width="3"/>')
    for a, l in [(-175, 230), (-155, 240), (-130, 210), (-105, 170), (-80, 160), (-55, 200), (-30, 240), (-5, 230), (20, 210), (165, 210), (45, 170), (140, 170)]:
        r = math.radians(a)
        ex, ey = tx + l * math.cos(r), ty + l * math.sin(r) + 60
        mx, my = tx + l * .5 * math.cos(r), ty + l * .5 * math.sin(r) - 50
        s.append(f'<path d="M{f(tx)},{f(ty)} Q{f(mx)},{f(my)} {f(ex)},{f(ey)} Q{f(mx+10)},{f(my+40)} {f(tx)},{f(ty)}Z" fill="#1f6b3a"/>')
        s.append(f'<path d="M{f(tx)},{f(ty)} Q{f(mx)},{f(my)} {f(ex)},{f(ey)}" stroke="#2e8b4a" stroke-width="22" fill="none" stroke-dasharray="3 9"/>')
    return "".join(s), tx, ty

def s14_tropical():
    rnd = random.Random(14)
    b = ['<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a76"/><stop offset=".55" stop-color="#ffd29d"/><stop offset="1" stop-color="#ffe9c7"/></linearGradient>'
         '<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2bb3c0"/><stop offset="1" stop-color="#147a8a"/></linearGradient></defs>',
         f'<rect width="{W}" height="{H}" fill="url(#sky)"/>',
         '<circle cx="1050" cy="560" r="130" fill="#ffef9f" opacity=".9"/>',
         f'<rect y="580" width="{W}" height="160" fill="url(#sea)"/>']
    for k in range(10):
        y = 600 + k * 14; b.append(f'<line x1="{f(rnd.uniform(800,1000))}" y1="{y}" x2="{f(rnd.uniform(1100,1300))}" y2="{y}" stroke="#fff3c4" stroke-width="3" opacity=".6"/>')
    b.append(f'<path d="M0,700 Q400,660 800,720 T1500,700 L1500,{H} L0,{H}Z" fill="#f3d9a4"/>')
    b.append(f'<path d="M0,700 Q400,660 800,720 T1500,700" stroke="#fff" stroke-width="10" fill="none" opacity=".8"/>')
    p, tx, ty = palm(330, 860, 560, 90); b.append(p)
    for k in range(26):
        t = k / 25; x = 330 + 90 * t ** 1.6 + math.sin(t * 20) * 22; y = 860 - 540 * t
        b.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="7" fill="{["#ff4d6d","#ffd166","#06d6a0","#4cc9f0"][k%4]}" filter="url(#glow)"/>')
    b.append(f'<path d="M{tx-40},{ty-10} Q{tx},{ty-130} {tx+70},{ty-80} Q{tx+40},{ty-50} {tx+40},{ty-10}Z" fill="#c8102e"/>')
    b.append(f'<rect x="{tx-50}" y="{ty-18}" width="100" height="24" rx="12" fill="#fff"/><circle cx="{tx+72}" cy="{ty-78}" r="16" fill="#fff"/>')
    b.append(gift(560, 810, 110, 90, "#ff4d6d", "#ffd166")); b.append(gift(700, 840, 80, 60, "#06d6a0", "#fff"))
    b.append(star(1180, 880, 40, "#ff8c42", rot=-80, inner=.4)); b.append(star(1300, 920, 26, "#ff6b6b", rot=-60))
    return svg("".join(b))

def reindeer(x, y, s, color):
    return (f'<g transform="translate({x},{y}) scale({s})" fill="{color}" stroke="{color}">'
            '<ellipse cx="0" cy="0" rx="110" ry="48" stroke="none"/>'
            '<path d="M70,-20 L120,-110 L150,-100 L110,-10Z" stroke="none"/>'
            '<path d="M115,-115 Q150,-125 185,-95 L178,-82 Q150,-95 132,-88Z" stroke="none"/>'
            '<ellipse cx="135" cy="-110" rx="28" ry="20" stroke="none"/>'
            '<path d="M-90,10 L-100,120 M-60,20 L-55,125 M60,20 L50,125 M85,10 L95,120" stroke-width="14" stroke-linecap="round" fill="none"/>'
            '<path d="M-105,-10 Q-130,-30 -120,-45" stroke-width="10" fill="none" stroke-linecap="round"/>'
            '<path d="M128,-128 Q110,-190 70,-220 M112,-175 Q80,-180 66,-200 M96,-200 Q100,-235 120,-250 M135,-128 Q160,-185 205,-205 M158,-175 Q190,-170 205,-185 M175,-195 Q170,-230 160,-250" stroke-width="7" fill="none" stroke-linecap="round"/>'
            '<path d="M120,-118 l-18,-8 l14,-6Z" stroke="none"/></g>')

def s15_reindeer_moon():
    rnd = random.Random(15)
    b = ['<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#081633"/><stop offset="1" stop-color="#27477d"/></linearGradient></defs>',
         f'<rect width="{W}" height="{H}" fill="url(#sky)"/>']
    for _ in range(200):
        b.append(f'<circle cx="{f(rnd.uniform(0,W))}" cy="{f(rnd.uniform(0,700))}" r="{f(rnd.uniform(.6,2))}" fill="#fff" opacity="{f(rnd.uniform(.3,1))}"/>')
    b.append('<circle cx="900" cy="420" r="330" fill="#fff8e1" opacity=".12" filter="url(#blur25)"/><circle cx="900" cy="420" r="260" fill="#fdf3d0"/>')
    b.append('<circle cx="820" cy="360" r="40" fill="#efe2b6" opacity=".6"/><circle cx="980" cy="500" r="55" fill="#efe2b6" opacity=".5"/><circle cx="1000" cy="320" r="22" fill="#efe2b6" opacity=".6"/>')
    for i in range(18):
        b.append(pine(i * 90 + rnd.uniform(-20, 20), 820, 110, rnd.uniform(200, 340), "#122442", layers=4))
    b.append(f'<path d="M0,800 Q420,720 900,760 Q1200,780 1500,740 L1500,{H} L0,{H}Z" fill="#0b1830"/>')
    b.append(reindeer(860, 585, 1.45, "#0b1830"))
    for _ in range(12):
        b.append(pine(rnd.choice([rnd.uniform(0, 500), rnd.uniform(1150, 1500)]), 1000, 140, rnd.uniform(300, 420), "#060f22", layers=4))
    return svg("".join(b))

def s16_sale_banner():
    rnd = random.Random(16)
    b = ['<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d0142c"/><stop offset="1" stop-color="#8e0b1c"/></linearGradient></defs>',
         f'<rect width="{W}" height="{H}" fill="url(#bg)"/>']
    for _ in range(30):
        b.append(snowflake(rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(10, 34), "#ffffff", op=rnd.uniform(.15, .4), rot=rnd.uniform(0, 60)))
    for x, y, r, c, p in [(140, 260, 70, "#f2c14e", "band"), (280, 420, 55, "#ffffff", "dots"), (1360, 300, 80, "#ffffff", "flake"), (1220, 470, 50, "#f2c14e", "dots"), (430, 180, 40, "#1f6b4a", "band"), (1080, 170, 42, "#1f6b4a", "dots")]:
        b.append(f'<line x1="{x}" y1="0" x2="{x}" y2="{f(y-r*1.3)}" stroke="#f2c14e" stroke-width="2.5"/>' + bauble(x, y, r, c, cap="#d4a73a" if c != "#f2c14e" else "#c8102e", pattern=p))
    b.append('<text x="750" y="455" text-anchor="middle" font-family="Inter, sans-serif" font-weight="300" letter-spacing="22" font-size="58" fill="#fff">CHRISTMAS</text>')
    b.append('<text x="750" y="640" text-anchor="middle" font-family="Inter Display, Inter, sans-serif" font-weight="900" font-size="230" fill="#fff">SALE</text>')
    b.append('<rect x="520" y="700" width="460" height="90" rx="45" fill="#f2c14e"/>')
    b.append('<text x="750" y="760" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="42" fill="#8e0b1c" letter-spacing="3">UP TO 50% OFF</text>')
    b.append(f'<path d="M0,900 Q750,850 1500,900 L1500,{H} L0,{H}Z" fill="#fff"/>')
    b.append(gift(150, 860, 120, 100, "#1f6b4a", "#f2c14e")); b.append(gift(1240, 850, 130, 110, "#f2c14e", "#c8102e")); b.append(gift(1390, 900, 80, 60, "#c8102e", "#fff"))
    return svg("".join(b))

def s17_cocoa():
    rnd = random.Random(17)
    b = [f'<rect width="{W}" height="{H}" fill="#f3e3d0"/>', f'<rect y="720" width="{W}" height="280" fill="#d9b48f"/>',
         f'<rect y="720" width="{W}" height="10" fill="#c79d74"/>']
    for x in range(0, W, 160): b.append(f'<line x1="{x}" y1="740" x2="{x+60}" y2="{H}" stroke="#c79d74" stroke-width="3" opacity=".5"/>')
    cx = 760
    b.append(f'<ellipse cx="{cx}" cy="810" rx="250" ry="34" fill="#000" opacity=".12"/>')
    b.append(f'<path d="M{cx+170},470 C{cx+290},470 {cx+290},700 {cx+160},690" stroke="#c8102e" stroke-width="44" fill="none"/>')
    b.append(f'<path d="M{cx-200},420 L{cx+200},420 L{cx+175},770 Q{cx},810 {cx-175},770Z" fill="#c8102e"/>')
    b.append(f'<path d="M{cx-190},540 L{cx+190},540 L{cx+185},610 L{cx-185},610Z" fill="#fff"/>')
    for k in range(13):
        x = cx - 180 + k * 30
        b.append(f'<polygon points="{x},{548} {x+15},{575} {x+30},{548}" fill="#c8102e"/><polygon points="{x},{602} {x+15},{575} {x+30},{602}" fill="#1f6b4a"/>')
    b.append(f'<ellipse cx="{cx}" cy="420" rx="200" ry="40" fill="#a50d22"/><ellipse cx="{cx}" cy="425" rx="178" ry="30" fill="#6b3a24"/>')
    for k in range(9):
        x = cx + rnd.uniform(-130, 130); y = 420 + rnd.uniform(-14, 10)
        b.append(f'<rect x="{f(x-24)}" y="{f(y-26)}" width="48" height="40" rx="12" fill="#fffaf3" stroke="#e7d9c6" stroke-width="2" transform="rotate({f(rnd.uniform(-25,25))} {f(x)} {f(y)})"/>')
    for k, dx in enumerate((-70, 10, 90)):
        b.append(f'<path d="M{cx+dx},340 C{cx+dx-40},280 {cx+dx+40},240 {cx+dx},180 C{cx+dx-30},140 {cx+dx+20},110 {cx+dx},80" stroke="#fff" stroke-width="12" fill="none" stroke-linecap="round" opacity=".7"/>')
    b.append(f'<circle cx="{cx-370}" cy="760" r="80" fill="#b06a35"/><circle cx="{cx-370}" cy="760" r="64" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="10 8"/>')
    b.append(star(cx - 370, 760, 30, "#fff"))
    b.append(f'<rect x="{cx+300}" y="740" width="170" height="22" rx="10" fill="#8a4b2a" transform="rotate(-12 {cx+300} 740)"/><rect x="{cx+310}" y="770" width="170" height="22" rx="10" fill="#7a4022" transform="rotate(-8 {cx+310} 770)"/>')
    b.append(holly(cx - 470, 640, 1.3, -10))
    return svg("".join(b))

def s18_lineart():
    rnd = random.Random(18)
    b = [f'<rect width="{W}" height="{H}" fill="#ffffff"/>']
    gold = "#b8923a"; ink = "#1d2b3a"
    specs = [(180, 300, "round"), (330, 520, "drop"), (480, 250, "star"), (630, 420, "round"), (870, 330, "drop"), (1020, 560, "round"), (1170, 280, "star"), (1320, 460, "drop")]
    for i, (x, y, k) in enumerate(specs):
        c = gold if i % 2 else ink
        b.append(f'<line x1="{x}" y1="0" x2="{x}" y2="{y-70}" stroke="{c}" stroke-width="2"/>')
        b.append(f'<rect x="{x-14}" y="{y-72}" width="28" height="18" rx="3" fill="none" stroke="{c}" stroke-width="3"/>')
        if k == "round":
            b.append(f'<circle cx="{x}" cy="{y}" r="54" fill="none" stroke="{c}" stroke-width="3"/><path d="M{x-54},{y} Q{x},{y+30} {x+54},{y}" stroke="{c}" stroke-width="2" fill="none"/><path d="M{x-50},{y-18} Q{x},{y+10} {x+50},{y-18}" stroke="{c}" stroke-width="2" fill="none"/>')
        elif k == "drop":
            b.append(f'<path d="M{x},{y-54} C{x+60},{y} {x+50},{y+60} {x},{y+110} C{x-50},{y+60} {x-60},{y} {x},{y-54}Z" fill="none" stroke="{c}" stroke-width="3"/><line x1="{x}" y1="{y-40}" x2="{x}" y2="{y+95}" stroke="{c}" stroke-width="2"/>')
        else:
            b.append(star(x, y, 58, "none", extra=f'stroke="{c}" stroke-width="3" stroke-linejoin="round"'))
    for _ in range(10):
        b.append(sparkle(rnd.uniform(100, 1400), rnd.uniform(650, 940), rnd.uniform(6, 12), gold, .8))
    return svg("".join(b))

def s19_snowflakes_blue():
    rnd = random.Random(19)
    b = ['<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5aa9e6"/><stop offset="1" stop-color="#1b3f8b"/></linearGradient></defs>',
         f'<rect width="{W}" height="{H}" fill="url(#bg)"/>']
    for _ in range(25):
        b.append(f'<g filter="url(#blur4)">{snowflake(rnd.uniform(0,W), rnd.uniform(0,H), rnd.uniform(20,60), "#ffffff", op=rnd.uniform(.15,.35), rot=rnd.uniform(0,60))}</g>')
    for _ in range(22):
        x = rnd.uniform(0, W)
        if 450 < x < 1050 and rnd.random() < .7: x = rnd.choice([rnd.uniform(0, 450), rnd.uniform(1050, W)])
        b.append(snowflake(x, rnd.uniform(0, H), rnd.uniform(18, 70), "#ffffff", op=rnd.uniform(.6, 1), rot=rnd.uniform(0, 60)))
    b.append(falling_snow(rnd, 160, 1.5, 4, opmin=.4))
    return svg("".join(b))

def s20_fireplace():
    rnd = random.Random(20)
    b = [f'<rect width="{W}" height="{H}" fill="#1f4a3d"/>']
    for x in range(0, W, 60): b.append(f'<rect x="{x}" y="0" width="30" height="{H}" fill="#234f42"/>')
    b.append(f'<rect y="880" width="{W}" height="120" fill="#6b4226"/><rect y="880" width="{W}" height="8" fill="#53321c"/>')
    fx, fw = 400, 700
    b.append(f'<rect x="{fx}" y="380" width="{fw}" height="500" fill="#9b4a35"/>')
    for r in range(13):
        for c in range(12):
            off = 30 if r % 2 else 0
            b.append(f'<rect x="{fx+c*60-off+3}" y="{380+r*38+3}" width="54" height="32" fill="{rnd.choice(["#a85440","#8f4230","#b35d47"])}" />')
    b.append(f'<rect x="{fx-40}" y="340" width="{fw+80}" height="50" fill="#f1e6d6"/><rect x="{fx-40}" y="388" width="{fw+80}" height="10" fill="#000" opacity=".15"/>')
    b.append(f'<path d="M{fx+150},880 L{fx+150},600 Q{fx+350},500 {fx+550},600 L{fx+550},880Z" fill="#1a1210"/>')
    b.append(f'<g filter="url(#glow)"><path d="M{fx+250},860 Q{fx+230},760 {fx+290},700 Q{fx+290},760 {fx+330},740 Q{fx+340},660 {fx+380},640 Q{fx+370},730 {fx+420},720 Q{fx+470},780 {fx+450},860Z" fill="#ff7b29"/>'
             f'<path d="M{fx+290},860 Q{fx+280},790 {fx+320},760 Q{fx+330},800 {fx+360},780 Q{fx+380},740 {fx+400},730 Q{fx+420},800 {fx+410},860Z" fill="#ffd166"/></g>')
    b.append(f'<rect x="{fx+230}" y="850" width="240" height="26" rx="12" fill="#5a3a22" transform="rotate(-6 {fx+350} 860)"/><rect x="{fx+230}" y="850" width="240" height="26" rx="12" fill="#4a2f1b" transform="rotate(7 {fx+350} 860)"/>')
    for k, (col, cuff) in enumerate([("#c8102e", "#fff"), ("#1f6b4a", "#fff"), ("#c8102e", "#f2c14e")]):
        x = fx + 140 + k * 210
        b.append(f'<path d="M{x},395 L{x},520 Q{x},560 {x-40},560 L{x-70},560 Q{x-100},560 {x-100},590 Q{x-100},620 {x-60},620 L{x+10},620 Q{x+60},620 {x+60},560 L{x+60},395Z" fill="{col}"/>')
        b.append(f'<rect x="{x-6}" y="392" width="72" height="42" rx="8" fill="{cuff}"/>')
        b.append(f'<path d="M{x},470 l60,0 M{x},500 l60,0" stroke="#fff" stroke-width="6" stroke-dasharray="8 8" opacity=".8"/>')
    for i in range(46):
        t = i / 45; x = fx - 40 + (fw + 80) * t; y = 330 + math.sin(t * math.pi * 3) * 14
        b.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="18" fill="{rnd.choice(["#1b4332","#2d6a4f","#245c45"])}"/>')
    for i in range(14):
        t = (i + .5) / 14; x = fx - 40 + (fw + 80) * t; y = 330 + math.sin(t * math.pi * 3) * 14
        b.append(f'<circle cx="{f(x)}" cy="{f(y+4)}" r="7" fill="{["#ffd166","#ff6b6b","#7fd1ff"][i%3]}" filter="url(#glow)"/>')
    b.append(pine(1290, 880, 300, 560, "#2d6a4f", layers=4))
    for k in range(20):
        b.append(f'<circle cx="{f(1290+rnd.uniform(-1,1)*(40+k*6))}" cy="{f(380+k*22)}" r="8" fill="{rnd.choice(["#ffd166","#ff6b6b","#ffffff"])}" filter="url(#glow)"/>')
    b.append(star(1290, 320, 30, "#ffd166", extra='filter="url(#glow)"'))
    b.append(gift(1180, 820, 90, 60, "#c8102e", "#f2c14e")); b.append(gift(1310, 830, 80, 50, "#f2c14e", "#c8102e"))
    b.append(f'<ellipse cx="750" cy="950" rx="420" ry="40" fill="#c8102e" opacity=".85"/><ellipse cx="750" cy="950" rx="380" ry="30" fill="none" stroke="#f1e6d6" stroke-width="4" stroke-dasharray="14 10"/>')
    return svg("".join(b))

SCENES = [s01_red_baubles, s02_pattern_cream, s03_navy_greeting, s04_snowy_village, s05_flatlay_gifts,
          s06_geometric_tree, s07_gnomes, s08_wreath, s09_pastel_trees, s10_gold_bokeh,
          s11_snowman, s12_gingerbread_pattern, s13_candy_frame, s14_tropical, s15_reindeer_moon,
          s16_sale_banner, s17_cocoa, s18_lineart, s19_snowflakes_blue, s20_fireplace]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for i, fn in enumerate(SCENES, 1):
        name = f"christmas_{i:02d}_{fn.__name__[4:]}.svg"
        open(os.path.join(OUT, name), "w").write(fn())
        print(name)
