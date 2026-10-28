# Ícone do MHLAUNCHER: o brasão de uma guilda de caçadores, em pixel art 64x64 (desenho próprio, nada da Capcom):
# um wyvern de frente com as asas abertas sobre duas espadas cruzadas, num selo redondo de couro com borda em brasa.
# Desenhado com formas sem suavização (cada pixel é um pixel) e ampliado sem borrar para 256 e 512 px.
# Rodar: python icone_brasao.py -> icon.png (512), ../src/renderer/img/icone.png (256) e icon.ico
import os, sys
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(sys.argv[0]))
N = 64
C = {
    "borda": (226, 96, 63), "borda2": (150, 52, 32), "couro": (42, 33, 27), "couro2": (31, 25, 20), "anel": (92, 62, 38),
    "aco": (214, 222, 206), "aco2": (138, 150, 132), "ouro": (233, 186, 111), "ouro2": (181, 132, 58), "contorno": (14, 9, 8),
    "rubro": (196, 52, 38), "rubro2": (238, 100, 68), "rubro3": (120, 28, 22), "membrana": (150, 40, 30), "olho": (255, 222, 120),
}
im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
cx = cy = 31.5

# ---- selo: borda em brasa, anel de couro escuro, fundo de couro com um pontilhado
d.ellipse((1, 1, 62, 62), fill=C["contorno"])
d.ellipse((2, 2, 61, 61), fill=C["borda"])
d.ellipse((4, 4, 59, 59), fill=C["borda2"])
d.ellipse((5, 5, 58, 58), fill=C["anel"])
d.ellipse((7, 7, 56, 56), fill=C["couro"])
for y in range(8, 56):
    for x in range(8, 56):
        if (x + y) % 4 == 0 and (x - cx) ** 2 + (y - cy) ** 2 < 23 ** 2 and (x * 7 + y * 3) % 5 == 0:
            im.putpixel((x, y), C["couro2"] + (255,))
# luz da borda em cima à esquerda
for y in range(2, 30):
    for x in range(2, 30):
        r = ((x - cx) ** 2 + (y - cy) ** 2) ** .5
        if 28.6 < r < 29.6 and x + y < 40:
            im.putpixel((x, y), (255, 160, 110, 255))


# ---- duas espadas cruzadas atrás do wyvern (lâmina, guarda dourada, cabo e pomo)
def espada(x0, y0, x1, y1, lado):
    d.line((x0, y0, x1, y1), fill=C["contorno"], width=5)
    d.line((x0, y0, x1, y1), fill=C["aco2"], width=3)
    d.line((x0 + lado, y0, x1 + lado, y1), fill=C["aco"], width=1)


espada(14, 14, 47, 47, 1)
espada(49, 14, 16, 47, -1)
for (gx, gy, hx, hy, px, py) in [(43, 43, 48, 48, 51, 51), (20, 43, 15, 48, 12, 51)]:
    d.line((gx - 4, gy + 4, gx + 4, gy - 4) if gx > 32 else (gx - 4, gy - 4, gx + 4, gy + 4), fill=C["contorno"], width=4)
    d.line((gx - 3, gy + 3, gx + 3, gy - 3) if gx > 32 else (gx - 3, gy - 3, gx + 3, gy + 3), fill=C["ouro"], width=2)
    d.line((gx, gy, hx, hy), fill=C["contorno"], width=4)
    d.line((gx, gy, hx, hy), fill=(107, 68, 38), width=2)
    d.rectangle((px - 2, py - 2, px + 1, py + 1), fill=C["contorno"])
    d.rectangle((px - 1, py - 1, px, py), fill=C["ouro"])

# ---- o wyvern: asas abertas (osso em cima, membrana com a borda recortada), corpo, cabeça com chifres, cauda
asa_e = [(29, 26), (22, 19), (14, 15), (8, 18), (10, 22), (9, 27), (12, 30), (12, 35), (16, 34), (19, 38), (23, 35), (27, 38), (29, 33)]
asa_d = [(63 - x, y) for (x, y) in asa_e]
for asa in (asa_e, asa_d):
    d.polygon(asa, fill=C["contorno"])
    inner = [(x + (1 if x < 32 else -1), y + 1) for (x, y) in asa]
    d.polygon(inner, fill=C["membrana"])
# ossos das asas (dedos) em vermelho claro
for (a, b) in [((29, 26), (14, 16)), ((22, 20), (10, 23)), ((20, 20), (12, 31)), ((20, 21), (18, 36)), ((24, 24), (24, 34))]:
    d.line((a, b), fill=C["rubro2"], width=1)
    d.line(((63 - a[0], a[1]), (63 - b[0], b[1])), fill=C["rubro2"], width=1)
# cauda curvada para baixo
d.line(((32, 38), (33, 44), (36, 48), (40, 49)), fill=C["contorno"], width=5, joint="curve")
d.line(((32, 38), (33, 44), (36, 48), (40, 49)), fill=C["rubro3"], width=3, joint="curve")
d.polygon([(39, 46), (44, 49), (39, 52)], fill=C["contorno"])
d.polygon([(40, 47), (42, 49), (40, 51)], fill=C["rubro"])
# corpo e pernas
d.ellipse((26, 24, 37, 41), fill=C["contorno"])
d.ellipse((27, 25, 36, 40), fill=C["rubro"])
d.ellipse((29, 27, 33, 36), fill=C["rubro2"])
for lx in (27, 35):
    d.rectangle((lx - 1, 38, lx + 1, 42), fill=C["contorno"])
    d.point((lx, 39), fill=C["rubro3"])
    d.point((lx, 40), fill=C["rubro3"])
# pescoço e cabeça
d.rectangle((29, 18, 34, 26), fill=C["contorno"])
d.rectangle((30, 19, 33, 26), fill=C["rubro"])
d.polygon([(26, 15), (31, 10), (32, 10), (37, 15), (36, 20), (32, 23), (31, 23), (27, 20)], fill=C["contorno"])
d.polygon([(27, 15), (31, 11), (32, 11), (36, 15), (35, 19), (32, 22), (31, 22), (28, 19)], fill=C["rubro"])
d.line(((29, 14), (31, 12)), fill=C["rubro2"])
# chifres para trás e para cima
for s in (-1, 1):
    x = 31.5 + s * 4
    d.line(((x, 12), (x + s * 2, 9), (x + s * 4, 8)), fill=C["contorno"], width=3)
    d.line(((x, 12), (x + s * 2, 9), (x + s * 4, 8)), fill=C["ouro"], width=1)
# olhos dourados e a boca com presas
for ex in (29, 34):
    d.point((ex, 16), fill=C["olho"])
d.line(((29, 20), (34, 20)), fill=C["contorno"])
for tx in (30, 33):
    d.point((tx, 21), fill=(242, 233, 216))

im.resize((512, 512), Image.NEAREST).save(os.path.join(AQUI, "icon.png"))
im.resize((256, 256), Image.NEAREST).save(os.path.join(AQUI, "..", "src", "renderer", "img", "icone.png"))
im.resize((256, 256), Image.NEAREST).save(os.path.join(AQUI, "icon.ico"), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("ok")
