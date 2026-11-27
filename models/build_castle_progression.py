"""Build Valdória's playable castles, levels 3 through 10."""
from contextlib import contextmanager
from math import atan2, cos, hypot, pi, sin
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_high_fortifications import GOLD, ROOT, Kit, pigment
from build_imperial_palace import Palace, export_palace

TIMBER, OAK, PLASTER = '#63422c', '#956339', '#dcc89b'
SHADOW, LAWN, SOIL = '#4b4238', '#738449', '#8d7955'
WATER, FOAM = '#387f94', '#9bc9d1'
# Keep height, corner height, corner shape, roof, annex roof and main crown.
TIERS = {
    3: (5.9, 5.20, 4, 'clay', 'clay', 'gable'),
    4: (7.0, 6.05, 4, '', 'clay', 'gable'),
    5: (7.8, 6.65, 4, 'clay', 'clay', 'battlements'),
    6: (8.9, 7.45, 12, '', 'clay', 'clay'),
    7: (10.2, 8.15, 12, '', 'clay', 'battlements'),
    8: (11.6, 9.05, 4, 'clay', 'clay', 'clay'),
    9: (13.25, 10.15, 12, 'clay', 'clay', 'clay'),
}


class Castle(Kit):
    def __init__(self,level):
        super().__init__(level)
        self.section='stone'
        self.frame=(0,0,0,0,1)
        self.keep_height,self.corner_height,self.corner_sides,self.corner_roof,self.hall_roof,self.crown=TIERS[level]

    @contextmanager
    def at(self,x,game_z,z=0,angle=0,scale_x=1):
        previous=self.frame
        self.frame=(x,-game_z,z,angle,scale_x)
        try:
            yield
        finally:
            self.frame=previous

    def mesh(self,color,vertices,faces):
        x,y,z,angle,scale=self.frame
        c,s=cos(angle),sin(angle)
        super().mesh(color,[(x+u*scale*c-v*s,y+u*scale*s+v*c,z+w) for u,v,w in vertices],faces)

    def pavers(self,x,y,cols,rows,unit=.65):
        for row in range(rows):
            for column in range(cols):
                self.box(self.stones[1+(row*7+column)%3],x+(column-(cols-1)/2)*unit,
                         y+(row-(rows-1)/2)*unit,.214,unit-.014,unit-.014,.029)

    def grounds(self):
        self.box(SOIL,0,0,-.53,32.8,31.6,1.40)
        self.box(LAWN,0,0,.17,32.75,31.52,.058)
        for x,y,w,d in [(0,-15.65,32.72,.28),(0,15.65,32.72,.28),(-16.25,0,.28,31.55),(16.25,0,.28,31.55)]:
            self.box(self.stones[0],x,y,-.01,w,d,.39)
        self.pavers(0,-8.1,7,23)
        if self.level>=7:
            self.pavers(-5.55,.95,12,5)
            self.pavers(5.55,.95,12,5)
        if self.level>=9:
            self.pavers(0,-3.55,11,8)

    def curtain(self):
        side_points=[(4.80,13.5),(12.6,13.5),(15,11.1),(15,-11.1),(12.6,-13.5),
                     (-12.6,-13.5),(-15,-11.1),(-15,11.1),(-12.6,13.5),(-4.80,13.5)]
        for (ax,az),(bx,bz) in zip(side_points,side_points[1:]):
            with self.at((ax+bx)/2,(az+bz)/2,angle=atan2(az-bz,bx-ax)):
                self.wall(width=hypot(bx-ax,bz-az),depth=.70)
        for x in (-13.0,13.0):
            for z in (-11.5,11.5):
                with self.at(x,z):
                    self.tower(0,0,1.79,self.corner_height,self.corner_sides,self.corner_roof)
                    if self.level>=5:
                        self.banner(0,-1.83,self.corner_height-.63,.77,1.72)

    def gable(self,x,y,z,width,depth,rise):
        left,right=x-width/2,x+width/2
        self.prism(TIMBER,[(left,z),(right,z),(x,z+rise)],depth,y)
        colors=('#9e4235','#b9583c','#c66c49')
        for sign in (-1,1):
            for row in range(8):
                a,b=row/8,(row+1)/8
                self.mesh(colors[(row+sign)%3],
                          [(x+sign*(width/2+.15)*c,y+side*depth/2,z+rise*(1-c)+.10)
                           for c,side in ((a,-1),(b,-1),(b,1),(a,1))],
                          [(0,1,2,3) if sign==1 else (3,2,1,0)])
        self.box(colors[0],x,y,z+rise+.11,.19,depth,.18)

    def lodge(self):
        # The entrance stays at the opening of the original guardhouse.
        with self.at(-6.5,-4.1):
            self.box(self.stones[2],0,0,.24,9.9,7.4,.12)
            height=2.85+min(self.level-3,5)*.34
            for side in (-1,1):
                self.masonry(side*4.91,0,.18,7.38,height,.24)
                self.masonry(side*2.98,-3.68,3.94,.20,height,.24)
                for x in (side*2.45,side*4.82):
                    self.box(TIMBER,x,-3.81,height*.52,.19,.22,height)
                self.box(SHADOW,side*2.93,-3.813,1.67,.86,.041,1.16)
                self.box(GOLD if self.level>=8 else OAK,side*2.93,-3.845,1.67,.076,.055,1.12)
            self.masonry(0,3.66,9.94,.21,height,.24)
            self.box(TIMBER,0,-3.69,(height+2.3)/2,2.22,.24,max(.25,height-2.3))
            if self.level<=5:
                self.box(PLASTER,0,0,height+.68,9.2,6.87,1.26)
                for x in (-3,-1,1,3):
                    self.box(TIMBER,x,-3.48,height+.64,.15,.16,1.31)
            roof_base=height+(1.30 if self.level<=5 else .22)
            self.gable(0,0,roof_base,10.44,8.43,2.24 if self.level>=7 else 1.94)

    def stair_and_lookout(self):
        for i in range(16):
            top=.21+(i+1)*5.79/16
            self.box(self.stones[1+i%3],7.4,-5.60+(i+.5)*9.92/16,(top+.19)/2,1.78,9.92/16+.005,top-.19)
        for x in (6.50,8.30):
            for i in range(5):
                y=-5.60+(i+.65)*1.91
                z=.21+(y+5.60)*.584
                self.box(OAK if self.level<7 else self.stones[2],x,y,z+.47,.11,.11,.94)
        self.box(self.stones[2],7.4,6.9,5.92,5.15,5.15,.16)
        for x in (5.14,9.66):
            for y in (4.68,9.12):
                self.box(self.stones[2],x,y,4.42,.64,.64,8.44)
                self.box(GOLD if self.level>=8 else self.stones[3],x,y,8.16,.76,.76,.22)
        for x in (4.825,9.975):
            self.box(self.stones[2],x,6.9,6.44,.24,5.15,.88)
        self.box(self.stones[2],7.4,9.475,6.44,5.15,.24,.88)
        for x in (5.66,9.14):
            self.box(self.stones[2],x,4.325,6.44,1.65,.23,.88)
        self.tile_roof(7.4,6.9,8.58,3.80,2.15+(self.level-3)*.14,4,self.hall_roof)

    def keep(self):
        with self.at(0,-10.52):
            h=self.keep_height
            self.masonry(0,0,7.42,4.65,h)
            for floor in range(1,1+int((h-2)//2.4)):
                elevation=floor*2.4
                self.box(self.stones[3],0,0,elevation-.59,7.55,4.74,.12)
                for x in (-2.23,0,2.23):
                    self.prism(SHADOW,[(x-.29,elevation),(x+.29,elevation),
                                      (x+.29,elevation+.77),(x,elevation+1.09),(x-.29,elevation+.77)],.07,-2.37)
                    if self.level>=7:
                        self.box(GOLD if self.level>=9 else self.stones[3],x,-2.435,elevation+.42,.066,.09,.90)
            if self.crown=='gable':
                self.gable(0,0,h-.16,8.05,5.56,2.15+(self.level-3)*.42)
            elif self.crown=='battlements':
                self.box(self.stones[3],0,0,h-.20,7.62,4.8,.30)
                for x in (-3,-1.5,0,1.5,3):
                    for y in (-2.18,2.18):
                        self.box(self.stones[3],x,y,h+.35,.69,.53,.78)
                if self.level==7:
                    self.tile_roof(0,0,h+.64,2.16,2.4,4,'clay')
            else:
                self.tile_roof(0,0,h-.10,4.32,3.48+(self.level-6)*.35,4,'clay')
            if self.level>=6:
                self.banner(0,-2.46,h-.81,1.63,3.52 if self.level>=9 else 2.53)
            if self.level>=8:
                for x in (-3.22,3.22):
                    self.tile_roof(x,-1.78,h-.40,1.29,2.30,10,self.hall_roof)

    def palace_wings(self):
        if self.level<8:
            return
        height=self.keep_height*.77
        for sign in (-1,1):
            with self.at(sign*4.98,-11.1):
                self.masonry(0,0,2.58,3.80,height)
                self.box(self.stones[3],0,0,height-.30,2.74,3.96,.21)
                for z in (3.75,6.35,height-1.05):
                    self.prism(SHADOW,[(-.28,z-.46),(.28,z-.46),(.28,z+.30),
                                       (0,z+.60),(-.28,z+.30)],.056,-1.92)
                self.tile_roof(0,0,height-.17,2.18,2.65+(self.level-8)*.72,4,self.hall_roof)
                self.banner(0,-1.95,height-1.28,.66,1.44)

    def entry(self,cad):
        with self.at(0,13.35,.18,scale_x=2.36/1.96):
            spring,outer=self.arch(cad)
            top=spring+outer
            self.box(self.stones[2],0,.09,top+.34,7.94,.97,.78)
            for side in (-1,1):
                self.masonry(side*(outer+1.94)/2,-.20,outer-1.94,1.19,spring+.14)
                curve=[(outer*cos(i*pi/32),spring+outer*sin(i*pi/32)) for i in range(16,-1,-1)]
                spandrel=curve+[(3.99,spring),(3.99,top+.14),(0,top+.14)]
                points=spandrel if side==1 else [(-x,z) for x,z in reversed(spandrel)]
                self.prism(self.stones[1],points,.82,-.22)
                self.masonry(side*3.37,0,1.27,.82,spring+.28)
                self.banner(side*3.28,-.72,top+.17,.68,1.72)
                if self.level>=6:
                    self.torch(side*2.28,-.92,2.03)
            for column in range(7):
                self.box(self.stones[3],(column-3)*1.1,.10,top+.92,.56,.93,.52)
            if self.level>=7:
                self.box(GOLD,0,-.46,top+.26,7.91,.12,.11)
                self.banner(0,-.61,top+.97,.86,1.12)
            if self.level>=9:
                self.tile_roof(0,.06,top+.81,1.42,1.84,4,self.hall_roof)
            self.leaves(spring)
        self.section='stone'

    def court(self):
        if self.level<=8:
            self.ring(self.stones[1],0,-3.55,.208,.74,.74,.24,14)
        else:
            self.ring(self.stones[2],0,-3.55,.207,1.43,1.43,.26,16)
            self.ring(WATER,0,-3.55,.47,1.32,1.32,.018,16)
            self.ring(self.stones[3],0,-3.55,.48,.20,.13,.61,12)
            self.ring(FOAM,0,-3.55,1.08,.115,.021,.49,10)

    def build_castle(self,cad,collection):
        self.grounds()
        self.curtain()
        self.lodge()
        self.stair_and_lookout()
        self.keep()
        self.palace_wings()
        self.entry(cad)
        self.court()
        pivots={}
        for role,sign in (('left',-1),('right',1)):
            leaf=bpy.data.objects.new(f'Folha {role} {self.level}',None)
            collection.objects.link(leaf)
            leaf.location=(sign*2.36,-13.35,.18)
            leaf['castleLeaf']=sign
            pivots[role]=leaf
        for (role,color),(vertices,faces) in self.parts.items():
            name=f'{role}_{self.level}_{color[1:]}'
            pivot=pivots.get(role)
            if pivot:
                vertices=[tuple(Vector(vertex)-pivot.location) for vertex in vertices]
            mesh=bpy.data.meshes.new(name)
            mesh.from_pydata(vertices,[],faces)
            mesh.validate()
            mesh.update()
            obj=bpy.data.objects.new(name,mesh)
            mesh.materials.append(pigment(color))
            collection.objects.link(obj)
            obj.parent=pivot
        flag=bpy.data.objects.new(f'Mastro central {self.level}',None)
        collection.objects.link(flag)
        flag.location=(0,10.52,self.flag_height())
        flag['castleFlag']=True
        pole=bpy.data.meshes.new(f'Mastro {self.level}')
        material=pigment(GOLD if self.level>=8 else TIMBER)
        r=.064
        pole.from_pydata([(-r,-r,-1.15),(r,-r,-1.15),(r,r,-1.15),(-r,r,-1.15),
                          (-r,-r,.53),(r,-r,.53),(r,r,.53),(-r,r,.53)],[],
                         [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
        pole.materials.append(material)
        mast=bpy.data.objects.new(f'Mastro {self.level}',pole)
        collection.objects.link(mast)
        mast.parent=flag

    def flag_height(self):
        if self.crown=='gable': return self.keep_height+2.36+(self.level-3)*.42
        if self.crown=='battlements': return self.keep_height+(3.10 if self.level==7 else .67)
        return self.keep_height+3.61+(self.level-6)*.35


def build_levels():
    title='Castelos de Valdória'
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
    cad=list(scene.objects)
    arches={int(obj.name.split('_')[-1]):obj for obj in cad if obj.type=='MESH'}
    assert set(arches)==set(range(3,11))
    for level in range(3,11):
        collection=bpy.data.collections.new(f'Castelo Nível {level:02}')
        scene.collection.children.link(collection)
        if level==10:
            Palace().make(collection)
            export_palace(collection)
        else:
            Castle(level).build_castle(arches[level],collection)
            bpy.ops.export_scene.gltf(filepath=str(ROOT/'src'/'assets'/f'stockade-nivel-{level}.glb'),
                                      export_format='GLB',collection=collection.name,export_yup=True,export_extras=True)
        for obj in collection.objects:
            if obj.parent is None:
                obj.location.x+=40*((level-3)%4)
                obj.location.y+=44*((level-3)//4)
    for obj in cad:
        bpy.data.objects.remove(obj,do_unlink=True)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.shading.color_type='MATERIAL'
                view=area.spaces.active.region_3d
                view.view_distance=162
                view.view_location=(60,22,5)
                view.view_rotation=Vector((-.32,.76,-.60)).to_track_quat('-Z','Y')
    bpy.data.libraries.write(str(ROOT/'models'/'castelos-niveis-3-a-10.blend'),{scene},fake_user=True,compress=True)


if __name__=='__main__':
    build_levels()
