"""Build the ten playable watchtowers and the presentation scene in Blender."""
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_housing import (
    Architecture, BOURGOGNE, CLAY, COBALT, COPPER, CUT, DARK, GOLD, IVORY,
    OAK, REED, ROOT, SLATE, STONE, TURQUOISE, material, stage_surface,
)

TITLES=(
    'Posto de madeira','Vigia coberta','Guarita de enxaimel','Torre ameada',
    'Torre redonda','Torre do sino','Torre da galeria','Torre do pendão',
    'Farol da coroa','Torre de Vigia Imperial',
)
PALE=('#897e6f','#b8a993','#d2c4ad','#e1d2b8')
TIMBER=('#683f2a','#8b5c37','#a87642','#b68755')
CRIMSON, HEM, EMBER, FLARE='#9e2030','#631a28','#ff9a44','#ffd778'


class Watchtower(Architecture):
    def __init__(self,level):
        super().__init__(level)
        self.rng.seed(3800+level)
        self.pennants=[]
        self.fires=[]

    def ladder(self,x,y,top,low=.15):
        foot=y-.59
        for s in (-1,1):
            self.rod(OAK,(x+s*.33,foot,low),(x+s*.33,y,top+.11),.072)
        for i in range(1,round((top-low)/.29)+1):
            height=i*.29+low
            z=foot+(y-foot)*(height-low)/(top-low)
            self.rod(CUT,(x-.36,z,height),(x+.36,z,height),.047)

    def deck(self,w,d,z,color=OAK):
        self.box(DARK,0,0,z-.09,w,d,.24)
        for i in range(round(d/.25)):
            count=round(d/.25)
            self.box(TIMBER[i%4],0,-d/2+(i+.5)*d/count,z+.035,w,d/count-.014,.08)
        for s in (-1,1):
            for x in (-w*.41,w*.41):
                self.rod(color,(x,s*.93,z-.29),(x,s*d/2,z-.11),.094)

    def timber_frame(self,top,narrow=.99):
        for x in (-1,1):
            for y in (-1,1):
                self.box(STONE[2],x*1.42,y*1.27,.20,.69,.69,.37)
                self.rod(TIMBER[2],(x*1.42,y*1.27,.31),(x*narrow,y*narrow,top),.147,.11,4)
                for side in (-1,1):
                    self.rod(OAK,(x*1.36,y*1.22,.92+side*.1),(-x*narrow,y*narrow,top-.35+side*.06),.061,.054,4)
                self.rod(CUT,(x*1.33,y*1.21,.81),(x*narrow,-y*narrow,top-.29),.079,.068,4)
                self.ring(DARK,x*1.42,y*1.27,.414,.159,.159,.072,8,pi/4)

    def rail_ring(self,z,radius,sides=12,color=OAK):
        def point(i,level):
            a=(i+.5)*2*pi/sides
            return (radius*cos(a),radius*sin(a),level)
        for i in range(sides):
            for h in (.22,.66):
                self.rod(color,point(i,z+h),point(i+1,z+h),.045)
            self.rod(color,point(i,z),point(i,z+.75),.066)

    def crenels(self,z,r,sides=12):
        for i in range(sides):
            angle=(i+.5)*2*pi/sides
            with self.at(r*cos(angle),r*sin(angle),angle=angle):
                self.box(STONE[2+i%2],0,0,z+.21,.27,.47,.46)
                self.box(IVORY,0,0,z+.45,.34,.535,.10)

    def round_masonry(self,x,y,bottom,top,radius,tip,sides=12,colors=PALE):
        self.ring(colors[0],x,y,bottom,radius-.013,tip-.013,top-bottom,sides)
        rows=round((top-bottom)/.33)
        for row in range(rows):
            start,end=row/rows,(row+1)/rows
            r1,r2=(radius+(tip-radius)*t for t in (start,end))
            for i in range(sides):
                a,b=((i+j)*2*pi/sides for j in (.013,.987))
                verts=[(x+cos(phi)*r,y+sin(phi)*r,z) for phi,r,z in (
                    (a,r1,bottom+(top-bottom)*start),(b,r1,bottom+(top-bottom)*start),
                    (b,r2,bottom+(top-bottom)*end-.027),(a,r2,bottom+(top-bottom)*end-.027))]
                self.mesh(self.rng.choice(colors[1:]),verts,[(0,1,2,3)])

    def stone_foot(self,w,d):
        self.pad(w+.40,d+.32)
        self.masonry_faces(w,d,.16,.83)
        self.band(w,d,.80,STONE[3],.158)
        self.entry_steps(0,-d/2-.17,w=1.25,count=3)

    def stone_entry(self,y,w=1.03):
        self.opening(0,y,.275,w,1.63,'door',IVORY)
        for s in (-1,1):
            self.rod(STONE[2],(s*w*.64,y-.11,.24),(s*w*.64,y-.11,1.40),.074)

    def signal(self,z,radius=.36):
        self.ring(DARK,0,0,z,.15,.18,.36,10)
        self.ring(COPPER,0,0,z+.26,radius*.52,radius,.22,12)
        self.ring(DARK,0,0,z+.47,radius*1.02,radius*1.02,.061,12)
        self.fires.append((0,0,z+.52,radius*2.2))

    def pennant(self,x,y,height,scale):
        self.rod(COPPER,(x,y,height-.40),(x,y,height+.31*scale),.041,.028)
        self.ball(GOLD,x,y,height+.34*scale,.070,.070,.078)
        self.pennants.append((x,y,height,scale))

    def arms(self,y,z,w,h):
        self.prism(HEM,[(-w/2,z-h*.75),(0,z-h),(w/2,z-h*.75),(w/2,z),(-w/2,z)],.077,y)
        self.prism(CRIMSON,[(-w*.456,z-h*.74),(0,z-h*.96),(w*.456,z-h*.74),(w*.456,z-.04),(-w*.456,z-.04)],.036,y-.051)
        for s in (-1,1):
            self.rod(GOLD,(s*w*.425,y-.076,z-.09),(s*w*.425,y-.076,z-h*.73),.023)
            self.rod(GOLD,(s*w*.425,y-.076,z-h*.73),(0,y-.076,z-h*.927),.023)
        self.rod(COPPER,(-w*.60,y,z+.035),(w*.60,y,z+.035),.065)
        m=z-h*.42
        self.prism(GOLD,[(-w*.22,m),(0,m-.41),(w*.22,m),(0,m+.41)],.022,y-.084)
        for s in (-1,1):
            for i in range(3):
                h0=m-.42+i*.24
                self.rod(GOLD,(s*w*.29,y-.087,h0),(s*w*.32,y-.087,h0+.16),.026)

    def arcade(self,radius,z,arch_width,spring,count=4):
        for i in range(count):
            angle=i*2*pi/count
            with self.at(radius*sin(angle),-radius*cos(angle),angle=angle):
                for s in (-1,1):
                    self.column(s*(arch_width/2+.16),0,z,spring+.18,.13,True)
                for j in range(12):
                    a,b=j*pi/12,(j+1)*pi/12
                    profile=[(r*cos(t),z+spring+r*sin(t)) for t,r in (
                        (a,arch_width/2),(b,arch_width/2),
                        (b,arch_width/2+.17),(a,arch_width/2+.17))]
                    self.prism(PALE[2+j%2],profile[::-1],.26)

    def scaffold(self):
        self.pad(3.88,3.66)
        self.timber_frame(3.91)
        self.deck(3.35,3.18,3.89)
        for z in (4.15,4.67):
            for x in (-1.58,1.58):
                self.rod(OAK,(x,-1.49,z),(x,1.49,z),.045)
        self.railing(1.49,3.93,-1.59,1.59,.74)
        for a,b in ((-1.58,-.42),(.42,1.58)): self.railing(-1.49,3.93,a,b,.74)
        self.ladder(0,-1.54,3.88)

    def shelter(self):
        self.pad(4.21,3.96)
        self.timber_frame(4.06,1.20)
        self.deck(3.93,3.76,4.00)
        for x in (-1.55,1.55):
            for y in (-1.42,1.42):
                self.box(OAK,x,y,4.90,.175,.175,1.86)
                self.rod(CUT,(x,y,5.10),(x*.73,y*.68,5.73),.073,.063,4)
        self.hip(4.67,4.47,5.79,1.20,REED,CUT)
        for y in (-1.57,1.57): self.railing(y,4.04,-1.55,1.55,.66)
        self.ladder(.09,-1.49,4.02)

    def timber_room(self):
        self.stone_foot(3.33,3.32)
        self.masonry_faces(3.08,3.07,.82,4.24)
        self.stone_entry(-1.54)
        self.deck(4.47,3.93,4.23)
        self.box('#d5c09b',0,.06,5.23,4.17,3.55,1.88)
        with self.at(0,.06):
            self.timber(4.17,3.55,4.29,6.17,1.02,braces=True,openings=((0,.57),))
        self.opening(0,-1.76,4.80,.83,1.02,shutters=True)
        for s in (-1,1):
            with self.at(s*2.12,.09,angle=s*pi/2):
                self.opening(0,0,4.87,.76,.95,shutters=True)
        self.roof_cross(4.72,4.31,6.19,1.49,BOURGOGNE,trim=OAK)
        self.prism('#d5c09b',[(-2.34,6.19),(2.34,6.19),(0,7.65)],.092,-2.11)
        self.opening(0,-2.17,6.43,.49,.48)

    def square_keep(self):
        self.stone_foot(3.69,3.64)
        self.masonry_faces(3.31,3.27,.80,5.94)
        self.band(3.69,3.65,5.67,IVORY)
        self.band(3.93,3.87,5.96,STONE[3],.30)
        self.band(4.07,3.97,6.20,IVORY,.17)
        for side in (-1,1):
            for i in range(5):
                x=(i-2)*.78
                for a,b,w,d in ((x,side*1.80,.46,.41),(side*1.82,x,.41,.46)):
                    if abs(x)>1.5 and d>.44: continue
                    self.box(STONE[3],a,b,6.55,w,d,.54)
                    self.box(IVORY,a,b,6.85,w+.07,d+.08,.09)
            for y in (-1.54,1.54):
                for z in (1.21,2.14,3.12,4.07,5.05):
                    self.box(PALE[2],side*1.62,y,z,.28,.43,.43)
        self.stone_entry(-1.64)
        self.opening(0,-1.68,3.35,.46,1.20,'arch',IVORY)
        self.signal(6.26,.46)

    def round_keep(self):
        self.pad(4.36,4.12)
        self.ring(STONE[3],0,0,.16,1.88,1.73,.46,16)
        self.round_masonry(0,0,.54,6.65,1.71,1.56,16,STONE)
        for i in range(12):
            a=i*pi/6
            self.rod(PALE[2],(1.49*cos(a),1.49*sin(a),5.54),(1.80*cos(a),1.80*sin(a),6.25),.118,.161,5)
        for z,r,h,col in ((5.98,1.80,.30,STONE[3]),(6.34,1.91,.14,IVORY),(6.56,1.78,.13,STONE[2])):
            self.ring(col,0,0,z,r,r,h,16)
        self.crenels(6.47,1.65)
        self.ring(PALE[1],0,0,6.52,1.22,1.22,.96,12)
        self.turret_roof(0,0,7.38,1.82,1.69,CLAY)
        self.stone_entry(-1.68)
        self.entry_steps(0,-1.78)
        for s in (-1,1):
            self.opening(s*.56,-1.49,4.70,.40,.91,'arch',IVORY)
        self.opening(0,-1.55,2.66,.47,.97,'arch',IVORY)

    def bell_tower(self):
        self.stone_foot(3.66,3.54)
        self.masonry_faces(3.29,3.18,.82,5.88,PALE)
        for z in (2.75,4.70,5.82): self.band(3.29,3.18,z,IVORY)
        self.arcade(1.42,5.98,1.97,1.01)
        self.box(OAK,0,0,7.20,2.42,.21,.23)
        self.ring(COPPER,0,0,6.32,.57,.40,.24,20)
        self.ring(GOLD,0,0,6.53,.40,.28,.48,20)
        self.ring(COPPER,0,0,6.97,.30,.20,.14,16)
        self.rod(DARK,(0,0,7.12),(0,0,7.34),.065)
        self.ball(GOLD,0,0,6.25,.099,.099,.123)
        self.band(3.59,3.48,7.80,IVORY,.23)
        self.hip(4.22,4.11,7.91,1.74,BOURGOGNE,COPPER)
        self.stone_entry(-1.60)
        self.opening(0,-1.62,3.22,.49,1.22,'arch',IVORY)

    def gallery(self):
        self.pad(4.90,4.52)
        self.ring(IVORY,0,.08,.16,1.83,1.67,.65,8,pi/8)
        self.round_masonry(0,.08,.80,6.42,1.71,1.52,8)
        self.deck(4.71,4.40,6.44)
        self.rail_ring(6.52,2.13,12,CUT)
        self.box('#dec6a0',0,.08,7.60,2.66,2.63,2.13)
        with self.at(0,.08):
            self.timber(2.66,2.63,6.54,8.67,.96,braces=True,openings=((0,.46),))
            self.tiled_roof(3.51,3.77,8.69,1.57,SLATE,trim=OAK)
        self.opening(0,-1.27,7.02,.83,1.02,shutters=True)
        self.stone_entry(-1.58)
        self.entry_steps(0,-1.91)
        for s in (-1,1):
            self.rod(OAK,(s*1.12,-.9,5.23),(s*2.16,-1.84,6.42),.11,.09)
            self.opening(s*.47,-1.47,3.63,.36,1.10,'arch',IVORY)
        self.pennant(-.93,.13,10.32,.88)

    def banner_tower(self):
        self.pad(5.10,4.39)
        self.round_masonry(.21,0,.17,8.88,1.68,1.39,12)
        self.round_masonry(-1.53,-.44,.18,6.62,.64,.53,10)
        self.turret_roof(-1.53,-.44,6.63,.78,1.27,SLATE)
        for z,r in ((.70,1.73),(3.35,1.65),(6.17,1.58),(8.47,1.56),(8.76,1.59)):
            self.ring(IVORY,.21,0,z,r,r,.13,16)
        for s in (-1,1):
            self.column(.21+s*.76,-1.29,6.07,2.32,.115,True)
            self.opening(.21+s*.58,-1.26,7.28,.39,.91,'arch',IVORY)
        self.turret_roof(.21,0,8.96,1.87,2.21,TURQUOISE)
        self.arms(-1.59,6.26,.95,2.66)
        self.stone_entry(-1.56)
        self.entry_steps(0,-1.84)

    def beacon(self):
        self.stone_foot(3.76,3.74)
        self.round_masonry(0,0,.81,7.70,1.76,1.49,16)
        for z,r in ((1.03,1.81),(2.86,1.70),(5.85,1.59),(7.57,1.74),(7.84,1.85)):
            self.ring(IVORY,0,0,z,r,r,.20,16)
        self.rail_ring(7.98,1.78,12,COPPER)
        self.arcade(1.02,8.08,1.27,1.31)
        self.signal(8.10,.44)
        self.ring(COPPER,0,0,10.04,1.43,1.43,.17,16)
        self.turret_roof(0,0,10.22,1.70,1.43,TURQUOISE,True)
        self.stone_entry(-1.73)
        for z in (3.42,5.98): self.opening(0,-1.63,z,.55,1.04,'arch',IVORY)

    def imperial(self):
        self.pad(5.37,4.64)
        self.masonry_faces(4.37,3.42,.18,2.26,PALE)
        self.band(4.37,3.42,2.19,IVORY,.18)
        self.round_masonry(0,.28,2.25,9.35,1.67,1.43,16)
        for s in (-1,1):
            self.round_masonry(s*1.30,-.53,.19,7.78,.52,.42,10)
            self.ring(IVORY,s*1.30,-.53,7.61,.56,.58,.17,10)
            self.turret_roof(s*1.30,-.53,7.85,.67,1.86,COBALT)
            self.column(s*1.71,-1.85,.23,1.85,.14,True)
            self.opening(s*1.53,-1.76,.55,.43,.88,'arch',IVORY)
            for z in (2.93,6.65):
                self.opening(s*.60,-1.24,z,.43,1.18,'arch',GOLD)
        self.band(4.52,.78,2.13,GOLD,.085)
        self.box(IVORY,0,-1.96,2.09,4.54,.68,.17)
        self.opening(0,-1.77,.30,1.23,1.73,'door',GOLD)
        self.entry_steps(0,-2.09,w=1.50)
        for z,r,h,c in ((3.96,1.83,.16,IVORY),(4.10,1.90,.15,GOLD),(6.18,1.57,.12,GOLD),
                        (8.48,1.72,.18,IVORY),(8.67,1.81,.13,GOLD),(9.34,1.54,.16,IVORY)):
            self.ring(c,0,.28,z,r,r,h,20)
        for z,r in ((4.24,1.79),(8.77,1.69)):
            with self.at(0,.28):
                self.rail_ring(z,r,16,GOLD)
        self.arms(-1.44,6.49,1.26,1.98)
        self.ring(IVORY,0,.28,9.48,1.33,1.33,1.17,20)
        for i in range(8):
            a=i*pi/4
            with self.at(1.25*sin(a),.28-1.25*cos(a),angle=a):
                self.opening(0,-.070,9.66,.53,.77,'arch',GOLD)
        self.ring(GOLD,0,.28,10.58,1.45,1.49,.15,24)
        self.turret_roof(0,.28,10.73,1.69,1.73,COBALT,True)
        self.pennant(0,.28,12.97,1.05)

    def effects(self,collection):
        for i,(x,y,z,s) in enumerate(self.pennants):
            shape=Architecture(1)
            columns,rows=15,6
            points=[(u*s,sin(u*8)*u*.12*s,(.25-v*.51+u*.09)*s)
                    for v in (j/rows for j in range(rows+1)) for u in (k/columns for k in range(columns+1))]
            faces=[(j*(columns+1)+i,j*(columns+1)+i+1,(j+1)*(columns+1)+i+1,(j+1)*(columns+1)+i)
                   for j in range(rows) for i in range(columns)]
            shape.mesh(CRIMSON,points,faces)
            shape.instantiate(collection,f'Flâmula {i+1}')
            flag=next(obj for obj in collection.objects if obj.name.startswith(f'Flâmula {i+1}'))
            flag.location=(x,y,z)
            flag['watchPennant']=True
        for i,(x,y,z,s) in enumerate(self.fires):
            shape=Architecture(1)
            shape.ring(EMBER,0,0,-.08*s,.44*s,.19*s,.32*s,10)
            shape.ball(FLARE,-.05*s,-.03*s,.20*s,.23*s,.19*s,.39*s,.085*s)
            shape.ball(EMBER,.19*s,.10*s,.16*s,.16*s,.13*s,.31*s,-.056*s)
            shape.instantiate(collection,f'Chama de vigia {i+1}')
            for obj in collection.objects:
                if obj.name.startswith(f'Chama de vigia {i+1}'):
                    obj.location=(x,y,z)
                    obj['watchFlame']=True

    def build(self,collection):
        profiles=(self.scaffold,self.shelter,self.timber_room,self.square_keep,self.round_keep,
                  self.bell_tower,self.gallery,self.banner_tower,self.beacon,self.imperial)
        profiles[self.level-1]()
        self.instantiate(collection,f'Vigia {self.level:02}')
        self.effects(collection)


def build():
    flag=material(CRIMSON)
    flag.use_backface_culling=False
    for color,strength in ((EMBER,1.5),(FLARE,2.1)):
        mat=material(color)
        shader=next(node for node in mat.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
        shader.inputs['Emission Color'].default_value=shader.inputs['Base Color'].default_value
        shader.inputs['Emission Strength'].default_value=strength
    scene=bpy.data.scenes.new('Torres de vigia de Valdória')
    bpy.context.window.scene=scene
    for level in range(1,11):
        collection=bpy.data.collections.new(f'Vigia Nível {level:02}')
        scene.collection.children.link(collection)
        Watchtower(level).build(collection)
        path=ROOT/'src'/'assets'/f'watch-nivel-{level}.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',collection=collection.name,
                                  export_yup=True,export_extras=True,export_meshopt_compression_enable=True)
    stage_surface(scene,TITLES,'Vigia',pad=(6.3,6.0),columns=7.8,rows=14.75,
                  scale=41.8,target_height=3.17,resolution_y=1280)
    for old in list(bpy.data.scenes):
        if old!=scene:
            bpy.data.scenes.remove(old)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/'torres-de-vigia-niveis-1-a-10.blend'),compress=True)


if __name__=='__main__':
    build()
