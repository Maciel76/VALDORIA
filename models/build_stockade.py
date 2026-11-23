"""Build the original level-one stockade with Blender's Python API."""
from math import cos, pi, sin, sqrt
from pathlib import Path
from random import Random

import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
TEXTURES = PROJECT / ".valdoria" / "stockade-textures"
TEXTURES.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "Castelo Nível 1 | Paliçada de Valdória"
scene.unit_settings.system = "METRIC"
rng = Random(452307)


def point(x, y, z):
    """Convert game metres (Y up) to Blender metres (Z up)."""
    return (x, -z, y)


def collection(name):
    result = bpy.data.collections.new(name)
    scene.collection.children.link(result)
    return result


land = collection("01 • Terreno, lajes e vegetação")
wall = collection("02 • Paliçada e portão")
lodge = collection("03 • Casa da guarnição")
tower = collection("04 • Torre de vigia")
props = collection("05 • Objetos do pátio")
motion = collection("06 • Bandeiras")
presentation = collection("07 • Estúdio de visualização")
materials = {}


def texture(name, kind, rgb, seed):
    size = 256
    y, x = np.mgrid[0:size, 0:size] / size
    noise = np.random.default_rng(seed).standard_normal((size, size))
    wood = np.sin(x * 112 + np.sin(y * 15 + x * 2) * 1.8)
    wood += .57 * np.sin(x * 307 + np.cos(y * 12) * 2.5)
    if kind == "wood":
        value = .10 * wood + .05 * np.sin(x * 35 + np.sin(y * 7)) + noise * .038
        grain = np.sin(x * 31 + y * 2)
        value -= .18 * (grain > .96) * (.65 + .35 * np.sin(y * 13))
    elif kind == "thatch":
        value = .105 * wood + .10 * np.sin(x * 432 + np.sin(y * 13)) + noise * .041
        value -= .23 * np.clip((y % .25 - .208) * 19, 0, 1)
        value += .051 * np.sin(x * 67 + y * 10)
    elif kind == "cloth":
        value = .021 * (np.sin(y * 460) + np.sin(x * 420)) + noise * .025
    else:
        value = .047 * (np.sin(x * 40 + y * 19) + np.sin(y * 61 - x * 21))
        value += .069 * noise + np.cos(x * 10 - y * 13) * .055
    image = np.clip(np.array(rgb)[None, None, :] * (1 + value[:, :, None]), 0, 1)
    if kind == "cloth":
        # The heraldic sun is painted into the cloth texture, so it deforms with the fabric.
        if seed == 93:
            border = (x < .062) | (x > .938) | (y > .93) | (y < .065)
            ax, ay = x - .5, y - .55
            radius, direction = np.hypot(ax, ay * .86), np.arctan2(ay * .86, ax)
            trim = border | (radius < .113) | ((radius < .221) & (radius > .139) & (np.cos(direction * 8) > .81))
        else:
            border = (y < .07) | (y > .93) | (x < .045)
            trim = border | ((np.abs(x-.32) + .86*np.abs(y-.5)) < .119)
        image[trim] = np.clip(np.array([.81, .57, .23]) * (1 + value[trim, None]), 0, 1)
    alpha = np.ones((size, size, 1))
    pixels = np.concatenate((image, alpha), axis=2).astype(np.float32)
    # Blender writes generated float pixels through its color management pipeline.
    pixels[:, :, :3] = np.where(pixels[:, :, :3] <= .04045,
                                 pixels[:, :, :3] / 12.92, ((pixels[:, :, :3] + .055) / 1.055) ** 2.4)
    item = bpy.data.images.new(name, width=size, height=size, alpha=True, float_buffer=True)
    item.pixels.foreach_set(pixels.ravel())
    item.filepath_raw = str(TEXTURES / (name + ".png"))
    item.file_format = "PNG"
    item.save()
    result = bpy.data.images.load(item.filepath_raw, check_existing=False)
    result.name = name
    result.pack()
    bpy.data.images.remove(item)
    return result


def material(name, rgb, kind=None, seed=3, rough=.93, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*rgb, 1)
    surface = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    surface.inputs["Base Color"].default_value = (*rgb, 1)
    surface.inputs["Roughness"].default_value = rough
    surface.inputs["Metallic"].default_value = metallic
    if kind:
        image = mat.node_tree.nodes.new("ShaderNodeTexImage")
        image.name = "Textura original de " + name
        image.image = texture(name, kind, rgb, seed)
        mat.node_tree.links.new(image.outputs["Color"], surface.inputs["Base Color"])
    materials[name] = mat


