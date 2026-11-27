"""Build Valdória's ten windmills and their articulated sails in Blender."""
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_housing import (
    Architecture, BOURGOGNE, CLAY, COBALT, COPPER, CREAM, CUT, DARK,
    GOLD, IVORY, OAK, REED, ROOT, SLATE, TURQUOISE, stage_surface,
)
from build_noble_houses import ASHLAR, MARBLE, NAVY, NobleArchitecture

TITLES=(
    'Moinho de vento','Moinho da colina','Moinho de enxaimel','Torre de cantaria',
    'Moinho da galeria','Moinho do celeiro','Moinho dos seis ventos','Moinho das arcadas',
    'Moinho da coroa','Moinho Imperial do Vento',
)
IRON, CRIMSON, INDIGO, SACK='#504e4b','#922b40','#355a83','#bd9860'
LINEN=('#b69b70','#cfb788','#e8d5a6','#f3e4bd')
LEAVES=('#526744','#637748','#7b8a51')


class Windmill(NobleArchitecture):
    def __init__(self,level):
        super().__init__(level)
        self.rng.seed(3680+level)
        self.rotor=None

    def approach(self):
        self.pad(5.62,5.49,0,.03)
        self.paving(0,-3.24,1.68,1.75)
        for s in (-1,1):
            self.box(ASHLAR[2],s*2.69,.05,.061,.17,5.02,.12)
            for i in range(8):
                x=s*(2.35+self.rng.uniform(.06,.63))
                y=self.rng.uniform(-3.20,2.42)
                self.ball(ASHLAR[1+i%4],x,y,.045,.11,.095,.075)
                if i%2==0:self.ball(LEAVES[i%3],x+.095,y-.061,.06,.096,.094,.066)

    def sacks(self,x,y,count=3):
        for i in range(count):
            px=x+(i%2-.5)*.39
            py=y+(i//2)*.33
            self.ball(SACK if i%2 else LINEN[1],px,py,.30,.235,.205,.31,.05)
            self.ball(LINEN[2],px+.03,py,.587,.091,.092,.052)
            self.rod(OAK,(px-.037,py-.074,.565),(px+.11,py+.072,.57),.015)

    def cereal_mark(self,x,y,z,scale=.52):
        self.rod(GOLD,(x-.04,y,z-.49*scale),(x+.04,y,z+.51*scale),.029*scale)
        for i in range(5):
            at=z+scale*(i*.14-.28)
            for s in (-1,1):
                self.rod(GOLD,(x,y,at),(x+s*.22*scale,y,at+.17*scale),.026*scale,.015*scale)
                self.ball(GOLD,x+s*.18*scale,y,at+.13*scale,.047*scale,.028*scale,.096*scale,s*.031*scale)

    def deck(self,z,r,stone=False):
        self.ring(ASHLAR[2] if stone else OAK,0,.14,z-.18,r*.90,r,.21,24)
        self.ring(IVORY if stone else CUT,0,.14,z+.031,r,r,.098,24)
        rail_color=GOLD if self.level>=9 else CUT if not stone else IRON
        for i in range(20):
            a,b=i*pi/10,(i+1)*pi/10
            x,y=(r-.085)*cos(a),.14+(r-.085)*sin(a)
            end_x,end_y=(r-.085)*cos(b),.14+(r-.085)*sin(b)
            self.rod(rail_color,(x,y,z+.11),(x,y,z+.70),.042)
            for h in (.23,.67):
                self.rod(rail_color,(x,y,z+h),(end_x,end_y,z+h),.033)
            if i%2==0:
                self.rod(ASHLAR[2] if stone else OAK,(x*.76,.14+(y-.14)*.76,z-.72),
                         (x,.14+(y-.14),z-.16),.072)

    def barrel(self,z,r0,r1,height,sides=16,pale=False):
        dz=(height-z)/round((height-z)/.39)
        rows=round((height-z)/.39)
        palette=MARBLE if pale else ASHLAR
        self.ring(palette[0],0,.21,z,r0-.016,r1-.016,height-z,sides)
        for row in range(rows):
            a0,a1=row/rows,(row+1)/rows
            lo,hi=r0+(r1-r0)*a0,r0+(r1-r0)*a1
            for i in range(sides):
                a,b=((i+t)*2*pi/sides for t in (.018,.982))
                points=[(r*cos(p),.21+r*sin(p),h) for p,r,h in
                        ((a,lo,z+row*dz),(b,lo,z+row*dz),(b,hi,z+(row+1)*dz-.026),(a,hi,z+(row+1)*dz-.026))]
                self.mesh(self.rng.choice(palette[1:]),points,[(0,1,2,3)])
        self.ring(IVORY,0,.21,z,r0*1.045,r0*1.030,.20,sides)
        self.ring(IVORY,0,.21,height-.21,r1*1.025,r1*1.075,.095,sides)
        self.ring(IVORY,0,.21,height-.08,r1*1.12,r1*1.12,.17,sides)
        if self.level>=7:self.ring(GOLD,0,.21,height+.064,r1*1.145,r1*1.145,.058,sides)

    def tower_openings(self,r0,r1,top,zs,ornate=False):
        radius=lambda z:r0+(r1-r0)*(z-.18)/(top-.18)
        y=.21-radius(.84)
        self.opening(0,y-.017,.30,1.14,1.73,'door',IVORY)
        self.steps(-y+.58,1.53)
        for z in zs:
            for a in ((0,pi/2,-pi/2) if z>2.3 else (pi/3,-pi/3)):
                r=radius(z+.36)*.984
                with self.at(r*sin(a),.21-r*cos(a),angle=a):
                    if ornate:self.stained_window(0,-.023,z,.63,1.03)
                    else:self.windows(-.015,z,(0,),.66,1.02)

    def axle(self,plane,height,radius,blades=4,cloth=LINEN,phase=pi/4,metal=COPPER,profile='linen'):
        self.rod(IRON,(0,-.99,height),(0,plane-.22,height),.15,.106,9)
        self.box(DARK,0,plane+.42,height,.66,.45,.53)
        self.ring(GOLD,0,.19,height+.52,.065,.055,.29,8)
        self.rotor=(plane,height,radius,blades,cloth,phase,metal,profile)

    def postmill(self):
        # An elevated wooden body turning above its fixed trestle.
        for s in (-1,1):
            self.box(ASHLAR[2],s*1.34,-.71,.181,.54,.61,.34)
            self.box(ASHLAR[2],s*1.34,.89,.181,.54,.61,.34)
            self.rod(OAK,(s*1.31,-.71,.24),(0,.12,1.53),.114,.095,4)
            self.rod(OAK,(s*1.31,.89,.24),(0,.12,1.53),.114,.095,4)
        self.rod(CUT,(0,.11,.24),(0,.11,2.07),.25,.22,6)
        with self.at(0,.28):
            self.box('#a57547',0,0,2.68,3.18,3.48,2.48)
            for i in range(14):
                x=3.18*((i+.5)/14-.5)
                self.box(('#9a673e',CUT,'#ac7a4d')[i%3],x,-1.747,2.67,.218,.060,2.41)
            self.timber(3.18,3.48,1.44,3.90,1.14,braces=True,openings=((0,.55),))
            self.roof_cross(3.60,3.94,3.92,1.28,REED,trim=CUT)
            self.opening(0,-1.79,1.52,.88,1.44,'door',OAK)
        for i in range(8):
            z=.22+(i+1)*.155
            self.box(CUT,0,-3.02+i*.193,z/2,1.16,.225,z)
        self.sacks(-1.23,-2.35)
        self.axle(-2.49,3.63,2.34,profile='open',metal=IRON)

    def hillmill(self):
        with self.at(0,.28):
            self.masonry_faces(3.84,3.84,.16,1.48)
            self.box('#ccaf84',0,0,2.78,3.78,3.62,2.66)
            self.timber(3.78,3.62,1.47,4.11,1.25,openings=((0,.44),))
            self.hip(4.37,4.22,4.14,1.36,CLAY,CLAY[0])
            self.opening(0,-1.96,.29,1.11,1.73,'door',IVORY)
            self.windows(-1.85,2.46,(-1.05,1.05),.66,.89)
        self.steps(2.48)
        self.sacks(1.53,-2.33)
        self.axle(-2.63,4.10,2.53,profile='short')

    def timbermill(self):
        with self.at(0,.30):
            self.wall(4.04,4.13,2.04)
            self.box(IVORY,0,-.05,3.48,4.45,4.20,2.88)
            self.timber(4.45,4.20,2.05,4.88,1.18,braces=True,openings=((-1.13,.51),(1.13,.51)))
            self.roof_cross(4.92,4.74,4.92,1.77,BOURGOGNE,trim=OAK)
            self.prism(IVORY,[(-2.25,4.91),(2.25,4.91),(0,6.58)],.12,-2.41)
            self.opening(0,-2.19,.31,1.16,1.77,'door',IVORY)
            self.windows(-2.18,2.72,(-1.25,1.25),.70,1.19)
            self.side_windows(2.27,.03,(-1.0,1.03),(2.80,))
        self.steps(2.82)
        self.sacks(-1.66,-2.42)
        self.axle(-2.91,5.03,2.82,cloth=('#d3b77f',LINEN[1],LINEN[2],LINEN[3]))

    def ashlar(self):
        self.barrel(.18,2.36,1.73,5.68,18)
        self.turret_roof(0,.21,5.83,2.10,1.80,SLATE)
        self.tower_openings(2.36,1.73,5.68,(1.29,3.53))
        self.ring(IVORY,0,.21,2.41,2.16,2.15,.098,18)
        self.portico(-1.95,2.36,1.85,.66)
        self.axle(-2.57,5.62,3.01,metal=IRON)

    def gallery(self):
        self.barrel(.18,2.28,1.79,6.22,20,True)
        self.deck(2.74,2.74)
        self.turret_roof(0,.21,6.34,2.15,1.90,CLAY)
        self.tower_openings(2.28,1.79,6.22,(1.21,3.79))
        self.cereal_mark(0,-1.81,4.87,.62)
        self.axle(-2.82,6.17,3.26,cloth=LINEN,profile='full')

    def granary(self):
        self.barrel(.18,2.20,1.71,6.79,12,True)
        self.turret_roof(0,.21,6.93,2.09,1.86,TURQUOISE)
        self.tower_openings(2.20,1.71,6.79,(1.24,3.99))
        with self.at(-1.63,1.98):
            self.wall(2.36,2.19,2.80)
            self.hip(2.69,2.55,2.88,1.26,BOURGOGNE,COPPER)
            self.opening(0,-1.18,.21,.94,1.77,'door',IVORY)
        self.cereal_mark(0,-1.73,5.30,.76)
        self.sacks(1.44,-2.62,4)
        self.axle(-2.63,6.76,3.42,cloth=(LINEN[1],LINEN[2],LINEN[3],'#b27e60'),profile='full')

    def six_winds(self):
        self.barrel(.18,2.43,1.79,7.40,14)
        self.turret_roof(0,.21,7.54,2.19,1.95,TURQUOISE,True)
        self.tower_openings(2.43,1.79,7.40,(1.75,4.17,5.62),True)
        self.deck(3.08,2.86,True)
        for z,r in ((2.67,2.25),(5.18,2.04),(7.21,1.90)):self.ring(IVORY,0,.21,z,r,r,.11,18)
        self.axle(-2.84,7.30,3.52,6,(LINEN[2],LINEN[3],'#ceab84',CRIMSON),pi/9,GOLD,'split')

    def arcades(self):
        self.wall(5.19,4.11,2.54,.18,True)
        self.barrel(2.54,2.20,1.71,7.94,16,True)
        self.deck(3.51,2.72,True)
        self.turret_roof(0,.21,8.08,2.10,2.11,NAVY)
        self.loggia(-2.55,.18,4.82,3,2.41,True)
        self.opening(0,-2.13,.22,1.16,1.81,'door',IVORY)
        self.stained_window(0,-1.79,5.16,.79,1.31)
        self.steps(3.21,2.12)
        self.sacks(-2.10,-2.74)
        self.axle(-2.97,7.83,3.73,4,(LINEN[2],LINEN[3],'#a94e46',CRIMSON),pi/4,GOLD,'split')

    def crown(self):
        self.barrel(.19,2.54,1.80,8.51,18,True)
        self.tower_openings(2.54,1.80,8.51,(1.23,3.99,6.04),True)
        for z,r in ((2.56,2.40),(4.41,2.25),(6.67,1.97)):self.ring(GOLD,0,.21,z,r,r,.085,20)
        self.deck(3.02,2.85,True)
        self.ring(IVORY,0,.21,8.63,1.85,1.82,.73,20)
        self.turret_roof(0,.21,9.38,2.34,1.87,COBALT,True)
        self.portico(-2.44,2.33,2.15,.75,True)
        self.cereal_mark(0,-2.20,3.78,.76)
        for s in (-1,1):self.boxwood(s*1.90,-2.88,.12,.74,True)
        self.axle(-2.92,8.35,3.98,4,(INDIGO,'#567e9a',LINEN[3],LINEN[2]),pi/4,GOLD,'crest')

    def imperial(self):
        self.pad(6.11,5.60)
        self.wall(5.64,4.63,2.70,.19,True)
        self.barrel(2.71,2.31,1.84,9.20,20,True)
        self.deck(3.38,2.94,True)
        self.deck(6.11,2.23,True)
        for s in (-1,1):
            with self.at(s*2.07,.85):
                self.wall(1.52,2.74,4.38,.18,True)
                self.hip(1.91,3.06,4.49,1.05,COBALT,GOLD)
                self.stained_window(0,-1.45,2.74,.52,1.06)
            self.lamp(s*2.73,-2.77,.22)
            self.boxwood(s*2.19,-3.10,.12,.93,True)
        self.loggia(-2.78,.19,5.26,3,2.47,True)
        self.opening(0,-2.39,.28,1.26,1.88,'door',GOLD)
        self.cereal_mark(0,-2.45,2.99,.66)
        self.steps(3.71,2.08,4,True)
        for z,r in ((3.83,2.25),(5.81,2.14),(7.34,1.98),(8.80,1.91)):
            self.ring(IVORY,0,.21,z,r,r,.069,24)
            self.ring(GOLD,0,.21,z-.06,r+.018,r+.018,.042,24)
        for z,r in ((4.21,2.16),(7.03,1.97),(9.56,1.80)):
            for a in (0,pi/2,-pi/2,pi):
                with self.at(r*sin(a),.21-r*cos(a),angle=a):
                    self.stained_window(0,-.06,z,.70,1.07)
        self.ring(IVORY,0,.21,9.31,1.91,1.91,1.54,24)
        self.ring(GOLD,0,.21,10.84,2.02,2.07,.14,24)
        self.turret_roof(0,.21,11.02,2.30,2.01,COBALT,True)
        self.axle(-3.13,9.07,4.18,6,(INDIGO,'#246085',LINEN[3],'#ddb36b'),pi/9,GOLD,'crest')

    def sails(self,collection):
        plane,height,r,n,palette,start,metal,profile=self.rotor
        hub=bpy.data.objects.new('Eixo do moinho de vento',None)
        hub.location=(0,plane,height)
        hub['windmillRotor']=round(.35-.009*self.level,3)
        collection.objects.link(hub)
        rotor=Architecture(self.level)
        rotor.rod(metal,(0,-.23,0),(0,.16,0),.217,.235,14)
        rotor.ball(IVORY if self.level>=8 else CUT,0,-.255,0,.117,.071,.117)
        for index in range(n):
            angle=start+index*2*pi/n
            def point(u,v,y=0):
                return (u*cos(angle)+v*sin(angle),y,v*cos(angle)-u*sin(angle))
            rotor.rod(OAK,point(0,.09),point(0,r),.077,.045,6)
            lo=r*(.39 if profile=='open' else .30)
            length=r-lo
            width=.56 if self.level<4 else .72 if n==4 else .62
            rows=12
            for i in range(rows):
                t,q=i/rows,(i+1)/rows
                top,bottom=lo+t*length,lo+q*length
                def edge(a):
                    return width*(.72+.28*sin(a*pi)-.25*a**5)
                rotor.rod(CUT,point(.028,top,.018),point(edge(t),top,.017),.021)
                if i<(4 if profile=='open' else 2 if profile=='short' else 0):
                    continue
                for j in range(5):
                    u,v=j/5,(j+1)/5
                    shade=palette[(i*3+j)%3]
                    if profile=='crest' and j<3:shade=palette[0]
                    if profile=='split' and (i+j)%6<2:shade=palette[3]
                    ripple=lambda a,b:-.11*sin(pi*a)*sin(pi*b)
                    vertices=[point(.032+edge(a)*.91*b,lo+a*length,ripple(a,b))
                              for a,b in ((t,u),(q,u),(q,v),(t,v))]
                    rotor.mesh(shade,vertices,[(0,1,2,3)])
            for i in range(rows):
                a,b=i/rows,(i+1)/rows
                width_at=lambda t:width*(.72+.28*sin(t*pi)-.25*t**5)
                rotor.rod(metal if self.level>=8 else CUT,point(width_at(a),lo+a*length),
                          point(width_at(b),lo+b*length),.025,.022)
            if self.level>=7:
                rotor.rod(GOLD,point(.045,r-.044,-.022),point(width*.47,r-.14,-.021),.023)
        for obj in rotor.instantiate(collection,'Pás do moinho'):
            obj.parent=hub

    def make(self,collection):
        designs=(self.postmill,self.hillmill,self.timbermill,self.ashlar,self.gallery,
                 self.granary,self.six_winds,self.arcades,self.crown,self.imperial)
        self.approach()
        designs[self.level-1]()
        self.instantiate(collection,f'Moinho de vento {self.level:02}')
        self.sails(collection)


def build():
    scene=bpy.data.scenes.new('Moinhos de vento de Valdória')
    bpy.context.window.scene=scene
    for level in range(1,11):
        collection=bpy.data.collections.new(f'Moinho de vento Nível {level:02}')
        scene.collection.children.link(collection)
        Windmill(level).make(collection)
        bpy.ops.export_scene.gltf(filepath=str(ROOT/'src'/'assets'/f'windmill-nivel-{level}.glb'),
                                  export_format='GLB',collection=collection.name,export_yup=True,
                                  export_extras=True,export_meshopt_compression_enable=True)
    stage_surface(scene,TITLES,'Moinho de vento',pad=(9.15,9.13),columns=11.65,rows=17.45,
                  scale=60.2,target_height=3.61,resolution_y=1160,label_scale=1.10)
    for old in list(bpy.data.scenes):
        if old!=scene:
            bpy.data.scenes.remove(old)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/'moinhos-de-vento-niveis-1-a-10.blend'),compress=True)


if __name__=='__main__':
    build()
