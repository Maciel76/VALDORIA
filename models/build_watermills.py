"""Build Valdória's ten watermills, with turning wheels and open channels."""
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_housing import (
    Architecture, BOURGOGNE, CLAY, COBALT, COPPER, CREAM, CUT, DARK,
    GOLD, IVORY, OAK, REED, ROOT, SLATE, TURQUOISE, material, stage_surface,
)
from build_noble_houses import ASHLAR, MARBLE, NAVY, NobleArchitecture

TITLES=(
    'Moinho d’água','Moinho da ribeira','Azenha de enxaimel','Azenha de cantaria',
    'Moinho da ponte','Moinho de comportas','Moinho dos dois canais','Moinho do aqueduto',
    'Moinho da coroa','Moinho Imperial',
)
WATER=('#256477','#337c90','#54a4af','#8bcacc')
IRON, WET, MOSS, WHEAT='#494c4b','#6a665e','#657747','#c7a466'


class Watermill(NobleArchitecture):
    def __init__(self,level):
        super().__init__(level)
        self.rng.seed(1240+level)
        self.wheels=[]
        self.flow=[]

    def quayside(self,rich=False):
        self.pad(7.59,8.12,-.17,.25)
        self.paving(-.47,-3.32,6.86,1.56)
        self.paving(.35,3.47,6.19,1.2)
        self.box(WET,4.27,0,-.13,2.16,9.77,.37)
        for y in (-4.38,-2.47,.05,2.52,4.34):
            for x in (3.44,5.11):
                self.rod(ASHLAR[1] if rich else OAK,(x,y,-3.35),(x,y,-.16),.245,.208,7)
        self.box(WATER[0],4.27,0,.102,1.89,9.63,.046)
        for i in range(22):
            y=self.rng.uniform(-4.76,4.80)
            x=self.rng.uniform(3.47,5.04)
            self.rod(WATER[1+i%3],(x,y,.132),(x+self.rng.uniform(-.06,.06),y+.18,.132),.022,.009)
        for s in (-1,1):
            x=4.27+s*1.04
            for i in range(14):
                y=(i-6.5)*.67
                self.box(WET if i%4==0 else ASHLAR[2+i%3],x,y,.13,.24,.64,.26)
                if rich:
                    self.box(IVORY,x,y,.283,.275,.62,.087)
                elif i%3==1:
                    self.ball(MOSS,x,y,.251,.105,.18,.034)

    def sacks(self,x,y,n=3):
        for i in range(n):
            dx=(i%2-.5)*.34
            dy=(i//2)*.36
            self.ball(WHEAT,x+dx,y+dy,.29,.22,.23,.34,.057 if i%2==0 else -.036)
            self.ball(CREAM,x+dx+.022,y+dy,.598,.100,.093,.066)
            self.rod(OAK,(x+dx-.082,y+dy-.01,.59),(x+dx+.087,y+dy+.01,.58),.018)

    def millhouse(self,w,d,h,palette,shape='gable',style='stone',x=-.77,y=.34):
        with self.at(x,y):
            self.pad(w+.20,d+.22)
            if style=='stone' or style=='pale':
                self.wall(w,d,h,.17,style=='pale')
                if h>=4.0:self.band(w,d,2.35,IVORY,.12)
            else:
                self.masonry_faces(w,d,.16,.72)
                self.box('#c6aa7d' if style=='timber' else '#d3bb92',0,0,(h+.70)/2,w,d,h-.70)
                self.timber(w,d,.72,h,1.08,braces=style=='beam',openings=((-w*.28,.53),(0,.57),(w*.28,.53)))
            if shape=='front':
                self.roof_cross(w+.47,d+.47,h+.05,1.82,palette,trim=GOLD if self.level>=9 else CUT)
                self.prism(ASHLAR[3],[(-w/2,h),(w/2,h),(0,h+1.76)],.11,-d/2-.057)
                self.opening(0,-d/2-.137,h+.34,.59,.66,'arch',IVORY)
            elif shape=='hip':
                self.hip(w+.52,d+.52,h+.03,1.88,palette,GOLD if self.level==10 else COPPER)
            else:
                self.tiled_roof(w+.56,d+.49,h+.04,1.61,palette,trim=OAK)
            self.opening(0,-d/2-.04,.23,1.14,1.77,'door',IVORY if style in ('stone','pale') else OAK)
            self.windows(-d/2-.061,1.01,(-w*.30,w*.30),.70,.91,h>4)
            self.side_windows(w/2+.047,.09,(-d*.24,d*.25),(1.09,3.12) if h>=4 else (1.05,))
            if h>=3.83:
                self.windows(-d/2-.07,2.99,(-w*.29,0,w*.29),.60,.89,style=='pale')
                self.chimney(-w*.29,d*.16,h+.99,.91,style!='pale')
            self.steps(d/2+.49,1.47)

    def axle_station(self,y,r,scale=1):
        x=4.25
        hub=r+.17
        self.rod(IRON if self.level>=6 else OAK,(2.52,y,hub),(5.04,y,hub),.169,.123,10)
        self.box(WET,5.03,y,.27,.50,.64,.52)
        self.rod(CUT,(5.04,y-.25,.40),(5.04,y,hub),.118,.087,4)
        self.rod(CUT,(5.04,y+.25,.40),(5.04,y,hub),.118,.087,4)
        self.wheels.append((x,y,hub,r,scale))

    def sluice(self,y,height,width=.95,iron=False):
        x=4.28
        for s in (-1,1):
            side=x+s*width/2
            self.rod(IVORY if iron else OAK,(side,y,.20),(side,y,height+.61),.11,.092,5)
            self.box(COPPER if iron else CUT,side,y,height+.56,.30,.37,.21)
        self.box(CUT,x,y,height+.42,width+.24,.22,.18)
        self.box(OAK,x,y,height-.16,width-.06,.19,.70)
        for s in (-1,1):self.box(COPPER if iron else IRON,x+s*width*.27,y-.115,height-.15,.076,.064,.66)
        self.rod(IRON,(x,y,height+.19),(x,y,height+.86),.059)
        self.rod(GOLD if iron else CUT,(x-.24,y,height+.88),(x+.24,y,height+.88),.057)

    def bridge(self,y,gilt=False):
        self.box(ASHLAR[1],4.20,y,.25,2.48,1.24,.28)
        for i in range(7):
            x=4.20+(i-3)*.33
            self.box(ASHLAR[2+i%3],x,y,.397,.319,1.23,.10)
        for s in (-1,1):
            self.railing(y+s*.59,.46,2.99,5.40,.48,GOLD if gilt else OAK)

    def race(self,y,top,rich=False):
        # Projected headrace and chute visibly carry water onto the wheel.
        x=4.26
        d=min(2.92,4.75-y)
        for s in (-1,1):
            self.box(IVORY if rich else WET,x+s*.66,y+d*.49,top-.23,.22,d+.14,.64)
        self.box(ASHLAR[2],x,y+d*.49,top-.25,1.17,d+.04,.30)
        self.box(WATER[1],x,y+d*.49,top-.074,1.12,d+.08,.063)
        for j in range(8):
            u=x+(j-3.5)*.116
            vertices=[(u-.054,y+.01,top-.08),(u+.055,y+.01,top-.08),
                      (u+.052,y-.30,top-.32),(u-.056,y-.30,top-.32),
                      (u+.048,y-.65,top-1.39),(u-.052,y-.65,top-1.39)]
            self.mesh(WATER[1+j%3],vertices,[(0,1,2,3),(3,2,4,5)])
        for i in range(5):
            self.flow.append((x+(i-2)*.17,y-.53,top-.43-i*.16,i*.178))
        for y0 in (y+.53, y+d-.42):
            for s in (-1,1):
                u=x+s*.58
                self.rod(IVORY if rich else OAK,(u,y0,.17),(u,y0,top-.30),.129,.101,6)
            self.rod(ASHLAR[2] if rich else OAK,(x-.61,y0,top-.52),(x+.61,y0,top-.52),.11)
        if rich:
            with self.at(x+.61,y+d*.49,angle=pi/2):
                self.archway(0,0,top-1.36,min(1.62,d-.56),.64,.23,self.level>=9)

    def porch_side(self,x,y,w,d,h,palette):
        with self.at(x,y):
            self.pad(w,d)
            for side in (-1,1):
                for ys in (-1,1):
                    self.rod(OAK,(side*w*.40,ys*d*.38,.20),(side*w*.40,ys*d*.38,h),.085,.071,4)
            self.hip(w+.23,d+.22,h,.81,palette,CUT)
            self.sacks(0,-.16,3)

    def hut(self):
        self.millhouse(5.92,5.67,2.33,REED,style='timber')
        self.axle_station(.10,1.71)
        self.sluice(2.58,1.28,.86)
        self.sacks(-2.52,-3.12,3)

    def stream_mill(self):
        self.millhouse(6.28,5.69,2.82,CLAY,'hip','timber')
        self.axle_station(-.13,1.88)
        self.porch_side(-2.36,-2.21,2.40,2.02,2.05,REED)
        self.sluice(2.65,1.67,1.05)

    def timber_mill(self):
        self.millhouse(6.40,6.24,3.99,BOURGOGNE,'front','beam')
        self.axle_station(-.21,2.08)
        self.sluice(2.91,1.88,1.17)
        self.crest(-.81,-2.98,4.44,.29)
        self.sacks(1.08,-3.28,3)

    def stone_mill(self):
        self.millhouse(6.33,6.43,4.45,SLATE,'front')
        self.axle_station(-.22,2.17)
        with self.at(3.27,2.59,angle=pi/2):
            self.loggia(0,.16,2.06,1,2.55)
        self.sluice(2.84,2.04,1.12,True)
        self.sacks(-2.61,-3.72,3)

    def bridge_mill(self):
        self.millhouse(6.40,6.61,4.69,CLAY,'hip','pale')
        self.axle_station(.41,2.21)
        self.bridge(-3.52)
        self.sluice(3.13,2.23,1.13,True)
        self.portico(-3.20,2.23,2.12,.89,True,False)
        self.sacks(-2.38,-3.46)

    def gate_mill(self):
        self.millhouse(6.37,6.87,5.02,BOURGOGNE,'front','beam')
        self.axle_station(-.11,2.32)
        self.sluice(2.78,2.86,1.37,True)
        self.box(OAK,4.24,2.73,3.58,1.77,.43,.34)
        self.race(2.35,3.71)
        self.bridge(-3.52)
        self.sacks(1.28,-3.67,3)

    def tandem(self):
        self.millhouse(6.45,7.08,5.76,NAVY,'front','pale')
        self.axle_station(-2.06,1.96)
        self.axle_station(2.31,1.83,.82)
        self.sluice(.21,1.86,1.18,True)
        self.bridge(-4.26,True)
        self.loggia(-3.48,.19,5.19,3,2.30,True)
        self.sacks(-2.27,-3.83)

    def aqueduct(self):
        self.millhouse(6.39,6.71,6.23,TURQUOISE,'hip','pale')
        self.axle_station(-.64,2.58)
        self.race(1.15,5.12,True)
        self.bridge(-4.13,True)
        with self.at(3.82,2.72,angle=pi/2):
            self.loggia(0,.19,3.05,1,4.37,True)
        self.stained_window(-.70,-3.11,4.16,.90,1.38)
        self.portico(-3.31,2.49,2.36,.96,True)

    def crown(self):
        self.millhouse(6.37,6.79,6.81,NAVY,'front','pale')
        self.axle_station(-.82,2.69)
        self.race(.99,5.38,True)
        self.bridge(-4.29,True)
        with self.at(1.64,1.81):
            self.wall(2.00,2.23,7.63,.18,True)
            self.cornice(2.00,2.23,7.61,True)
            self.hip(2.34,2.55,7.68,1.35,COBALT,GOLD)
            self.stained_window(0,-1.19,6.10,.62,1.05)
        self.stained_window(-.70,-3.13,5.12,.88,1.36)
        self.portico(-3.42,2.53,2.64,.96,True)

    def imperial(self):
        self.millhouse(6.41,6.94,7.04,COBALT,'hip','pale')
        self.axle_station(-1.59,2.76)
        self.axle_station(2.65,1.41,.73)
        self.race(.46,5.64,True)
        self.bridge(-4.23,True)
        with self.at(-.91,1.18):
            self.ring(IVORY,0,0,7.82,1.37,1.36,1.04,18)
            self.ring(GOLD,0,0,8.84,1.46,1.48,.097,20)
            self.turret_roof(0,0,9.00,1.59,1.60,COBALT,True)
            for i in range(6):
                a=i*pi/3
                with self.at(1.30*sin(a),-1.30*cos(a),angle=a):
                    self.stained_window(0,-.064,7.95,.45,.72)
        with self.at(1.47,-2.13):
            self.wall(2.32,2.30,6.32,.19,True)
            self.cornice(2.32,2.30,6.28,True)
            self.roof_cross(2.74,2.70,6.44,1.32,COBALT,trim=GOLD)
            self.stained_window(0,-1.24,4.78,1.02,1.17)
        self.stained_window(-.82,-3.22,5.34,1.15,1.31)
        self.loggia(-3.45,.19,5.34,3,2.79,True)
        self.railing(-3.82,3.20,-2.55,2.55,.49,GOLD)
        self.crest(-.61,-3.27,6.78,.32,GOLD)
        for x in (-3.41,1.74):self.boxwood(x,-4.01,.06,.91,True)

    def wheel_mesh(self,r,width):
        geometry=Architecture(self.level)
        n=24 if self.level<5 else 36
        palette=(OAK,CUT,IRON) if self.level<8 else (OAK,CUT,GOLD)
        for s in (-1,1):
            x=s*width*.46
            for i in range(n):
                a,b=i*2*pi/n,(i+1)*2*pi/n
                vertices=[(xx,radius*cos(t),radius*sin(t))
                          for xx in (x-.07,x+.07)
                          for radius,t in ((r-.18,a),(r-.18,b),(r,b),(r,a))]
                geometry.mesh(palette[1 if i%4 else 0],vertices,
                              [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)])
                if self.level>=4:
                    geometry.rod(palette[2],(x+s*.071,(r-.062)*cos(a),(r-.062)*sin(a)),
                                 (x+s*.071,(r-.062)*cos(b),(r-.062)*sin(b)),.028,.027)
            for j in range(8 if self.level<5 else 10):
                a=j*2*pi/(8 if self.level<5 else 10)
                geometry.rod(CUT,(x,.18*cos(a),.18*sin(a)),(x,(r-.16)*cos(a),(r-.16)*sin(a)),.086,.069,5)
        paddles=13 if self.level<5 else 17
        for j in range(paddles):
            a=j*2*pi/paddles
            points=[(x,rr*cos(a)+u*sin(a),rr*sin(a)-u*cos(a)) for x in (-width*.55,width*.55)
                    for rr,u in ((r-.20,-.071),(r-.20,.078),(r+.044,.078),(r+.044,-.071))]
            geometry.mesh(CUT if j%3 else OAK,points,
                          [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)])
        geometry.rod(palette[2],(-width*.56,0,0),(width*.64,0,0),.203,.167,14)
        return geometry

    def make(self,collection):
        designs=(self.hut,self.stream_mill,self.timber_mill,self.stone_mill,self.bridge_mill,
                 self.gate_mill,self.tandem,self.aqueduct,self.crown,self.imperial)
        self.quayside(self.level>=7)
        designs[self.level-1]()
        self.instantiate(collection,f'Moinho {self.level:02}')
        for i,(x,y,z,r,scale) in enumerate(self.wheels):
            pivot=bpy.data.objects.new(f'Roda hidráulica {i+1}',None)
            pivot.location=(x,y,z)
            pivot['watermillWheel']=round(.68-.026*self.level+i*.067,3)
            collection.objects.link(pivot)
            wheel=self.wheel_mesh(r,.98*scale)
            for obj in wheel.instantiate(collection,f'Aros e pás {i+1}'):
                obj.parent=pivot
        for x,y,z,phase in self.flow:
            streak=Architecture(self.level)
            streak.rod(WATER[3],(0,0,.15),(0,-.053,-.094),.019,.014)
            for obj in streak.instantiate(collection,'Filete da queda'):
                obj.location=(x,y,z)
                obj['watermillFlow']=phase