material("Cedro", (.43, .248, .123), "wood", 13)
material("Cedro claro", (.59, .365, .180), "wood", 17)
material("Carvalho escuro", (.30, .181, .094), "wood", 31)
material("Madeira cortada", (.66, .43, .207), "wood", 53)
material("Palha dourada", (.74, .515, .241), "thatch", 27)
material("Palha envelhecida", (.59, .403, .179), "thatch", 29)
material("Terra batida", (.47, .327, .173), "stone", 42)
material("Relva", (.37, .433, .169), "stone", 43)
material("Pedra cinza", (.45, .453, .397), "stone", 62)
material("Pedra clara", (.61, .59, .466), "stone", 67)
material("Estopa", (.46, .352, .207), "cloth", 68)
material("Ferro antigo", (.14, .126, .108), "stone", 81, .61, .44)
material("Guarda de ferro", (.16, .148, .128), None, rough=.60, metallic=.35)
material("Latão", (.60, .353, .111), None, rough=.64, metallic=.22)
material("Tecido do Sol", (.54, .152, .085), "cloth", 93)
material("Flâmula rubra", (.57, .128, .068), "cloth", 95)
material("Escuro", (.069, .045, .026))
material("Musgo", (.151, .219, .052))
material("Folha viva", (.292, .406, .092))
material("Folha seca", (.43, .416, .13))
material("Flor", (.92, .676, .232))
material("Fruto", (.57, .157, .066))
material("Fogo de apresentação", (.95, .31, .043))
fire_surface = next(n for n in materials["Fogo de apresentação"].node_tree.nodes if n.type == "BSDF_PRINCIPLED")
fire_surface.inputs["Emission Color"].default_value=(1,.165,.024,1)
fire_surface.inputs["Emission Strength"].default_value=3.2


