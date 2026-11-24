"""Build the two modular fortification kits with the SolidCraft command-line engine."""
import argparse
import math
from pathlib import Path
import subprocess
import tempfile
import json

ROOT = Path(__file__).resolve().parents[1]
WOOD = ["#8e5025", "#a15d2a", "#b16e32", "#925626", "#ae642b"]
CUT = ["#cf8b43", "#d99b55", "#bb7538"]
BEAM = "#6b3b23"
IRON = "#454348"
STRAW = ["#b8792c", "#cf923b", "#dfaa50", "#bd8636"]
STONE = ["#847e6e", "#a09882", "#b3aa8d", "#928c78"]


class Kit:
    def __init__(self):
        self.steps = []
        self.colors = {}
        self.prefix = ""
        self.offset = 0

    def add(self, command, **params):
        self.steps.append(dict(command=command, params=params))

    def body(self, command, label, color, **params):
        name = self.prefix + "_" + label
        self.add(command, name=name, body_name=name, operation="new", **params)
        self.colors.setdefault(color, []).append(name)
        return name

    def box(self, label, color, x, y, z, length, width, height, tilt=0):
        origin = [x + self.offset, y, z]
        name = self.body("solid.box", label, color, center=origin,
                         length=length, width=width, height=height)
        if tilt:
            self.add("solid.move", name=name + "_inclinação", bodies=[name],
                     axis=[1, 0, 0], angle=tilt, origin=origin)
        return name

    def profile(self, label, plane, offset, points):
        sketch = self.prefix + "_" + label + "_perfil"
        self.add("sketch.create", name=sketch, plane=plane, offset=offset)
        self.add("sketch.line", points=points, closed=True)
        self.add("sketch.constraint.fix", entities=[f"l{i+1}.start" for i in range(len(points))], fixed=True)
        self.add("sketch.solve")
        self.add("sketch.finish")
        return sketch

    def hip(self, label, color, x, y, z, span, crown, height):
        def section(size, suffix, elevation):
            return self.profile(label + suffix, "XY", elevation, [
                [self.offset + x + dx * size / 2, y + dy * size / 2]
                for dx, dy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
            ])
        lower = section(span, "_beiral", z)
        upper = section(crown, "_topo", z + height)
        self.body("solid.loft", label, color, sections=[{"sketch": lower}, {"sketch": upper}])

    def carved_post(self, label, color, x, y, z, radius, height, top):
        sides = 7
        def section(r, suffix, elevation):
            return self.profile(label + suffix, "XY", elevation, [
                [self.offset + x + r*math.cos(angle), y + r*math.sin(angle)]
                for angle in (2*math.pi*i/sides for i in range(sides))
            ])
        lower = section(radius, "_pé", z)
        upper = section(top, "_topo", z+height)
        self.body("solid.loft", label, color, sections=[{"sketch": lower}, {"sketch": upper}])

    def stakes(self, level, x, width, tag="", y=0):
        footing = 420 if level == 2 else -100
        count = round(width / 460)
        pitch = width / count
        for i in range(count):
            px = x - width/2 + (i+.5)*pitch
            top = 2840 + (i*173 + 80) % 450 + (480 if level == 2 else 0)
            radius = pitch * (.48 + i%3*.015)
            name = f"{tag}estaca_{i+1}"
            self.carved_post(name, WOOD[i % len(WOOD)], px, y, footing, radius, top-footing, radius*.84)
            self.carved_post(name + "_ponta", CUT[i % len(CUT)], px, y, top, radius*.84, 385+(i%3)*68, 5)
        for rail, height in enumerate([820, 2240] if level == 1 else [1040, 2460]):
            for face in [-1, 1]:
                self.box(f"{tag}viga_{rail}_{face}", BEAM, x, y+face*217, height, width, 114, 164)
                for pin in range(1, count, 3):
                    px = x-width/2+(pin+.5)*pitch
                    self.box(f"{tag}prego_{rail}_{face}_{pin}", IRON, px, y+face*280, height, 65, 30, 63)
        if level == 2:
            self.foundation(x, y, width, 890, tag)

    def foundation(self, x, y, width, depth, tag=""):
        self.box(tag+"argamassa", "#625b4e", x, y, 105, width-12, depth-68, 620)
        for row in range(2):
            n = math.ceil(width / 800)
            joints = [0] + [(i + .25*(row*2-1))*width/n for i in range(1, n)] + [width]
            for i, (left, right) in enumerate(zip(joints, joints[1:])):
                self.box(f"{tag}pedra_{row}_{i}", STONE[(row*2+i)%4],
                         x-width/2+(left+right)/2, y, row*290-42,
                         right-left-32, depth-(row*45)+(i*17)%40, 266+(i*13)%24)

    def gable(self, width, depth, height, rise):
        # Custom sketch plane: horizontal profile axis runs toward the front.
        plane = {"origin": [self.offset-width/2, 0, height], "x_dir": [0, 1, 0], "y_dir": [0, 0, 1]}
        half = depth/2
        self.profile("empena", plane, 0, [[-half, -125], [half, -125], [half, 0],
                                          [0, rise], [-half, 0]])
        self.body("solid.extrude", "empena", STRAW[0], distance=width)
        slope = math.degrees(math.atan2(rise, half))
        for face in [-1, 1]:
            for row in range(4):
                along = (row+.56)*half/4
                for tile in range(12):
                    x = -width/2+(tile+.5)*width/12
                    self.box(f"colmo_{face}_{row}_{tile}", STRAW[(tile*7+row*3+face)%4],
                             x, face*along, height+rise*(1-along/half)+51+(tile*17%40),
                             width/12-14, math.hypot(half,rise)*.30, 122, -face*slope)
        self.box("cumeeira", STRAW[2], 0, 0, height+rise+34, width+160, 220, 159)

    def gate(self, level):
        self.prefix, self.offset = "gate", 12000
        for side in [-1, 1]:
            self.stakes(level, side*3000, 2000, f"ala_{side}_")
            self.box(f"pilar_{side}", BEAM, side*2100, 0, 1730, 370, 680, 3950)
            if level == 2:
                self.tower_top(side*2970, 0, 1830, 4330, f"guarita_{side}_")
        self.box("verga", BEAM, 0, 0, 3040, 4530, 660, 270)
        self.gable(4780, 1790, 3200 if level == 1 else 3350, 980 if level == 1 else 720)
        for side, prefix in [(-1, "left"), (1, "right")]:
            self.prefix = prefix
            for i in range(7):
                x = side*(1960-(i+.5)*279)
                self.box(f"tabua_{i+1}", WOOD[i%5], x, 0, 1488, 268, 165, 2890+(i*17)%76)
            for row, height in enumerate([680, 2330]):
                self.box(f"travessa_{row}", BEAM, side*990, -97, height, 1910, 112, 190)
                self.box(f"ferragem_{row}", IRON, side*1374, -171, height, 1070, 48, 109)
                for pin in range(4):
                    self.box(f"rebite_{row}_{pin}", "#c29a62", side*(925+pin*270), -202,
                             height, 58, 28, 58)
            self.box("ferrolho", IRON, side*223, -136, 1460, 350, 81, 141)

    def tower_top(self, x, y, width, floor, tag):
        edge = width * .40
        self.box(tag+"piso", BEAM, x, y, floor, width, width, 240)
        for i, (dx, dy) in enumerate([(-1, -1), (-1, 1), (1, -1), (1, 1)]):
            px, py = x+dx*edge, y+dy*edge
            self.box(f"{tag}esteio_{i}", BEAM, px, py, floor-1980, 260, 280, 4140)
            self.box(f"{tag}balaustre_{i}", WOOD[1], px, py, floor+850, 218, 232, 1700)
        for face in [-1, 1]:
            self.box(f"{tag}guarda_frente_{face}", WOOD[2], x, y+face*edge, floor+500,
                     width, 162, 165)
            self.box(f"{tag}guarda_lado_{face}", WOOD[2], x+face*edge, y, floor+500,
                     162, width, 165)
        for row in range(4):
            span = width*(1.34-.28*row)
            self.hip(f"{tag}palha_{row}", STRAW[row], x, y, floor+1570+row*277, span, span-width*.29, 333)
        self.carved_post(tag+"remate", CUT[1], x, y, floor+2670, 150, 375, 32)
        front = y-edge-115
        self.box(tag+"haste", BEAM, x, front, floor+680, 840, 95, 90)
        plane = {"origin": [self.offset, front, 0], "x_dir": [1, 0, 0], "y_dir": [0, 0, 1]}
        self.profile(tag+"bandeira", plane, 0, [
            [x-310,floor+645], [x+310,floor+645], [x+310,floor-1320],
            [x,floor-1500], [x-310,floor-1320]
        ])
        self.body("solid.extrude", tag+"bandeira", "#a52e1d", distance=48)
        self.box(tag+"borda", "#e2ab4d", x, front-52, floor+552, 620, 21, 55)
        self.profile(tag+"brasão", {**plane, "origin": [self.offset, front-51, 0]}, 0, [
            [x,floor+350], [x+210,floor+60], [x+145,floor-262], [x,floor-443],
            [x-145,floor-262], [x-210,floor+60]
        ])
        self.body("solid.extrude", tag+"brasão", "#e9b650", distance=17)

    def corner_tower(self, level):
        self.prefix, self.offset = "tower", 23000
        # Four arms reach the same modular seams as the existing perimeter.
        self.stakes(level, 0, 6000, "frente_")
        self.stakes(level, 0, 6000, "lado_")
        names = [name for bodies in self.colors.values() for name in bodies if name.startswith("tower_lado_")]
        self.add("solid.move", name="Girar a paliçada da esquina", bodies=names,
                 angle=90, origin=[self.offset, 0, 0])
        if level == 2:
            self.foundation(0, 0, 2910, 3000, "torre_")
            self.tower_top(0, 0, 2920, 4640, "torre_")

    def build(self, level):
        self.prefix, self.offset = "wall", 0
        self.stakes(level, 0, 4000)
        self.gate(level)
        self.corner_tower(level)
        for color, bodies in self.colors.items():
            self.add("appearance.assign", bodies=bodies, color=color,
                     pbr={"roughness": .72 if color == IRON else .91, "metallic": .22 if color == IRON else 0, "dielectric_ior": 1.5})
        return self.steps


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("level", type=int, choices=[1, 2])
    args = parser.parse_args()
    name = f"muralhas-nivel-{args.level}"
    with tempfile.TemporaryDirectory() as tmp:
        script = Path(tmp) / "kit.json"
        script.write_text(json.dumps(Kit().build(args.level)))
        subprocess.run([
            "solidcraft-cli", "run", str(script), "--quiet",
            "--save", str(ROOT / "models" / f"{name}.sc"),
            "--out", str(ROOT / "src" / "assets" / f"{name}.glb"),
        ], check=True)


if __name__ == "__main__":
    main()
