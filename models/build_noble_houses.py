"""Build the ten stone residences of Valdória's nobility."""
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_housing import (
    Architecture, BOURGOGNE, CLAY, COBALT, COPPER, CREAM, DARK, FOLIAGE,
    GOLD, IVORY, OAK, ROOT, SLATE, TURQUOISE, material, stage_surface,
)

TITLES=(
    'Casa nobre de pedra','Solar dos arcos','Solar dos frontões','Casa do mirante',
    'Solar do claustro','Solar dos vitrais','Palacete dos jardins','Residência do duque',
    'Palacete ducal','Palacete Imperial',
)
ASHLAR=('#87776b','#ae9d8b','#c1af99','#d3c3a9','#dac9af')
MARBLE=('#b3a390','#cec1a8','#ded1b9','#e8dcc5','#eae1ce')
CRIMSON, VIOLET, AMBER, TEAL='#9c2f45','#684a75','#d4a469','#4b8c8b'
WATER, FOAM='#459198','#a1d3cb'
NAVY=('#20354f','#284763','#2d4d71','#355c80','#426e90')


class NobleArchitecture(Architecture):
    def __init__(self,level):
        super().__init__(level)
        self.rng.seed(1045+level)
        self.fountains=[]

    def wall(self,w,d,h,low=.17,pale=False):
        self.masonry_faces(w,d,low,h,MARBLE if pale else ASHLAR)
        self.band(w,d,low+.14,IVORY,.18)
        self.band(w,d,h-.11,IVORY,.18)
        self.band(w,d,h+.038,CREAM,.077)

    def courses(self,y,w,heights,gold=False):
        for z in heights:
            self.box(IVORY,0,y,z,w,.19,.14)
            self.box(GOLD if gold else ASHLAR[2],0,y-.11,z-.066,w,.070,.05)

    def windows(self,y,z,positions,w=.82,h=1.09,ornate=False):
        for x in positions:
            self.opening(x,y,z,w,h,'arch',IVORY)
            if ornate:
                for s in (-1,1):
                    self.rod(GOLD,(x+s*w*.47,y-.206,z+.10),(x+s*w*.47,y-.206,z+h*.67),.037)
                self.crest(x,y-.213,z+h+.16,.14,AMBER)

    def side_windows(self,x,y,position,heights,ornate=False):
        for s in (-1,1):
            with self.at(s*x,y,angle=s*pi/2):
                for z in heights:self.windows(0,z,position,.70,.98,ornate)

    def crest(self,x,y,z,r,color=GOLD):
        self.prism(color,[(x,z-r),(x+r*.78,z),(x,z+r),(x-r*.78,z)],.061,y)
        if r>.20:
            self.prism(IVORY,[(x,z-r*.54),(x+r*.48,z),(x,z+r*.54),(x-r*.48,z)],.031,y-.044)

    def footings(self,w,d,y=0):
        self.pad(w,d,0,y)
        for s in (-1,1):
            self.box(ASHLAR[3],s*(w/2-.27),y,.077,.33,d-.34,.090)

    def paving(self,x,y,w,d):
        self.box(ASHLAR[1],x,y,.039,w,d,.068)
        nx=max(1,round(w/.58))
        ny=max(1,round(d/.54))
        for i in range(nx):
            for j in range(ny):
                self.box(ASHLAR[2+(i+j)%3],x+w*((i+.5)/nx-.5),y+d*((j+.5)/ny-.5),.080,
                         w/nx-.013,d/ny-.014,.031)

    def lamp(self,x,y,z):
        self.ring(COPPER,x,y,z,.104,.085,.16,8)
        self.ball('#f0bc70',x,y,z+.24,.075,.075,.15)
        self.ring(GOLD,x,y,z+.36,.112,.026,.134,8)
        for j in range(4):
            a=j*pi/2
            self.rod(COPPER,(x+.083*cos(a),y+.083*sin(a),z+.14),
                     (x+.083*cos(a),y+.083*sin(a),z+.38),.015)

    def steps(self,y=3.66,width=1.55,count=3,red=False):
        t=.095
        for i in range(count):
            top=.10+i*t
            front=-y+i*.198
            self.box(IVORY if i%2 else ASHLAR[3],0,front,top/2,width-i*.06,.303,top)
            if red:
                self.box(CRIMSON,0,front,top+.013,width*.58,.27,.026)
                for sign in (-1,1):self.box(GOLD,sign*width*.275,front,top+.031,.044,.27,.012)

    def archway(self,x,y,z,w,cap,depth=.24,gold=False):
        for j in range(16):
            a,b=j*pi/16,(j+1)*pi/16
            profile=[(x+r*cos(a0),z+h*sin(a0)) for a0,r,h in (
                (a,w/2,cap),(b,w/2,cap),(b,w/2+.19,cap+.18),(a,w/2+.19,cap+.18))]
            self.prism(IVORY if j%3 else CREAM,profile[::-1],depth,y)
            if gold:
                self.rod(GOLD,(x+w/2*cos(a),y-depth*.56,z+cap*sin(a)),
                         (x+w/2*cos(b),y-depth*.56,z+cap*sin(b)),.029)

    def portico(self,y,z,w=2.10,d=.95,gilt=False,pediment=True):
        for s in (-1,1):
            x=s*w*.44
            self.column(x,y+d*.58,.17,z-.15,.17,gilt)
            self.column(x,y-d*.44,.17,z-.15,.18,gilt)
            self.lamp(x*1.20,y-d*.55,.18)
        self.box(IVORY,0,y,z,w+.35,d+.29,.22)
        self.box(GOLD if gilt else ASHLAR[3],0,y,z+.115,w+.44,d+.37,.083)
        if pediment:
            l=w*.57
            a=y-d*.62
            self.prism(IVORY,[(-l,z+.10),(l,z+.10),(0,z+.74)],d+.24,y)
            self.rod(GOLD if gilt else ASHLAR[2],(-l,a,z+.14),(0,a,z+.75),.063)
            self.rod(GOLD if gilt else ASHLAR[2],(l,a,z+.14),(0,a,z+.75),.063)
            self.crest(0,a-.045,z+.34,.14)

    def loggia(self,y,z,span,sections,top,gilt=False):
        u=span/sections
        spring=(top-z)*.67
        for i in range(sections+1):
            self.column(-span/2+i*u,y,z,spring+.23,.125,gilt)
        for i in range(sections):
            self.archway(-span/2+(i+.5)*u,y,z+spring,u-.34,top-z-spring,.25,gilt)
        self.box(IVORY,0,y+.22,top+.21,span+.29,.92,.31)
        self.box(GOLD if gilt else ASHLAR[3],0,y+.22,top+.37,span+.40,1.0,.069)

    def cornice(self,w,d,z,gilt=False):
        self.band(w,d,z,CREAM,.23)
        count=round(w/.39)
        for s in (-1,1):
            for i in range(count):
                x=w*((i+.5)/count-.5)
                self.box(MARBLE[2],x,s*(d/2+.055),z-.17,.15,.15,.17)
            for y in (-d*.40,-d*.20,0,d*.20,d*.40):
                self.box(MARBLE[2],s*(w/2+.055),y,z-.17,.15,.14,.17)
        if gilt:self.band(w+.06,d+.06,z-.048,GOLD,.067)

    def tower(self,x,y,r,top,palette,blue=False,dome=False):
        with self.at(x,y):
            for i in range(round(top/.35)):
                z=top*i/round(top/.35)
                self.ring(ASHLAR[2+i%3],0,0,z,r*1.010,r,top/round(top/.35)-.012,12)
            self.ring(IVORY,0,0,top-.16,r*1.11,r*1.18,.19,16)
            self.ring(GOLD if blue else IVORY,0,0,top+.014,r*1.18,r*1.18,.064,16)
            self.turret_roof(0,0,top+.07,r*1.27,1.23 if dome else 1.69,palette,dome)
            for z in (1.54,3.46,top-1.22):
                self.windows(-r-.014,z,(0,),r*.49,.76,blue)

    def bay(self,x,y,z,w,h,palette=SLATE):
        with self.at(x,y):
            self.wall(w,1.35,z+h,z,True)
            self.windows(-.71,z+.36,(0,),w*.51,h*.48,True)
            self.hip(w+.28,1.63,z+h,.68,palette,GOLD)

    def stained_window(self,x,y,z,w,h):
        self.opening(x,y,z,w,h,'arch',IVORY)
        for j in range(3):
            for i in range(2):
                px=x+w*(i-.5)*.37
                pz=z+h*(.24+j*.196)
                c=(VIOLET,AMBER,TEAL,CRIMSON,AMBER,TEAL)[j*2+i]
                self.prism(c,[(px,pz-h*.075),(px+w*.14,pz),(px,pz+h*.075),(px-w*.14,pz)],.024,y-.186)
        self.crest(x,y-.16,z+h+.13,.17,GOLD)

    def hedge(self,x,y,n,span):
        for i in range(n):
            dx=span*(i/max(1,n-1)-.5)
            self.ball(FOLIAGE[i%4],x+dx,y,.21,.22,.23,.24)
            if i%3==1:self.ball('#be7581',x+dx,y-.16,.34,.060,.057,.065)

    def gardens(self,y=-4.15,gilt=False):
        self.paving(0,y,2.01,1.62)
        for sign in (-1,1):
            x=sign*3.37
            self.box(ASHLAR[3],x,y,.085,2.31,1.11,.16)
            self.box('#657c4a',x,y,.17,2.20,1.0,.057)
            self.hedge(x,y-.34,6,1.61)
            self.boxwood(x+sign*.64,y+.15,.16,.72,True)
            if gilt:self.lamp(x-sign*.81,y-.24,.15)

    def fountain(self,x,y,scale=1):
        self.ring(ASHLAR[3],x,y,.034,.61*scale,.64*scale,.098,18)
        self.ring(IVORY,x,y,.13,.66*scale,.66*scale,.18,18)
        self.ring(WATER,x,y,.316,.57*scale,.57*scale,.016,18)
        self.ring(IVORY,x,y,.32,.12*scale,.08*scale,.32*scale,10)
        self.ring(GOLD,x,y,.325+.31*scale,.102*scale,.133*scale,.077,10)
        self.fountains.append((x,y,.31,scale))

    def add_fountains(self,collection,marker):
        for i,(x,y,z,scale) in enumerate(self.fountains):
            pivot=bpy.data.objects.new(f'Água da fonte {i+1}',None)
            collection.objects.link(pivot)
            pivot.location=(x,y,z)
            pivot[marker]=True
            water=Architecture(self.level)
            for index in range(7):
                angle=index*2*pi/7
                for step in range(5):
                    p,q=step/5,(step+1)/5
                    start=(p*.34*scale*cos(angle),p*.34*scale*sin(angle),scale*(.05+.84*p-.88*p*p))
                    end=(q*.34*scale*cos(angle),q*.34*scale*sin(angle),scale*(.05+.84*q-.88*q*q))
                    water.rod(FOAM,start,end,.014,.011,6)
            for obj in water.instantiate(collection,'Jato de água'):
                obj.parent=pivot


