"""Finish the SolidCraft arches as modular Valdória kits in Blender."""
from math import cos, pi, sin, sqrt
from pathlib import Path
from random import Random

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
STONE = ('#82796a', '#a09682', '#b1a38d', '#c3b49a')
ROYAL = ('#9a8d77', '#b4a98f', '#cfc1a3', '#ded0ad')
GOLD, BRONZE, IRON = '#dba85a', '#9b653a', '#3a424d'
RED, BLUE, WOOD = '#992b31', '#315394', '#9c6237'

# Wall height, gate tower height, tower shape, roof treatment and stone palette.
STAGES = {
    3: (3.45, 4.55, 4, None, STONE),
    4: (3.85, 5.75, 4, 'clay', STONE),
    5: (4.15, 6.15, 12, 'clay', STONE),
    6: (4.65, 7.05, 12, None, STONE),
    7: (5.05, 7.30, 4, 'clay', STONE),
    8: (5.40, 8.00, 4, 'clay', ROYAL),
    9: (5.70, 8.45, 12, 'clay', ROYAL),
    10: (6.10, 9.20, 12, 'blue', ROYAL),
}
ROOFS = {'clay': ('#9e4235', '#b9583c', '#c66c49'),
         'blue': ('#26406e', '#385a91', '#5274a7')}


def linear(value):
    value /= 255
    return value/12.92 if value <= .04045 else ((value+.055)/1.055)**2.4