def build():
    for color in WATER:
        mat=material(color)
        shader=next(node for node in mat.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
        shader.inputs['Roughness'].default_value=.29
        shader.inputs['Emission Color'].default_value=shader.inputs['Base Color'].default_value
        shader.inputs['Emission Strength'].default_value=.15
    scene=bpy.data.scenes.new('Moinhos d’água de Valdória')
    bpy.context.window.scene=scene
    for level in range(1,11):
        collection=bpy.data.collections.new(f'Moinho Nível {level:02}')
        scene.collection.children.link(collection)
        Watermill(level).make(collection)
        bpy.ops.export_scene.gltf(filepath=str(ROOT/'src'/'assets'/f'watermill-nivel-{level}.glb'),
                                  export_format='GLB',collection=collection.name,export_yup=True,
                                  export_extras=True,export_meshopt_compression_enable=True)
    stage_surface(scene,TITLES,'Moinho',pad=(11.20,10.23),columns=14.15,rows=16.97,
                  scale=72.5,target_height=3.34,resolution_y=1015,label_scale=1.28)
    for old in list(bpy.data.scenes):
        if old!=scene:
            bpy.data.scenes.remove(old)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/'moinhos-dagua-niveis-1-a-10.blend'),compress=True)


if __name__=='__main__':
    build()