class NobleHouse(NobleArchitecture):
    def house(self):
        self.footings(8.34,6.73,.19)
        with self.at(0,.28):
            self.wall(7.78,5.49,4.05)
            self.roof_cross(8.27,6.07,4.08,1.77,SLATE,trim=OAK)
            self.prism(ASHLAR[3],[(-3.72,4.09),(3.72,4.09),(0,5.77)],.10,-3.09)
            self.opening(0,-3.15,4.43,.60,.63,'arch',IVORY)
        self.courses(-2.53,7.82,(2.26,))
        self.opening(0,-2.53,.26,1.20,1.86,'door',IVORY)
        self.windows(-2.53,.94,(-2.41,2.41))
        self.windows(-2.53,2.68,(-2.43,0,2.43),.71,.84)
        self.side_windows(3.94,.23,(-1.44,1.19),(1.19,2.66))
        self.portico(-2.70,2.37,1.84,.66)
        self.steps(3.27)
        for s in (-1,1):
            self.planter(s*2.37,-2.79,.81)

    def arches(self):
        self.footings(8.71,7.44)
        with self.at(-.22,.47):
            self.wall(8.02,5.73,4.14,pale=True)
            self.hip(8.56,6.34,4.20,1.77,BOURGOGNE,COPPER)
        self.windows(-2.43,2.71,(-2.5,-.22,2.06),.82,.86)
        self.opening(0,-2.45,.28,1.22,1.77,'door',IVORY)
        self.windows(-2.44,.89,(-2.40,2.39))
        self.loggia(-3.23,.19,7.32,3,2.32)
        self.railing(-3.69,2.73,-3.49,3.49,.49,COPPER)
        self.steps(3.80)
        self.side_windows(3.85,.58,(-1.40,1.36),(1.08,2.74))
        self.chimney(-2.79,1.55,5.08,1.12)

    def gables(self):
        self.footings(8.95,7.55)
        for s in (-1,1):
            with self.at(s*2.04,.22):
                w=4.15
                self.wall(w,5.82,4.60)
                self.roof_cross(w+.35,6.36,4.58,1.83,CLAY,trim=COPPER)
                self.prism(ASHLAR[3],[(-2.08,4.59),(2.08,4.59),(0,6.40)],.19,-2.99)
                for i in range(7):
                    x=(i-3)*.62
                    self.box(IVORY,x,-3.003,6.42-abs(i-3)*.52,.56,.32,.17)
                self.windows(-3.11,4.93,(0,),.61,.68)
                self.windows(-2.95,2.80,(-.79,.79),.64,.91,True)
                self.windows(-2.95,.92,(s*.85,),.75,.93)
        self.opening(0,-2.79,.26,1.10,1.76,'door',IVORY)
        self.portico(-3.00,2.23,1.84,.88)
        self.steps(3.80)
        self.side_windows(4.18,.21,(-1.42,1.39),(1.05,2.76))

    def lookout(self):
        self.footings(9.12,7.58,.03)
        with self.at(-.50,.40):
            self.wall(7.03,5.64,4.84)
            self.cornice(7.03,5.64,4.82)
            self.hip(7.56,6.20,4.90,1.59,NAVY,COPPER)
        self.tower(3.39,-1.53,1.23,6.52,TURQUOISE)
        for h in (2.66,4.86):
            self.ring(IVORY,3.39,-1.53,h,1.24,1.25,.13,14)
        self.opening(-.56,-2.48,.23,1.17,1.98,'door',IVORY)
        with self.at(-.60):
            self.portico(-2.67,2.68,2.45,.90)
            self.steps(3.43)
        self.windows(-2.48,1.01,(-2.89,1.61))
        self.windows(-2.48,3.10,(-2.89,-.58,1.62),.72,.98,True)
        self.courses(-2.48,7.05,(2.71,))
        self.planter(-2.56,-2.71,.83)

    def cloister(self):
        self.footings(9.05,7.24,.39)
        with self.at(-.72,1.56):
            self.wall(6.82,4.40,4.49,pale=True)
            self.hip(7.32,4.98,4.58,1.61,CLAY,CLAY[0])
        with self.at(3.08,-.51,angle=pi/2):
            self.wall(4.66,2.56,3.49,pale=True)
            self.hip(5.11,3.01,3.57,1.34,BOURGOGNE,COPPER)
            self.windows(-1.34,1.02,(-1.13,1.14),.65,1.13,True)
        with self.at(-.93):
            self.windows(-.68,2.93,(-2.18,0,2.18))
            self.opening(0,-.70,.29,1.08,1.78,'door',IVORY)
            self.loggia(-1.53,.17,6.06,3,2.29)
            self.railing(-1.92,2.69,-2.90,2.90,.53,COPPER)
        self.paving(-.62,-2.83,6.40,2.55)
        self.fountain(-1.89,-3.28)
        for x in (-3.84,1.56):self.boxwood(x,-3.78,.075,1.12,True)

    def glass_solar(self):
        self.footings(8.94,7.63,.27)
        with self.at(.19,.38):
            self.wall(7.71,5.71,5.25,pale=True)
            self.hip(8.27,6.28,5.36,1.66,SLATE,COPPER)
        with self.at(2.07,-1.21):
            self.wall(3.61,3.58,5.62,pale=True)
            self.roof_cross(3.98,4.11,5.67,1.49,BOURGOGNE,trim=GOLD)
            self.prism(MARBLE[3],[(-1.80,5.65),(1.80,5.65),(0,7.13)],.16,-1.99)
            self.stained_window(0,-2.07,3.11,1.29,1.84)
        self.opening(-1.69,-2.54,.27,1.28,1.91,'door',IVORY)
        self.stained_window(-1.72,-2.56,2.96,1.40,1.72)
        self.windows(-3.07,1.16,(2.07,),.86,1.08)
        self.side_windows(3.96,.41,(-.70,1.52),(1.11,3.19),True)
        self.cornice(7.79,5.72,4.91,True)
        with self.at(-1.69):
            self.steps(3.22,1.75)
        self.lamp(-2.81,-2.88,.17)
        self.boxwood(2.89,-3.70,.06,1.04,True)

    def garden_palace(self):
        self.footings(9.42,7.85,.28)
        with self.at(0,.57):
            self.wall(8.86,5.82,5.17,pale=True)
            self.cornice(8.86,5.82,5.16)
            self.hip(9.50,6.43,5.25,1.60,CLAY,COPPER)
        self.opening(0,-2.39,.27,1.30,1.92,'door',IVORY)
        self.windows(-2.40,2.93,(-3.20,-1.61,0,1.61,3.20),.63,1.19,True)
        self.windows(-2.40,1.08,(-3.10,3.10))
        self.portico(-2.88,2.64,3.34,.98,True,True)
        self.side_windows(4.47,.58,(-1.49,1.49),(1.03,3.06),True)
        self.steps(3.67,2.16)
        self.gardens(-4.16)
        self.fountain(3.51,-3.08,.75)

    def mansard(self):
        self.footings(9.49,7.80,.33)
        with self.at(0,.47):
            self.wall(8.76,6.07,5.57,pale=True)
            self.cornice(8.76,6.07,5.62,True)
            self.tiled_roof(9.38,6.74,5.72,1.55,TURQUOISE,.17,.51,COPPER)
            self.hip(6.4,3.46,7.24,.73,NAVY,GOLD)
        for x in (-2.81,0,2.81):
            with self.at(x,-1.92):
                self.box(MARBLE[2],0,0,6.43,1.58,1.77,1.30)
                self.roof_cross(1.89,2.10,7.11,.82,NAVY,trim=GOLD)
                self.stained_window(0,-.93,6.21,.67,.78)
        self.opening(0,-2.61,.27,1.30,1.98,'door',IVORY)
        self.windows(-2.61,3.20,(-3.14,-1.55,0,1.55,3.14),.69,1.13,True)
        self.windows(-2.61,1.08,(-3.14,-1.62,1.62,3.14),.66,.98)
        self.portico(-2.87,2.46,2.47,1.08,True,False)
        self.railing(-3.45,2.64,-1.33,1.33,.61,GOLD)
        self.side_windows(4.43,.42,(-1.44,1.55),(1.17,3.32),True)
        self.steps(3.79,1.84)
        self.gardens(-4.16)

    def ducal(self):
        self.footings(9.48,7.93,.23)
        with self.at(0,.47):
            self.wall(7.63,6.16,5.49,pale=True)
            self.cornice(7.63,6.16,5.46,True)
            self.roof_cross(8.04,6.60,5.58,2.14,NAVY,trim=GOLD)
            self.prism(MARBLE[3],[(-3.80,5.57),(3.80,5.57),(0,7.70)],.21,-3.31)
        for s in (-1,1):
            self.tower(s*3.41,-1.94,1.20,7.03,TURQUOISE,True,True)
            self.bay(s*1.64,-2.39,2.90,1.43,1.47,NAVY)
        self.stained_window(0,-2.93,5.88,.95,1.10)
        self.windows(-2.68,1.22,(-1.57,1.57),.72,.97,True)
        self.opening(0,-2.68,.27,1.34,1.98,'door',IVORY)
        self.portico(-2.97,2.51,2.57,.93,True)
        self.steps(3.84,2.03,4)
        self.gardens(-4.16,True)
        self.fountain(3.56,-3.64,.73)

    def imperial(self):
        self.footings(10.44,7.96,.35)
        for s in (-1,1):
            with self.at(s*3.24,.59):
                self.wall(3.42,5.65,5.31,pale=True)
                self.cornice(3.42,5.65,5.36,True)
                self.hip(3.89,6.21,5.49,1.71,COBALT,GOLD)
                for z in (1.09,3.14):
                    self.stained_window(0,-2.88,z,1.11,1.45)
                self.side_windows(1.75,.02,(-1.41,1.48),(1.22,3.21),True)
            self.column(s*4.49,-2.46,.21,4.91,.132,True)
            self.column(s*2.53,-2.64,.21,4.91,.132,True)
            self.fountain(s*3.06,-3.90,.85)
            self.boxwood(s*4.56,-3.58,.12,.89,True)
        with self.at(0,-.13):
            self.wall(3.79,6.34,6.90,pale=True)
            self.cornice(3.79,6.34,6.93,True)
            self.railing(-3.03,7.07,-1.71,1.71,.55,GOLD)
            for s in (-1,1):
                self.box(IVORY,s*1.74,-3.02,7.33,.21,.23,.52)
                self.ring(GOLD,s*1.74,-3.02,7.60,.111,.101,.068,10)
                self.ball(GOLD,s*1.74,-3.02,7.73,.091,.091,.14)
            self.ring(MARBLE[2],0,.78,7.07,1.66,1.56,1.11,18)
            self.ring(GOLD,0,.78,8.17,1.62,1.70,.13,20)
            self.turret_roof(0,.78,8.29,1.83,1.64,COBALT,True)
            for a in (0,pi/3,-pi/3,2*pi/3,-2*pi/3,pi):
                with self.at(1.59*sin(a),.78-1.59*cos(a),angle=a):
                    self.windows(-.03,7.16,(0,),.49,.73,True)
        self.opening(0,-3.34,.26,1.48,2.19,'door',GOLD)
        self.stained_window(0,-3.37,3.70,1.44,1.82)
        for s in (-1,1):
            self.column(s*1.54,-3.40,2.94,3.66,.16,True)
            self.crest(s*1.35,-3.46,5.96,.27,GOLD)
        self.loggia(-3.76,.18,3.36,1,2.93,True)
        self.railing(-4.03,3.34,-1.63,1.63,.49,GOLD)
        self.paving(0,-4.52,2.15,.82)
        self.steps(4.78,2.38,4,True)
        self.prism(CRIMSON,[(-.31,6.61),(-.28,6.15),(0,5.97),(.28,6.15),(.31,6.61)],.10,-3.40)
        self.prism(GOLD,[(-.17,6.29),(-.12,6.40),(-.031,6.35),(0,6.55),(.031,6.35),
                         (.12,6.40),(.17,6.29),(.07,6.27),(.119,6.17),(-.119,6.17),(-.07,6.27)][::-1],
                   .04,-3.47)

    def make(self,collection):
        designs=(self.house,self.arches,self.gables,self.lookout,self.cloister,self.glass_solar,
                 self.garden_palace,self.mansard,self.ducal,self.imperial)
        designs[self.level-1]()
        self.instantiate(collection,f'Casa nobre {self.level:02}')
        self.add_fountains(collection,'nobleFountain')


def build():
    water=material(WATER)
    shader=next(node for node in water.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
    shader.inputs['Roughness'].default_value=.25
    shader.inputs['Metallic'].default_value=.16
    scene=bpy.data.scenes.new('Casas nobres de Valdória')
    bpy.context.window.scene=scene
    for level in range(1,11):
        collection=bpy.data.collections.new(f'Casa nobre Nível {level:02}')
        scene.collection.children.link(collection)
        NobleHouse(level).make(collection)
        bpy.ops.export_scene.gltf(filepath=str(ROOT/'src'/'assets'/f'noble-nivel-{level}.glb'),
                                  export_format='GLB',collection=collection.name,export_yup=True,
                                  export_extras=True,export_meshopt_compression_enable=True)
    stage_surface(scene,TITLES,'Casa nobre',pad=(11.06,10.09),columns=13.79,rows=16.67,
                  scale=70.2,target_height=3.27,resolution_y=1048,label_scale=1.24)
    for old in list(bpy.data.scenes):
        if old!=scene:
            bpy.data.scenes.remove(old)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/'casas-nobres-niveis-1-a-10.blend'),compress=True)


if __name__=='__main__':
    build()