def pigment(hex_color):
    name = 'Valdoria_' + hex_color[1:]
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    material = bpy.data.materials.new(name)
    rgba = tuple(linear(int(hex_color[i:i+2],16)) for i in (1,3,5)) + (1,)
    material.diffuse_color = rgba
    material.use_nodes = True
    shader = next(node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = rgba
    shader.inputs['Roughness'].default_value = .63 if hex_color in (GOLD, BRONZE, IRON) else .9
    shader.inputs['Metallic'].default_value = .48 if hex_color in (GOLD, BRONZE, IRON) else 0
    if hex_color == '#ffa13b':
        shader.inputs['Emission Color'].default_value = rgba
        shader.inputs['Emission Strength'].default_value = 1.4
    return material


class Kit:
    def __init__(self, level):
        self.level = level
        self.rng = Random(917+level)
        self.parts = {}
        self.section = 'wall'
        self.height, self.tower_height, self.sides, self.roof, self.stones = STAGES[level]

    def mesh(self, color, vertices, faces):
        points, polygons = self.parts.setdefault((self.section,color), ([],[]))
        start = len(points)
        points.extend(vertices)
        polygons.extend(tuple(start+i for i in face) for face in faces)

    def prism(self, color, profile, depth, y=0):
        count = len(profile)
        coords = [(x,y+side*depth/2,z) for side in (-1,1) for x,z in profile]
        # Profiles are counterclockwise viewed from the front (-Y).
        faces = [tuple(range(count)), tuple(range(count*2-1,count-1,-1))]
        faces += [(i,count+i,count+(i+1)%count,(i+1)%count) for i in range(count)]
        self.mesh(color,coords,faces)

    def box(self, color, x,y,z,w,d,h):
        self.prism(color,[(x-w/2,z-h/2),(x+w/2,z-h/2),(x+w/2,z+h/2),(x-w/2,z+h/2)],d,y)

    def ring(self, color, x,y,z, bottom,top,h, sides=12, phase=0):
        angles = [phase+i*2*pi/sides for i in range(sides)]
        vertices = [(x+r*cos(a),y+r*sin(a),elevation)
                    for r,elevation in ((bottom,z),(top,z+h)) for a in angles]
        faces = [tuple(range(sides-1,-1,-1)),tuple(range(sides,sides*2))]
        faces += [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
        self.mesh(color,vertices,faces)

    def masonry(self, x,y,width,depth,height, base=-.16, courses=None):
        self.box(self.stones[0],x,y,base+height/2,width-.035,depth-.07,height)
        rows = courses or max(1,round(height/.48))
        for row in range(rows):
            blocks = max(1,round(width/.65))
            stagger = .28 if row%2 else -.28
            seams = [-width/2]+[width*((i+stagger)/blocks-.5) for i in range(1,blocks)]+[width/2]
            for left,right in zip(seams,seams[1:]):
                material = self.rng.choice(self.stones[1:])
                self.box(material,x+(left+right)/2,y,base+(row+.5)*height/rows,
                         right-left-.025,depth+self.rng.uniform(-.012,.026),height/rows-.027)

    def wall(self, center=0, width=4, depth=.88):
        height = self.height
        self.masonry(center,0,width,depth,height)
        self.box(self.stones[2],center,0,height-.26,width,.96,.20)
        count = round(width/.8)
        for i in range(count):
            x = center-width/2+(i+.5)*width/count
            self.masonry(x,0,width/count*.57,.90,.53+(self.level-3)*.035,height-.20,1)
        if self.level>=5:
            self.box(GOLD if self.level>=8 else self.stones[3],center,0,height-.63,width,.95,.08)
        if self.level>=7:
            self.banner(center,-depth/2-.06,height-1.1,.51,1.0)

    def banner(self,x,y,top,w,h):
        self.prism(RED,[(x-w/2,top-h*.82),(x,top-h),(x+w/2,top-h*.82),
                        (x+w/2,top),(x-w/2,top)],.032,y)
        self.box(GOLD,x,y-.025,top+.01,w+.10,.049,.07)
        self.prism(GOLD,[(x,top-h*.74),(x+w*.24,top-h*.43),(x,top-h*.26),
                         (x-w*.24,top-h*.43)],.024,y-.025)

    def tile_roof(self,x,y,z,width, height, sides, kind):
        colors = ROOFS[kind]
        phase = pi/4 if sides==4 else 0
        courses = 6
        for row in range(courses):
            a,b = row/courses,(row+1)/courses
            radius = lambda t: width*(.071+.929*(1-t)**1.10)
            self.ring(colors[row%3],x,y,z+a*height-.035,radius(a)+.045,radius(b),
                      (b-a)*height+.045,sides,phase)
        self.ring(GOLD if kind=='blue' else colors[0],x,y,z+height-.02,.13,.035,.30,8)

    def tower(self,x,y,r,height, sides=None, roof=None):
        sides = sides or self.sides
        roof = self.roof if roof is None else roof
        if sides==4:
            self.masonry(x,y,r*1.43,r*1.43,height+.13)
        else:
            rows = round(height/.46)
            self.ring(self.stones[0],x,y,-.14,r-.015,r-.015,height+.14,sides)
            for i in range(rows):
                color = self.stones[1+(i*7)%3]
                self.ring(color,x,y,(height+.12)*i/rows-.12,r+(i%3)*.012,r,
                          (height+.12)/rows-.026,sides)
        phase = pi/4 if sides==4 else 0
        self.ring(self.stones[3],x,y,height-.47,r*1.08,r*1.08,.19,sides,phase)
        self.ring(GOLD if self.level>=5 else self.stones[2],x,y,height-.25,r*1.08,r*1.08,.085,sides,phase)
        self.box('#403b38',x,y-r*(.73 if sides==4 else 1.01),height*.66,.17,.045,.60)
        if roof:
            self.tile_roof(x,y,height-.05,r*1.27,1.28+(self.level-3)*.12,sides,roof)
            self.flag(x,y,height+1.30+(self.level-3)*.12)
        else:
            self.ring(self.stones[1],x,y,height-.12,r*1.075,r*1.075,.20,sides,phase)
            for i in range(sides if sides==4 else 10):
                a=i*2*pi/(sides if sides==4 else 10)+phase
                self.box(self.stones[3],x+.86*r*cos(a),y+.86*r*sin(a),height+.28,.34,.34,.49)

    def flag(self,x,y,z):
        self.ring(GOLD,x,y,z,.038,.024,.96,7)
        self.prism(RED,[(x,z+.30),(x+.92,z+.39),(x+.73,z+.57),(x+.97,z+.76),(x,z+.84)],.032,y)

    def torch(self,x,y,z):
        self.box(IRON,x,y,z-.16,.13,.27,.43)
        self.ring(BRONZE,x,y-.13,z-.11,.12,.18,.22,7)
        self.ring('#ffa13b',x,y-.13,z+.06,.136,.024,.37,7)

    def arch(self, cad):
        offset=(self.level-3)*9
        vertices=[]
        for vertex in cad.data.vertices:
            point=cad.matrix_world @ vertex.co
            vertices.append((point.x-offset,point.y-.27,point.z))
        self.mesh(self.stones[0],vertices,[p.vertices[:] for p in cad.data.polygons])
        r,outer=1.94,2.29+(self.level-3)*.042
        spring=2.3+(self.level-3)*.135
        for i in range(15):
            a=(i+.048)*pi/15
            b=(i+.952)*pi/15
            contour=[(radius*cos(t),spring+radius*sin(t))
                     for radius,t in ((r,a),(outer,a),(outer,b),(r,b))]
            self.prism(self.stones[1+i%3],contour,.17,-.71-(self.level-3)*.0225)
        return spring,outer

    def leaves(self,spring):
        height = lambda x: spring+sqrt(max(0,1.912**2-x*x))
        ironwork = self.level>=6
        for sign, section in ((-1,'left'),(1,'right')):
            self.section=section
            for index in range(8):
                x0,x1=sorted((sign*(.020+index*.235),sign*(.244+index*.235)))
                shape=[(x0,.065),(x1,.065),(x1,height(x1)),(x0,height(x0))]
                if not ironwork:
                    self.prism((WOOD,'#ad7744','#8a542f')[index%3],shape,.15)
                else:
                    x=(x0+x1)/2
                    top=height(x)-.03
                    self.box(GOLD if self.level==10 else IRON,x,0,top/2,.071,.135,top-.08)
            for z in (.62,1.28,2.08) if ironwork else (.71,1.71):
                self.box(GOLD if self.level==10 else IRON,sign*.976,-.055,z,1.89,.13,.10)
                for i in range(5):
                    self.box(BRONZE,sign*(.14+i*.36),-.131,z,.046,.036,.046)
            # Brace the arched head with short matching sections.
            for i in range(9):
                a=sign*(.018+i*.207); b=a+sign*.213
                lo,hi=sorted((a,b))
                self.prism(GOLD if self.level==10 else IRON,
                           [(lo,height(lo)-.16),(hi,height(hi)-.16),(hi,height(hi)),(lo,height(lo))],.17)
            self.ring(BRONZE,sign*.18,-.12,1.35,.091,.076,.14,8)
        self.section='gate'

    def gate(self,cad):
        self.section='gate'
        spring,outer=self.arch(cad)
        for side in (-1,1):
            self.masonry(side*(outer+1.94)/2,-.20,outer-1.94,1.40,spring+.16)
            if self.level==3:
                self.masonry(side*3.09,0,1.82,1.58,self.tower_height)
                for shift in (-.54,.54):
                    self.box(self.stones[3],side*3.09+shift,0,self.tower_height+.08,.44,1.61,.46)
            else:
                self.tower(side*3.06,0,.92,self.tower_height)
            self.banner(side*3.12,-1.0,self.tower_height-.85,.54,1.63 if self.level>=5 else 1.05)
            if self.level>=5:
                self.torch(side*2.30,-.97,1.92)
            if self.level>=7:
                self.prism(self.stones[2],[(side*2.80,.02),(side*3.68,.02),(side*3.60,2.47),
                                           (side*3.04,2.93)][::side],.53,-.83)
        top=spring+outer
        edge=outer+.13
        # Stone above the outer arch closes the facade without touching the passage.
        curve=[(outer*cos(i*pi/32),spring+outer*sin(i*pi/32)) for i in range(16,-1,-1)]
        spandrel=curve+[(edge,spring),(edge,top+.09),(0,top+.09)]
        self.prism(self.stones[1],spandrel,.73,-.24)
        self.prism(self.stones[1],[(-x,z) for x,z in reversed(spandrel)],.73,-.24)
        self.box(self.stones[2],0,.10,top+.18,edge*2,.97,.52)
        for i in range(5):
            self.box(self.stones[3],(i-2)*1.07,.12,top+.62,.48,.92,.47)
        if self.level>=5:
            self.box(GOLD,0,-.40,top+.28,5.02,.11,.105)
            self.banner(0,-.54,top+.62,.72,.96)
        if self.level>=8:
            self.court()
        if self.level>=9:
            self.prism(self.stones[3],[(-1.46,top+.33),(1.46,top+.33),(.90,top+1.02),
                        (0,top+1.77),(-.90,top+1.02)],.65,-.29)
            self.tile_roof(0,.04,top+1.13,1.20,1.71,4,'blue')
            self.flag(0,.04,top+2.99)
        if self.level==10:
            self.prism(GOLD,[(-.41,top+.53),(0,top+.23),(.41,top+.53),(.42,top+1.26),
                             (0,top+1.58),(-.42,top+1.26)],.105,-.76)
            self.prism(BLUE,[(-.32,top+.62),(0,top+.36),(.32,top+.62),(.32,top+1.18),
                             (0,top+1.47),(-.32,top+1.18)],.06,-.83)
            for side in (-1,1):
                self.royal_pier(side)
        self.leaves(spring)

    def court(self):
        # Keep the walking deck flush and the side basins outside the opening.
        for row in range(6):
            for col in range(7):
                self.box(self.stones[(row+col)%4],(col-3)*.49,-.47-row*.38,-.045,.477,.372,.13)
        for side in (-1,1):
            self.box(self.stones[2],side*2.04,-1.45,.06,.20,2.10,.24)
            if self.level in (8,10):
                self.box('#376b79',side*2.96,-1.76,-.064,1.46,1.43,.106)
                self.box('#72acb3',side*2.96,-2.08,-.008,1.06,.04,.014)

    def royal_pier(self,side):
        x=side*3.12
        self.masonry(x,-1.14,.91,.62,.72)
        self.ring(self.stones[3],x,-1.16,.64,.30,.23,.71,9)
        self.ring(self.stones[2],x,-1.18,1.20,.22,.33,.20,9)
        self.ring(self.stones[3],x,-1.21,1.36,.25,.18,.29,9)
        for dx in (-.13,.13):
            self.box(self.stones[3],x+dx,-1.21,1.65,.09,.12,.13)
            self.box(self.stones[3],x+dx,-1.40,.81,.12,.22,.28)
        self.box(self.stones[2],x,-1.40,1.43,.22,.19,.16)
        for i in range(5):
            offset=(i-2)*.066
            self.prism('#8dc8ce',[(x+offset-.027,.07),(x+offset+.027,.07),
                                  (x+offset+.027,.68),(x+offset-.027,.68)],.047,-1.48)

    def corner(self):
        self.section='tower'
        self.masonry(0,0,6,.88,self.height)
        self.masonry(0,0,.88,6,self.height,courses=round(self.height/.48))
        self.tower(0,0,1.39,self.tower_height-.24)
        for sign in (-1,1):
            for step in (1.57,2.45):
                self.box(self.stones[3],sign*step,0,self.height+.10,.42,.83,.50)
                self.box(self.stones[3],0,sign*step,self.height+.10,.83,.42,.50)

    def build(self,cad,collection):
        self.wall()
        self.gate(cad)
        self.corner()
        objects=[]
        for (role,color),(vertices,faces) in self.parts.items():
            offset={'wall':0,'gate':12,'left':12,'right':12,'tower':23}[role]
            name=f'{role}_{self.level}_{color[1:]}'
            mesh=bpy.data.meshes.new(name)
            mesh.from_pydata([(x+offset,y,z) for x,y,z in vertices],[],faces)
            mesh.validate()
            mesh.update()
            obj=bpy.data.objects.new(name,mesh)
            collection.objects.link(obj)
            mesh.materials.append(pigment(color))
            objects.append(obj)
        return objects


def build_levels():
    title='Fortificações de Valdória'
    previous=[scene for scene in bpy.data.scenes if scene.name.split('.')[0]==title]
    scene=bpy.data.scenes.new(title)
    bpy.context.window.scene=scene
    for old in previous:
        for collection in list(old.collection.children):
            for obj in list(collection.objects):
                bpy.data.objects.remove(obj,do_unlink=True)
            bpy.data.collections.remove(collection)
        bpy.data.scenes.remove(old)
    scene.name=title
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'models'/'arcos-muralhas.glb'))
    cad_objects=list(scene.objects)
    arches={int(obj.name.split('_')[-1]):obj for obj in cad_objects if obj.type=='MESH'}
    assert set(arches)==set(STAGES)
    for level in STAGES:
        collection=bpy.data.collections.new(f'Nível {level:02}')
        scene.collection.children.link(collection)
        meshes=Kit(level).build(arches[level],collection)
        bpy.ops.export_scene.gltf(filepath=str(ROOT/'src'/'assets'/f'muralhas-nivel-{level}.glb'),
                                  export_format='GLB',collection=collection.name,export_yup=True)
        for mesh in meshes:
            mesh.location.y=(level-3)*9
        print(f'Nível {level}: {len(meshes)} malhas por material')
    for obj in cad_objects:
        bpy.data.objects.remove(obj,do_unlink=True)
    scene.world=bpy.data.worlds.new('Valdória')
    scene.world.color=(.22,.22,.22)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                space=area.spaces.active
                space.shading.color_type='MATERIAL'
                space.region_3d.view_distance=76
                space.region_3d.view_location=(10,31,3)
                space.region_3d.view_rotation=Vector((-.34,.78,-.53)).to_track_quat('-Z','Y')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/'muralhas-niveis-3-a-10.blend'))


if __name__=='__main__':
    build_levels()