class Part:
    """Make one editable mesh per component, with material-specific face UVs."""
    def __init__(self, name, target, parent=None):
        self.name = name
        self.target = target
        self.parent = parent
        self.verts = []
        self.faces = []
        self.mats = []
        self.uvs = []

    def polygon(self, vertices, mat, uvs=None):
        begin = len(self.verts)
        self.verts.extend(point(*item) for item in vertices)
        self.faces.append(tuple(range(begin, begin + len(vertices))))
        self.mats.append(mat)
        self.uvs.append(uvs or ([(0, 0), (1, 0), (1, 1), (0, 1)] if len(vertices) == 4 else
                                [(cos(i * 2 * pi / len(vertices)) * .45+.5,
                                  sin(i * 2 * pi / len(vertices)) * .45+.5) for i in range(len(vertices))]))

    def box(self, position, size, material_name, degrees=0):
        px, py, pz = position
        w, h, d = size
        angle = degrees * pi / 180
        corners = [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
                   (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
        vertices = [(px + w*x/2*cos(angle) + d*z/2*sin(angle), py + h*y/2,
                     pz - w*x/2*sin(angle) + d*z/2*cos(angle)) for x,y,z in corners]
        for face in [(0, 3, 2, 1), (4, 5, 6, 7), (0, 4, 7, 3), (1, 2, 6, 5), (0, 1, 5, 4), (3, 7, 6, 2)]:
            uv = [(0,0),(0,1),(1,1),(1,0)] if face in [(0,3,2,1),(1,2,6,5)] else [(0,0),(1,0),(1,1),(0,1)]
            self.polygon([vertices[i] for i in face], material_name, uv)

    def beam(self, a, b, width, depth, mat):
        a, b = Vector(a), Vector(b)
        axis = (b - a).normalized()
        other = Vector((0,0,1)) if abs(axis.z) < .90 else Vector((1,0,0))
        u = axis.cross(other).normalized() * width / 2
        v = u.cross(axis).normalized() * depth / 2
        bottom = [a - u - v,a + u - v,a + u + v,a - u + v]
        top = [b - u - v,b + u - v,b + u + v,b - u + v]
        # Determine the ring order from its outward normal at the first cap.
        if (bottom[1]-bottom[0]).cross(bottom[2]-bottom[1]).dot(axis) > 0:
            bottom.reverse()
            top.reverse()
        self.polygon(bottom, mat)
        self.polygon(top[::-1], mat)
        for i in range(4):
            j = (i + 1) % 4
            self.polygon([bottom[i],top[i],top[j],bottom[j]],mat,
                         [(0,0),(0,1),(1,1),(1,0)])

    def post(self, x, z, y, h, radius, mat, taper=.8, tip=0, sides=7):
        origin = rng.random() * 2 * pi
        angles = [origin + i * 2 * pi / sides for i in range(sides)]
        variation = [rng.uniform(.88,1.10) for _ in angles]
        drift = (rng.uniform(-.10,.10),rng.uniform(-.10,.10))
        foot = [(x + r*radius*cos(a),y,z + r*radius*sin(a)) for a,r in zip(angles,variation)]
        neck = [(x + drift[0] + r*radius*taper*cos(a),y+h,
                 z + drift[1] + r*radius*taper*sin(a)) for a,r in zip(angles,variation)]
        for i in range(sides):
            j = (i+1) % sides
            self.polygon([foot[i],neck[i],neck[j],foot[j]],mat,[(0,0),(0,1),(1,1),(1,0)])
            if tip:
                top = (x + drift[0]*1.7,y+h+tip,z+drift[1]*1.7)
                self.polygon([neck[i],top,neck[j]],"Madeira cortada",[(0,0),(.52,1),(1,0)])
        self.polygon(foot,mat)
        if not tip:
            self.polygon(neck[::-1],mat)

    def rock(self, x, z, y, rx, rz, h, mat):
        a = rng.random() * pi
        ring = [(x+rx*cos(a+i*pi/4)*rng.uniform(.79,1.07),y,
                 z+rz*sin(a+i*pi/4)*rng.uniform(.88,1.10)) for i in range(8)]
        top = [(x+(u-x)*.65+rng.uniform(-.15,.15)*rx,y+h*rng.uniform(.65,1.1),
                z+(w-z)*.64+rng.uniform(-.13,.13)*rz) for u,_,w in ring]
        for i in range(8):
            j=(i+1)%8
            self.polygon([ring[i],top[i],top[j],ring[j]],mat)
        self.polygon(top[::-1], mat)

    def finish(self):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.verts, [], self.faces)
        mesh.update()
        ordered = list(dict.fromkeys(self.mats))
        for name in ordered:
            mesh.materials.append(materials[name])
        indices = {n:i for i,n in enumerate(ordered)}
        uv = mesh.uv_layers.new(name="Textura")
        flat_uv = [c for face in self.uvs for pair in face for c in pair]
        uv.uv.foreach_set("vector", flat_uv)
        for polygon, name in zip(mesh.polygons, self.mats):
            polygon.material_index = indices[name]
        model = bpy.data.objects.new(self.name, mesh)
        self.target.objects.link(model)
        model.parent = self.parent
        return model


def empty(name, target, position):
    pivot = bpy.data.objects.new(name,None)
    target.objects.link(pivot)
    pivot.location = point(*position)
    return pivot


def platform(x, z, width, depth, floor, target):
    part = Part("Piso elevado e fundação", target)
    outline = [(-1,-.87),(-.87,-1),(.87,-1),(1,-.87),(1,.87),(.87,1),(-.87,1),(-1,.87)]
    top = [(x+u*width/2,floor,z+v*depth/2) for u,v in outline]
    bottom = [(x+u*(width-.53)/2,floor-1.42,z+v*(depth-.53)/2) for u,v in outline]
    part.polygon(top[::-1],"Relva",[(u/width+.5,w/depth+.5) for u,_,w in top[::-1]])
    for i in range(8):
        j = (i+1)%8
        part.polygon([bottom[i],top[i],top[j],bottom[j]],"Terra batida")
    part.finish()


def patch(part,x,z,w,d,m,y=.214):
    part.polygon([(x-w/2,y,z-d/2),(x-w/2,y,z+d/2),(x+w/2,y,z+d/2),(x+w/2,y,z-d/2)],m)


def paths():
    paving = Part("Trilha irregular de terra e lajes", land)
    for i in range(15):
        z=-1.7+i*1.13
        x = sin(z*.40)*.34
        w=3.0 if z>8 else 3.2
        patch(paving,x,z,w,1.18,"Terra batida",.218+i*.00009)
        for _ in range(3):
            xx=x+rng.uniform(-1.6,1.6)
            paving.rock(xx,z+rng.uniform(-.43,.43),.206,rng.uniform(.18,.73),rng.uniform(.14,.44),rng.uniform(.013,.059),
                        rng.choice(["Pedra cinza","Pedra clara"]))
    for i in range(7):
        x=-.8-i*.91
        z=rng.uniform(.36,.79)
        patch(paving,x,z,1.0,1.62,"Terra batida",.222)
        paving.rock(x,z,.211,rng.uniform(.2,.6),.30,.028,"Pedra clara")
    # The threshold blends the raised plot into the terrain.
    for i in range(6):
        z=14+i*.44
        y=.21-(i/6)**1.55*.22
        paving.box((0,y-.03,z),(3.76,.085,.5),"Terra batida",rng.uniform(-1,1))
        paving.rock(rng.uniform(-1.4,1.4),z,y,.53,.29,.052,"Pedra clara")
    paving.finish()


def palisade():
    logs = Part("Estacas de cedro com pontas lavradas", wall)
    braces = Part("Travessas, cordas e contraventamentos", wall)
    ramp = [(-15,-11.1),(-12.6,-13.5),(12.6,-13.5),(15,-11.1),(15,11.1),(12.6,13.5),(2.36,13.5)]
    left = [( -2.36,13.5),(-12.6,13.5),(-15,11.1),(-15,-11.1)]
    for path in (ramp,left):
        for a,b in zip(path,path[1:]):
            span = sqrt((b[0]-a[0])**2 + (b[1]-a[1])**2)
            n = round(span/.61)
            for i in range(n):
                fraction = (i+.5)/n
                x=a[0]+(b[0]-a[0])*fraction
                z=a[1]+(b[1]-a[1])*fraction
                h=rng.uniform(2.91,3.62)
                radius=rng.uniform(.29,.332)
                timber=rng.choice(["Cedro","Cedro","Cedro claro","Carvalho escuro"])
                logs.post(x,z,.08,h,radius,timber,taper=rng.uniform(.72,.91),tip=rng.uniform(.46,.74))
                if i%5==1:
                    x2=x*.975
                    z2=z*.975
                    braces.beam((x2*.94,.23,z2*.94),(x2,2.67,z2),.19,.22,"Carvalho escuro")
            for height in (.67,2.16):
                braces.beam((a[0]*.978,height,a[1]*.978),(b[0]*.978,height,b[1]*.978),.19,.22,"Carvalho escuro")
    for side in (-1,1):
        x=side*2.49
        logs.post(x,13.39,.13,3.76,.40,"Carvalho escuro",.87,.34,8)
        logs.post(side*3.16,13.46,.18,3.55,.33,"Cedro claro",.78,.53)
        braces.box((x,.36,13.39),(.92,.29,.87),"Pedra cinza",side*3)
        braces.box((x,3.19,13.39),(.74,.091,.75),"Guarda de ferro")
    logs.finish()
    braces.finish()


def gate():
    for side, name in [(-1,"PortaoEsquerda"),(1,"PortaoDireita")]:
        pivot = empty(name,wall,(side*2.36,0,13.33))
        leaf = Part("Tábuas e ferrolho "+name,wall,pivot)
        for i in range(7):
            x = -side*(i+.55)*2.28/7
            h = 2.9 + cos(i/7*pi/2)*.18 + rng.uniform(-.13,.08)
            leaf.box((x,.18+h/2,0),(2.28/7-.014,h,.198),
                     rng.choice(["Cedro","Cedro claro","Cedro","Carvalho escuro"]),rng.uniform(-.34,.34))
        for y in (.66,2.42):
            leaf.box((-side*1.15,y,.144),(2.30,.20,.106),"Carvalho escuro")
            leaf.box((-side*1.36,y,.207),(1.65,.12,.046),"Ferro antigo")
            for x in (.69,1.23,1.75,2.06):
                leaf.box((-side*x,y+.012,.242),(.064,.056,.041),"Guarda de ferro",side*12)
        leaf.beam((-side*.13,.71,-.148),(-side*2.18,2.72,-.148),.21,.13,"Carvalho escuro")
        leaf.box((-side*2.03,1.43,.25),(.34,.15,.11),"Ferro antigo")
        leaf.box((-side*2.16,1.48,.32),(.10,.19,.085),"Latão")
        leaf.finish()
        for frame,angle in [(1,0),(18,0),(52,-1.52*side),(86,-1.52*side),(120,0)]:
            pivot.rotation_euler.z=angle
            pivot.keyframe_insert(data_path="rotation_euler",index=2,frame=frame,group="Abrir e fechar o portão")


def roof(part, cx, cz, w, d, y, height, hip=0):
    # The layers overlap like bundled thatch, with individually cut ends and uneven lengths.
    for side in (-1,1):
        for row in range(5):
            f0=row/5
            f1=min(1,f0+.232)
            span0=w-2*hip*f0
            span1=w-2*hip*f1
            n=max(4,round(w/.52))
            for i in range(n):
                l0=(i/n-.5)*span0
                l1=((i+1.05)/n-.5)*span0
                r0=(i/n-.5)*span1
                r1=((i+1.05)/n-.5)*span1
                drip=rng.uniform(-.10,.047) if row==0 else rng.uniform(-.012,.021)
                z0=cz+side*(d/2*(1-f0)-drip)
                z1=cz+side*(d/2*(1-f1))
                y0=y+height*f0+drip*.19+.024*row
                y1=y+height*f1+.024*row
                corners=[(cx+l0,y0,z0),(cx+l1,y0+rng.uniform(-.032,.041),z0),
                         (cx+r1,y1,z1),(cx+r0,y1,z1)]
                mat="Palha envelhecida" if (i+row*3)%7 in (0,1) else "Palha dourada"
                if side < 0:
                    corners.reverse()
                part.polygon(corners,mat,[(0,0),(1,0),(1,1),(0,1)])
                a,b=corners[0],corners[1]
                overlay=[a,b,(b[0],b[1]-.105,b[2]),(a[0],a[1]-.10,a[2])]
                part.polygon(overlay,"Palha envelhecida")
    if hip:
        for side in (-1,1):
            vertices=[(cx+side*w/2,y,cz-d/2),(cx+side*w/2,y,cz+d/2),(cx+side*(w/2-hip),y+height+.08,cz)]
            part.polygon(vertices if side<0 else vertices[::-1],"Palha envelhecida")
    for i in range(max(3,round(w/.68))):
        n=max(3,round(w/.68))
        l=(w-hip*2)/n
        x=cx-w/2+hip+(i+.5)*l
        part.box((x,y+height+.10,cz),(l+.014,.134,.25),"Palha dourada",rng.uniform(-3,3))
    for x in (-1,1):
        for z in (-1,1):
            part.beam((cx+x*w/2,y-.08,cz+z*d/2),(cx+x*(w/2-hip),y+height-.08,cz),.11,.21,"Carvalho escuro")


def wall_planks(part, a, b, flat_y, h, gap=None):
    length = sqrt((b[0]-a[0])**2+(b[1]-a[1])**2)
    along_x = abs(b[0]-a[0]) > abs(b[1]-a[1])
    n = round(length/.39)
    for i in range(n):
        t=(i+.5)/n
        x=a[0]+(b[0]-a[0])*t
        z=a[1]+(b[1]-a[1])*t
        if gap and gap[0]<x<gap[1] and along_x:
            continue
        part.box((x,flat_y+h/2,z),(length/n-.015,h,.16) if along_x else (.16,h,length/n-.015),
                 rng.choice(["Cedro","Cedro","Cedro claro","Carvalho escuro"]))


def hall():
    frame = Part("Casa de guarda • pilares e vigas", lodge)
    faces = Part("Casa de guarda • vedações e piso", lodge)
    thatch = Part("Casa de guarda • cobertura de palha", lodge)
    cx,cz=-6.5,-4.1
    w,d=9.9,7.4
    faces.box((cx,.14,cz),(w+.17,.25,d+.20),"Pedra cinza")
    for i in range(16):
        faces.box((cx, .252,cz-d/2+(i+.5)*d/16),(w,.087,d/16-.014),"Cedro")
    wall_planks(faces,(cx-w/2,cz-d/2),(cx+w/2,cz-d/2),.21,2.70)
    wall_planks(faces,(cx-w/2,cz+d/2),(cx+w/2,cz+d/2),.21,2.68,(cx-1.05,cx+1.05))
    for sign in (-1,1):
        x=cx+sign*w/2
        wall_planks(faces,(x,cz-d/2),(x,cz+d/2),.21,2.71)
        for j in (-1,0,1):
            z=cz+j*d/2
            frame.box((x,1.64,z),(.25,2.91,.26),"Carvalho escuro")
        for z in (cz-d/2,cz+d/2):
            frame.box((cx,2.86,z),(w+.29,.26,.26),"Carvalho escuro")
            frame.beam((cx+sign*4.60,1.38,z+.097),(cx+sign*3.38,2.74,z+.097),.15,.13,"Cedro claro")
        frame.beam((x,.35,cz+d/2),(x,2.78,cz+.22),.16,.16,"Carvalho escuro")
        frame.box((cx+sign*1.02,1.59,cz+d/2),(.22,2.74,.29),"Cedro claro")
        frame.box((cx+sign*3.18,1.57,cz+d/2+.108),(1.01,.84,.083),"Escuro")
        for b in (-1,1):
            frame.box((cx+sign*3.18+b*.49,1.57,cz+d/2+.175),(.098,1,.087),"Cedro claro")
        frame.box((cx+sign*3.18,1.51,cz+d/2+.173),(.99,.092,.093),"Cedro claro")
    frame.box((cx,2.89,cz+d/2+.07),(2.28,.21,.28),"Carvalho escuro")
    # Open front portico, shallow plank landing, and a visible sign beam.
    for i in range(5):
        frame.box((cx,.15,cz+d/2+.22+i*.31),(w*.88,.15,.32),"Cedro claro")
    for side in (-1,1):
        x=cx+side*w*.42
        frame.post(x,cz+d/2+1.12,.25,2.08,.137,"Carvalho escuro",.92)
        frame.beam((x,1.79,cz+d/2+1.12),(x-side*.68,2.44,cz+d/2+1.10),.124,.13,"Cedro")
    frame.box((cx,2.39,cz+d/2+1.11),(w*.92,.19,.24),"Carvalho escuro")
    roof(thatch,cx,cz+.37,w+.95,d+2.43,2.82,2.95)
    # A plastered triangular gable closes each end of the large roof.
    for side in (-1,1):
        x=cx+side*w/2
        gable=[(x,2.80,cz-d/2),(x,5.52,cz+.37),(x,2.80,cz+d/2)]
        faces.polygon(gable[::-1] if side<0 else gable,"Cedro")
    frame.finish();faces.finish();thatch.finish()


def lookout():
    cx,cz=7.4,-6.9
    w=5.15
    base=6.00
    frame=Part("Torre • esteios e contraventamentos", tower)
    walk=Part("Torre • piso, guarda-corpo e escada", tower)
    canopy=Part("Torre • cobertura piramidal de palha", tower)
    for dx in (-1,1):
        for dz in (-1,1):
            x,z=cx+dx*2.26,cz+dz*2.22
            frame.box((x,4.49,z),(.43,8.6,.45),"Carvalho escuro",dx*.5)
            frame.box((x,.34,z),(.84,.35,.86),"Pedra cinza",dz*4)
            for h in (2.74,5.49,7.48):
                frame.box((x,h,z),(.52,.104,.56),"Guarda de ferro")
        for y in (3.44,5.80,7.61,8.63):
            frame.box((cx+dx*2.31,y,cz),(.24,.23,4.70),"Carvalho escuro")
        frame.beam((cx+dx*2.27,.62,cz-2.18),(cx+dx*2.27,5.66,cz+2.2),.24,.22,"Cedro")
        frame.beam((cx-2.25,.62,cz+dx*2.19),(cx+2.23,5.68,cz+dx*2.19),.225,.21,"Carvalho escuro")
    for dz in (-1,1):
        for y in (3.49,5.74,8.58):
            frame.box((cx,y,cz+dz*2.28),(4.93,.25,.24),"Carvalho escuro")
    for i in range(14):
        z=cz-w/2+(i+.5)*w/14
        walk.box((cx,base-.085,z),(w,.17,w/14-.014),"Cedro claro")
    for side in (-1,1):
        x=cx+side*w/2
        for i in range(10):
            z=cz-w/2+(i+.5)*w/10
            walk.box((x,6.60,z),(.13,1.11,.14),"Cedro claro")
        walk.beam((x,7.14,cz-w/2),(x,7.14,cz+w/2),.18,.17,"Carvalho escuro")
    for side in (-1,1):
        for i in range(10):
            x=cx-w/2+(i+.5)*w/10
            if side==1 and abs(x-cx)<.93:
                continue
            walk.box((x,6.60,cz+side*w/2),(.16,1.11,.16),"Cedro claro")
        for span in ([(-w/2,w/2)] if side<0 else [(-w/2,-.94),(.94,w/2)]):
            walk.beam((cx+span[0],7.14,cz+side*w/2),(cx+span[1],7.14,cz+side*w/2),.17,.17,"Carvalho escuro")
    end=cz+w/2
    start=5.6
    pitch=(start-end)/16
    for i in range(16):
        z=start-(i+.5)*pitch
        h=.21+(i+1)*(base-.21)/16
        walk.box((cx,h-.08,z),(1.77,.16,pitch+.055),"Cedro claro")
        if i%4==0:
            for sign in (-1,1):
                walk.box((cx+sign*.88,h+.29,z),(.099,.96,.11),"Carvalho escuro")
    for side in (-1,1):
        x=cx+side*.88
        walk.beam((x,.30,start),(x,5.87,end),.16,.21,"Carvalho escuro")
        walk.beam((x,.94,start),(x,6.91,end),.099,.105,"Cedro claro")
    roof(canopy,cx,cz,6.24,6.27,8.69,1.73,2.50)
    frame.box((cx,11.16,cz),(.10,2.21,.11),"Carvalho escuro")
    frame.post(cx,cz,12.25,.15,.11,"Latão",.65,sides=8)
    frame.finish();walk.finish();canopy.finish()


def flag(name, origin, width, height, horizontal=False):
    pivot=empty(name+"Suporte",motion,origin)
    mesh=bpy.data.meshes.new(name)
    vertices,faces,uvs=[],[],[]
    columns,rows=14,9
    for j in range(rows+1):
        for i in range(columns+1):
            u,v=i/columns,j/rows
            x=u*width if horizontal else (u-.5)*width
            y=-(v*height if horizontal else v*(height-(1-abs(u-.5)*2)*.22))
            if horizontal:
                y+=(u**2)*.17*(1-2*v)
            vertices.append(point(x,y,0))
            uvs.append((u,1-v))
    for j in range(rows):
        for i in range(columns):
            v=j*(columns+1)+i
            faces.append((v,v+columns+1,v+columns+2,v+1))
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    mat=materials["Flâmula rubra" if horizontal else "Tecido do Sol"]
    mat.use_backface_culling=False
    mesh.materials.append(mat)
    uv=mesh.uv_layers.new(name="Tecido pintado")
    for face in mesh.polygons:
        for idx in face.loop_indices:
            uv.data[idx].uv=uvs[mesh.loops[idx].vertex_index]
    item=bpy.data.objects.new(name,mesh)
    motion.objects.link(item)
    item.parent=pivot
    item.shape_key_add(name="Repouso")
    for sign, key_name, frames in [(1,"Vento adiante",[(1,0),(31,1),(61,0),(91,0),(121,0)]),
                                     (-1,"Vento atrás",[(1,0),(31,0),(61,0),(91,1),(121,0)])]:
        key=item.shape_key_add(name=key_name)
        for index, position in enumerate(vertices):
            u,v=uvs[index]
            influence=u if horizontal else 1-v
            key.data[index].co.y=position[1] + sign*sin((u*1.5+v*.65)*pi)*influence*.27
        for f,value in frames:
            key.value=value
            key.keyframe_insert(data_path="value",frame=f)


def plant(part,x,z,size):
    for j in range(8):
        a=j*2.4+rng.random()*.31
        center=(x+cos(a)*size*.21,.217,z+sin(a)*size*.21)
        extent=rng.uniform(.31,.92)*size
        tip=(x+cos(a)*extent,.22+rng.uniform(.38,.76)*size,z+sin(a)*extent)
        left=(center[0]-sin(a)*size*.108,.32+size*.15,center[2]+cos(a)*size*.108)
        right=(center[0]+sin(a)*size*.108,.33+size*.16,center[2]-cos(a)*size*.108)
        mat=rng.choice(["Musgo","Folha viva","Folha seca"])
        part.polygon([center,right,tip,left],mat)
        part.polygon([center,left,tip,right],mat)
    if rng.random()<.35:
        part.rock(x,z,.22+size*.46,.078,.077,.087,"Flor")


def barrel(part,x,z,s=.65):
    for i in range(3):
        part.post(x,z,.21+i*s*.29,s*.29,s*(.34+.035*(i==1)),"Cedro",taper=1 if i<2 else .88,sides=12)
    for y in (.13,.62):
        part.post(x,z,.21+y*s,.055,s*.404,"Ferro antigo",1,sides=12)


def crates(part,x,z,scale=.70):
    part.box((x,.21+scale/2,z),(scale,scale,scale),"Cedro",6)
    for sign in (-1,1):
        for y in (.12,.88):
            part.beam((x-scale/2,.21+y*scale,z+sign*scale*.52),
                      (x+scale/2,.21+y*scale,z+sign*scale*.52),.092,.076,"Cedro claro")
    part.beam((x-scale*.39,.31,z+scale*.54),(x+scale*.43,.19+scale*.86,z+scale*.54),.097,.06,"Carvalho escuro")


def details():
    rocks=Part("Pedras, musgos e marcas de uso",land)
    green=Part("Brotos e flores nas bordas",land)
    furnishings=Part("Barricas, sacos, lenha e bancos",props)
    for i in range(156):
        if i%2:
            x,z=rng.uniform(-15.5,15.5),rng.choice([-1,1])*rng.uniform(12.9,14.8)
        else:
            x,z=rng.choice([-1,1])*rng.uniform(13.8,16.1),rng.uniform(-13.4,13.5)
        if abs(x)<2.4 and z>10:
            continue
        if abs(x)>13.6 and abs(z)>13.4:
            continue
        s=rng.uniform(.15,.65)
        if i%5==0:
            rocks.rock(x,z,.17,s*1.19,s,rng.uniform(.23,.55),"Pedra clara" if i%3 else "Pedra cinza")
        plant(green,x,z,s)
    for x,z,s in [(-13.4,14.5,1.14),(11.7,14.5,.96),(15.5,8.7,.98),(-15.28,-1.5,1.17),
                  (-8.7,14.7,.82),(14.96,-7.5,.91)]:
        rocks.rock(x,z,.14,s,s*.67,s*.87,"Pedra cinza")
        rocks.rock(x+s*.46,z+s*.14,.32,s*.56,s*.41,s*.48,"Pedra clara")
        plant(green,x+s*.54,z-s*.27,.62)
    for x,z in [(-9.8,.64),(-9.2,.72),(5.7,-.83),(10.0,-1.9),(9.1,-1.13),(5.7,11.88)]:
        barrel(furnishings,x,z,rng.uniform(.69,.93))
    for x,z in [(-10.1,-1.27),(-3.21,.93),(9.91,-.58),(10.81,-1.07),(4.31,11.9)]:
        crates(furnishings,x,z,rng.uniform(.58,.83))
    for x,z in [(-8.5,-5.8),(-8.6,-4.14),(-7.7,-5.79),(11.05,-2.52)]:
        furnishings.rock(x,z,.24,.39,.38,.52,"Estopa")
    for x,z in [(-2.45,3.42),(1.93,2.87),(-6.54,1.98)]:
        furnishings.box((x,.70,z),(1.90,.14,.41),"Cedro claro")
        for side in (-1,1):
            furnishings.box((x+side*.64,.44,z),(.24,.44,.36),"Carvalho escuro")
    for i in range(13):
        x=-11.87 + (i%5)*.21
        z=-2.14 + rng.uniform(-.2,.2)
        h=.29+(i//5)*.21
        furnishings.beam((x,h,z),(x,h,z+.72),.18,.16,"Cedro")
        furnishings.box((x,h,z+.74),(.16,.15,.041),"Madeira cortada")
    post=Part("Hastes dos estandartes", props)
    for x,y,z in [(-4.52,3.15,13.91),(8.84,7.52,-4.13)]:
        post.beam((x-.63,y,z),(x+.62,y,z),.085,.092,"Carvalho escuro")
        for side in (-1,1):
            post.box((x+side*.63,y,z),(.09,.13,.13),"Latão")
    rocks.finish();green.finish();furnishings.finish();post.finish()


def fireplace():
    ring=Part("Fogueira • lajes e lenha queimada",props)
    for i in range(12):
        a=i*pi/6
        ring.rock(cos(a)*.72,3.55+sin(a)*.72,.23,.20+rng.random()*.06,.20,.18+rng.random()*.10,
                  "Pedra clara" if i%3==1 else "Pedra cinza")
    for i in range(5):
        a=i*2*pi/5
        ring.beam((cos(a)*.48,.28,3.55+sin(a)*.48),(cos(a)*.066,.64,3.55+sin(a)*.084),.16,.156,
                  "Escuro" if i%2 else "Carvalho escuro")
    ring.finish()
    pivot=empty("Estúdio • chama animada",presentation,(0,.67,3.55))
    flame=Part("Estúdio • núcleo emissivo",presentation,pivot)
    flame.post(0,0,0,.33,.23,"Fogo de apresentação",taper=.82,tip=.24,sides=7)
    flame.finish()
    for frame,s in [(1,1),(12,.85),(24,1.17),(37,.91),(52,1.13),(68,.88),(85,1.11),(104,.91),(121,1)]:
        pivot.scale=(1-.4*(s-1),1-.4*(s-1),s)
        pivot.keyframe_insert(data_path="scale",frame=frame,group="Chama da fogueira")
    data=bpy.data.lights.new("Luz quente da fogueira","POINT")
    data.color=(1,.31,.072)
    data.energy=77
    data.shadow_soft_size=.16
    local=bpy.data.objects.new("Luz quente da fogueira",data)
    presentation.objects.link(local)
    local.location=point(0,.98,3.55)


platform(0,0,33.3,31.9,.20,land)
paths()
palisade()
gate()
hall()
lookout()
details()
fireplace()
flag("BandeiraTorre",(7.45,12.11,-6.9),1.86,.84,True)
flag("BandeiraEntrada",(-4.52,3.13,13.92),.94,1.77)
flag("BandeiraGuarda",(8.84,7.5,-4.11),.86,1.57)

scene.frame_end=121
scene.render.fps=24
scene.frame_set(1)
for frame,name in [(1,"Paliçada fechada"),(52,"Portão aberto"),(91,"Vento e fechamento")]:
    scene.timeline_markers.new(name,frame=frame)

camera_data=bpy.data.cameras.new("Perspectiva da paliçada")
camera=bpy.data.objects.new("Câmera do modelo",camera_data)
presentation.objects.link(camera)
camera.location=point(29,26,34)
target=Vector(point(0,3,0))
camera.rotation_euler=(target-camera.location).to_track_quat("-Z","Y").to_euler()
camera_data.type="ORTHO"
camera_data.ortho_scale=43
scene.camera=camera
for kind,name,where,energy,tint in [("AREA","Sol do estúdio",(-9,31,14),1860,(1,.76,.51)),
                                    ("AREA","Luz do céu",(7,25,-14),1170,(.63,.77,1))]:
    data=bpy.data.lights.new(name,kind)
    obj=bpy.data.objects.new(name,data)
    presentation.objects.link(obj)
    obj.location=point(*where)
    obj.rotation_euler=(target-obj.location).to_track_quat("-Z","Y").to_euler()
    data.energy=energy
    data.color=tint
    data.shape="DISK"
    data.size=27
world=bpy.data.worlds.new("Céu de Valdória")
world.use_nodes=True
next(node for node in world.node_tree.nodes if node.type=="BACKGROUND").inputs["Color"].default_value=(.29,.34,.41,1)
scene.world=world
for screen in bpy.data.screens:
    for area in [area for area in screen.areas if area.type=="VIEW_3D"]:
        space=area.spaces.active
        space.region_3d.view_rotation=camera.rotation_euler.to_quaternion()
        space.region_3d.view_distance=36
        space.region_3d.view_location=target
        space.shading.color_type="MATERIAL"
        space.overlay.show_floor=False
scene.render.resolution_x=1024
scene.render.resolution_y=1024
scene.render.resolution_percentage=100
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/"castelo-nivel-1.blend"),compress=True)
for obj in bpy.context.view_layer.objects:
    obj.select_set(obj.type in {"MESH","EMPTY"} and obj.name not in presentation.objects)
bpy.ops.export_scene.gltf(filepath=str(PROJECT/"src"/"assets"/"castelo-nivel-1.glb"),
                          export_format="GLB", use_selection=True, export_yup=True,
                          export_animations=False, export_morph=False, export_image_format="AUTO",
                          export_meshopt_compression_enable=True, export_meshopt_extension="EXT_meshopt_compression")
print("Paliçada original: .blend e GLB exportados.")

