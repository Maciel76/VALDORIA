"""Model the playable level-ten castle and its studio render in Blender."""
from contextlib import contextmanager
from math import cos, pi, sin, sqrt
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_high_fortifications import ROOT, Kit, pigment

IVORY = ('#796c61', '#bcae9a', '#d3c5af', '#dfd1bc', '#eee2cb')
GOLD, HONEY, BRASS = '#e8b849', '#ffe197', '#a66b26'
BLUE = ('#193957', '#214568', '#284f75', '#30577d', '#38638b')
RED, HEM = '#a21828', '#5b1222'
STONE, DARK = '#5f5753', '#231e2c'
GREEN = ('#273f2c', '#42613d', '#648449', '#90a354')
WATER = ('#176371', '#2f98ae', '#66cdd9', '#b4f1ef')

# A heraldic lion rampant for the royal banner and gate.
LION = [(-.19,-.44),(-.32,-.45),(-.33,-.40),(-.23,-.35),(-.19,-.20),
        (-.10,-.10),(-.14,.03),(-.23,.02),(-.35,.16),(-.32,.22),(-.26,.19),(-.18,.13),
        (-.09,.17),(-.11,.24),(-.22,.30),(-.20,.36),(-.12,.36),(-.16,.43),(-.08,.41),
        (-.03,.46),(.025,.41),(.08,.43),(.13,.31),(.11,.23),(.20,.18),(.24,.24),(.33,.25),
        (.34,.20),(.26,.10),(.12,.09),(.13,-.06),(.27,-.06),(.34,.01),(.30,.09),(.37,.14),
        (.42,.07),(.40,-.05),(.31,-.15),(.18,-.17),(.23,-.29),(.33,-.32),(.33,-.39),
        (.23,-.40),(.12,-.36),(.07,-.21),(-.01,-.19),(-.10,-.28),(-.10,-.41)]


class Palace(Kit):
    def __init__(self):
        super().__init__(10)
        self.section = 'Palácio'
        self.flags = []
        self.frame = None

    @contextmanager
    def along_side(self,x,y,side):
        self.frame=(x,y,side)
        try:
            yield
        finally:
            self.frame=None

    def mesh(self,color,vertices,faces):
        if self.frame:
            x0,y0,side=self.frame
            vertices=[(x0-side*y,y0+side*x,z) for x,y,z in vertices]
        super().mesh(color,vertices,faces)

    def ellipsoid(self, color, at, size, sides=12, rows=7):
        x,y,z=at
        sx,sy,sz=size
        vertices=[(x+sx*sin(pi*j/rows)*cos(2*pi*i/sides),
                   y+sy*sin(pi*j/rows)*sin(2*pi*i/sides),z+sz*cos(pi*j/rows))
                  for j in range(1,rows) for i in range(sides)]
        vertices.extend(((x,y,z+sz),(x,y,z-sz)))
        north,south=len(vertices)-2,len(vertices)-1
        faces=[(north,i,(i+1)%sides) for i in range(sides)]
        for j in range(rows-2):
            for i in range(sides):
                a=j*sides+i
                b=j*sides+(i+1)%sides
                faces.append((a,a+sides,b+sides,b))
        faces.extend((south,(rows-2)*sides+(i+1)%sides,(rows-2)*sides+i) for i in range(sides))
        self.mesh(color,vertices,faces)

    def rod(self,color,start,end,radius,tip=None,sides=8):
        a,b=Vector(start),Vector(end)
        direction=(b-a).normalized()
        u=direction.cross(Vector((0,0,1) if abs(direction.z)<.9 else (0,1,0))).normalized()
        v=direction.cross(u)
        tip=radius if tip is None else tip
        vertices=[tuple(p+r*(u*cos(i*2*pi/sides)+v*sin(i*2*pi/sides)))
                  for p,r in ((a,radius),(b,tip)) for i in range(sides)]
        faces=[tuple(range(sides-1,-1,-1)),tuple(range(sides,sides*2))]
        faces.extend((i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides))
        self.mesh(color,vertices,faces)

    def ledge(self,x,y,z,w,d):
        for dz,extra,h,color in ((-.17,.18,.12,IVORY[1]),(-.055,.38,.13,IVORY[3]),
                                 (.067,.56,.11,IVORY[4]),(.152,.43,.055,BRASS)):
            self.box(color,x,y,z+dz,w+extra,d+extra,h)

    def body(self,x,y,w,d,low,high):
        self.box(IVORY[1],x,y,(low+high)/2,w,d,high-low)
        rows=round((high-low)/.55)
        for side in (-1,1):
            for along_x in (True,False):
                span=w if along_x else d
                count=max(1,round(span/.84))
                for row in range(rows):
                    z=low+(row+.5)*(high-low)/rows
                    divisions=[-span/2]+[span*((i+(.22 if row%2 else -.22))/count-.5)
                                          for i in range(1,count)]+[span/2]
                    for left,right in zip(divisions,divisions[1:]):
                        c=self.rng.choices(IVORY[1:],(1,9,12,4))[0]
                        u=(left+right)/2
                        relief=self.rng.uniform(.055,.105)
                        run=right-left-.022
                        h=(high-low)/rows-.028
                        if along_x:
                            self.box(c,x+u,y+side*(d/2+.006),z,run,relief,h)
                        else:
                            self.box(c,x+side*(w/2+.006),y+u,z,relief,run,h)
        for z in (low+.24,high-.18):
            self.ledge(x,y,z,w,d)

    def arch_path(self,x,z,w,spring,pointed=False,segments=24):
        r=w/2
        if pointed:
            return [(x+r-2*r*cos(i*pi/(3*segments)),z+spring+2*r*sin(i*pi/(3*segments)))
                    for i in range(segments+1)]+[
                        (x-r+2*r*cos(i*pi/(3*segments)),z+spring+2*r*sin(i*pi/(3*segments)))
                        for i in range(segments-1,-1,-1)]
        return [(x+r*cos(pi-i*pi/segments),z+spring+r*sin(i*pi/segments))
                for i in range(segments+1)]

    def arch_ring(self,x,y,z,w,spring,trim,depth,pointed=True,gilt=True):
        inner=self.arch_path(x,z,w,spring,pointed)
        outer=self.arch_path(x,z,w+2*trim,spring,pointed)
        for i in range(len(inner)-1):
            color=IVORY[3+i%2]
            self.prism(color,[inner[i+1],inner[i],outer[i],outer[i+1]],depth,y)
            if gilt:
                ax,az=inner[i]
                bx,bz=inner[i+1]
                self.rod(GOLD,(ax,y-depth*.59,az),(bx,y-depth*.59,bz),.034)
        for s in (-1,1):
            self.box(IVORY[3],x+s*(w/2+trim/2),y,z+spring/2,trim,depth,spring)
            if gilt:
                self.box(GOLD,x+s*(w/2+.026),y-depth*.57,z+spring/2,.056,.044,spring)

    def lancet(self,x,y,z,w,spring,glass=True):
        contour=[(x-w/2,z),(x+w/2,z)]+self.arch_path(x,z,w,spring,True,12)[::-1]
        self.prism(DARK,contour,.075,y)
        if glass:
            pane=w*.66
            self.prism('#657f91',[(x-pane/2,z+.10),(x+pane/2,z+.10)]+
                       self.arch_path(x,z+.06,pane,spring-.07,True,8)[::-1],.021,y-.049)
            for s in (-1,1):
                self.prism('#3b5471',[(x+s*.02,z+.14),(x+s*pane/2,z+.18),
                           (x+s*pane/2,z+spring*.62),(x+s*.02,z+spring*.72)][::s],.025,y-.060)
            self.box(BRASS,x,y-.085,z+spring*.58,.042,.045,spring*1.16)
            self.box(GOLD,x,y-.087,z+spring*.70,w*.67,.045,.039)
        self.arch_ring(x,y-.032,z,w,spring,.12,.13)
        self.box(IVORY[4],x,y-.06,z-.055,w+.38,.42,.105)

    def pilaster(self,x,y,z,height,r=.16,ornament=True):
        self.box(IVORY[2],x,y,z+.14,r*3.15,r*2.8,.29)
        self.box(IVORY[4],x,y,z+.31,r*2.68,r*2.55,.10)
        self.ring(IVORY[3],x,y,z+.36,r*.96,r*.78,height-.68,10)
        for top in (z+.39,z+height-.32):
            self.ring(GOLD if ornament else IVORY[1],x,y,top,r*1.16,r*1.16,.073,10)
        self.ring(IVORY[4],x,y,z+height-.26,r*1.04,r*1.45,.17,10)
        self.box(IVORY[4],x,y,z+height-.04,r*3.0,r*2.7,.24)

    def finial(self,x,y,z,scale=1):
        self.ring(BRASS,x,y,z,.21*scale,.24*scale,.12*scale,10)
        self.ring(GOLD,x,y,z+.12*scale,.24*scale,.057*scale,.53*scale,10)
        self.ellipsoid(HONEY,(x,y,z+.69*scale),(.088*scale,.088*scale,.12*scale))
        self.ring(GOLD,x,y,z+.73*scale,.059*scale,.009*scale,.29*scale,8)

    def crockets(self,x,y,z,w):
        for s in (-1,1):
            for row in range(4):
                t=(row+.5)/4
                cx=x+s*w*.50*(1-t)
                self.finial(cx,y,z+w*.63*t,.27)

    def banner(self,x,y,top,w,h):
        columns,rows=14,12
        def fabric(u,v):
            return y-.082*sin(3*pi*u+.4*v)*v
        vertices=[(x+w*(i/columns-.5),fabric(i/columns,j/rows),
                   top-h*(j/rows)*(1-.19*abs(2*i/columns-1)))
                  for j in range(rows+1) for i in range(columns+1)]
        faces=[(j*(columns+1)+i,j*(columns+1)+i+1,(j+1)*(columns+1)+i+1,(j+1)*(columns+1)+i)
               for j in range(rows) for i in range(columns)]
        self.mesh(RED,vertices,[face[::-1] for face in faces])
        for s in (-1,1):
            ex=x+s*w*.46
            self.rod(HONEY,(ex,y-.04,top-.06),(ex,y-.09,top-h*.80),.024)
            self.rod(GOLD,(ex,y-.09,top-h*.80),(x,y-.05,top-h*.982),.027)
            self.ellipsoid(GOLD,(x+s*(w*.5+.17),y,top+.105),(.094,.094,.094))
        self.rod(BRASS,(x-w*.5-.20,y,top+.106),(x+w*.5+.20,y,top+.106),.059)
        scale=min(w*1.0,h*.56)
        self.prism(GOLD,[(x+u*scale,top-h*.41+v*scale) for u,v in LION],.024,y-.108)

    def spire(self,x,y,z,rise,radius):
        sides=12
        rows=max(9,round(rise/.35))
        def profile(t):
            return radius*(.052+.948*(1-t)**1.25)
        for row in range(rows):
            lo,hi=row/rows,(row+1)/rows
            count=sides*3
            for i in range(count):
                a,b=((i+f)*2*pi/count for f in (0,1))
                points=[(x+cos(k)*r,y+sin(k)*r,h) for k,r,h in
                        ((a,profile(lo)+.027,z+lo*rise),(b,profile(lo)+.027,z+lo*rise),
                         (b,profile(hi),z+hi*rise+.032),(a,profile(hi),z+hi*rise+.032))]
                self.mesh(self.rng.choice(BLUE),points,[(0,1,2,3)])
        for i in range(sides):
            a=i*2*pi/sides
            for j in range(6):
                k,l=j/6,(j+1)/6
                self.rod(GOLD if i%2==0 else BLUE[2],
                         (x+(profile(k)+.04)*cos(a),y+(profile(k)+.04)*sin(a),z+k*rise),
                         (x+(profile(l)+.04)*cos(a),y+(profile(l)+.04)*sin(a),z+l*rise),
                         .037,.030,6)
        self.ring(BRASS,x,y,z-.08,radius+.04,radius+.02,.17,sides)
        self.finial(x,y,z+rise,.76)

    def tower(self,x,y,base,top,r,roof,flag=False):
        rows=round((top-base)/.39)
        sides=12
        self.ring(IVORY[1],x,y,base,r-.014,r-.014,top-base,sides)
        for row in range(rows):
            low=base+(top-base)*row/rows
            high=base+(top-base)*(row+1)/rows-.020
            for i in range(sides):
                a,b=(i+.018)*2*pi/sides,(i+.982)*2*pi/sides
                c=self.rng.choices(IVORY[1:],(1,7,11,3))[0]
                self.mesh(c,[(x+r*cos(k),y+r*sin(k),p) for k,p in ((a,low),(b,low),(b,high),(a,high))],[(0,1,2,3)])
        for low,factor,height,c in ((base-.04,1.29,.30,IVORY[1]),(base+.26,1.18,.18,IVORY[3]),
                                   (top-1.66,1.08,.16,IVORY[2]),(top-.61,1.10,.17,IVORY[3]),
                                   (top-.43,1.20,.22,IVORY[4]),(top-.19,1.25,.095,GOLD),
                                   (top-.10,1.21,.15,IVORY[3])):
            self.ring(c,x,y,low,r*factor,r*factor,height,sides)
        for i in range(8):
            a=(i+.5)*pi/4
            cx=x+r*1.11*cos(a)
            cy=y+r*1.11*sin(a)
            self.ring(IVORY[3],cx,cy,top-.90,.08,.24,.48,6)
        for low in (base+(top-base)*.36,top-2.97):
            self.lancet(x,y-r*.964-.029,low,r*.46,.58 if r>1.0 else .43)
        self.spire(x,y,top+.044,roof,r*1.34)
        for s in (-1,1):
            self.finial(x+s*r*1.04,y-.58*r,top+.13,.44)
        if flag:
            self.flags.append((x,y,top+roof+.98,1.05 if r>1.1 else .72))

    def slate_roof(self,x,y,z,w,d,rise):
        # Four pitched faces with overlapping slate courses and individual seams.
        edges=[((-w/2,-d/2),(w/2,-d/2),(-w*.29,0),(w*.29,0)),
               ((w/2,-d/2),(w/2,d/2),(w*.29,0),(w*.29,0)),
               ((w/2,d/2),(-w/2,d/2),(w*.29,0),(-w*.29,0)),
               ((-w/2,d/2),(-w/2,-d/2),(-w*.29,0),(-w*.29,0))]
        rows=round(rise/.31)+4
        for a,b,c,d in edges:
            count=round((abs(a[0]-b[0])+abs(a[1]-b[1]))/.59)
            def point(u,t,overlap):
                return (x+(a[0]*(1-u)+b[0]*u)*(1-t)+(c[0]*(1-u)+d[0]*u)*t,
                        y+(a[1]*(1-u)+b[1]*u)*(1-t)+(c[1]*(1-u)+d[1]*u)*t,
                        z+rise*t+overlap)
            for row in range(rows):
                t,v=row/rows,(row+1)/rows
                for i in range(count):
                    u,k=i/count,(i+.964)/count
                    self.mesh(self.rng.choice(BLUE),[point(u,t,.045),point(k,t,.045),
                              point(k,v,0),point(u,v,0)],[(0,1,2,3)])
            self.rod(GOLD,point(0,0,.01),point(0,1,.05),.056)
            self.rod(BRASS,point(0,0,-.032),point(1,0,-.032),.075)
        self.rod(GOLD,(x-w*.29,y,z+rise+.01),(x+w*.29,y,z+rise+.01),.10)
        for s in (-1,1):
            self.finial(x+s*w*.29,y,z+rise,.57)

    def onion_dome(self):
        x,y,z=0,8.12,20.75
        radius=3.19
        self.ring(IVORY[2],x,y,z-4.05,radius,radius,4.05,24)
        for low,r,h,color in ((z-4.00,3.31,.25,IVORY[4]),(z-3.68,3.37,.11,GOLD),
                              (z-.72,3.27,.25,IVORY[3]),(z-.42,3.36,.17,IVORY[4]),
                              (z-.22,3.37,.20,BRASS),(z-.04,3.48,.12,GOLD)):
            self.ring(color,x,y,low,r,r,h,36)
        for i in range(10):
            a=i*2*pi/10
            self.pilaster(x+3.17*sin(a),y-3.17*cos(a),z-3.58,2.93,.13)
        for u,y0 in ((0,y-radius-.04),(-1.42,y-2.88),(1.42,y-2.88)):
            self.lancet(u,y0,z-3.32,.79,1.36)
        profile=((0,3.39),(.18,3.44),(.63,3.43),(1.15,3.28),(1.68,2.99),
                 (2.20,2.56),(2.70,2.01),(3.12,1.45),(3.53,.94),(3.87,.54),(4.10,.22))
        ribs=12
        for sector in range(ribs):
            segments=8
            for row,((lo,r1),(hi,r2)) in enumerate(zip(profile,profile[1:])):
                def point(i,r,elevation):
                    angle=(sector+i/segments)*2*pi/ribs
                    relief=.071*sin(pi*i/segments)
                    return (x+(r+relief)*cos(angle),y+(r+relief)*sin(angle),z+elevation)
                for i in range(segments):
                    c=('#b9842b','#d49a34','#efbf51','#f1c75d','#e9b64c','#dfab3a','#d49c36','#c38c30')[i]
                    self.mesh(c,[point(i,r1,lo),point(i+1,r1,lo),point(i+1,r2,hi),point(i,r2,hi)],[(0,1,2,3)])
                self.rod(HONEY,point(0,r1+.030,lo),point(0,r2+.030,hi),.055,.052)
            a=sector*2*pi/ribs
            self.finial(3.43*cos(a),y+3.43*sin(a),z+.12,.50)
        self.ring(BRASS,x,y,z+4.09,.41,.33,.15,16)
        self.ellipsoid(GOLD,(x,y,z+4.36),(.24,.24,.27))
        self.finial(x,y,z+4.59,1.19)
        self.flags.append((x,y,z+5.77,1.13))

    def hall(self):
        self.section='Corps de logis'
        self.body(0,5.12,7.55,15.1,.20,15.55)
        for side in (-1,1):
            self.body(side*11.98,7.52,3.60,9.39,.20,10.65)
            self.slate_roof(side*11.98,7.52,10.75,4.29,9.86,3.58)
            for x in (side*11.05,side*12.8):
                for z in (3.13,6.36,8.55):
                    self.lancet(x,2.77,z,.70,.96)
            self.pilaster(side*11.98,2.62,5.03,5.17,.14)
            with self.along_side(side*13.84,7.52,side):
                for u in (-3.34,-1.11,1.11,3.34):
                    self.lancet(u,0,4.53,.91,1.83)
                    self.lancet(u,0,8.03,.52,1.02)
                for u in (-4.37,-2.23,0,2.23,4.37):
                    self.pilaster(u,-.08,4.12,5.84,.135)
                self.box(GOLD,0,-.15,4.12,9.48,.14,.082)
            self.body(side*7.13,11.65,6.48,2.61,.20,9.02)
            self.slate_roof(side*7.13,11.65,9.10,6.85,2.93,2.48)
            self.tower(side*10.23,11.48,.20,14.76,1.38,3.57,True)
            self.tower(side*4.42,5.78,8.92,16.95,.95,2.72)
            self.tower(side*3.68,-1.87,.27,14.15,1.31,3.42,True)
        self.slate_roof(0,4.15,15.60,8.05,14.0,3.10)
        self.onion_dome()
        self.body(0,-2.55,5.27,2.58,.29,13.80)
        self.slate_roof(0,-2.53,13.86,5.56,2.86,2.52)
        self.lancet(0,-3.89,1.45,1.72,2.50)
        self.lancet(0,-3.90,10.76,1.57,1.21)
        for side in (-1,1):
            self.pilaster(side*1.96,-4.01,1.23,11.76,.23)
            for z in (5.33,8.28,10.65):
                self.lancet(side*1.44,-3.91,z,.46,.75)
        self.banner(0,-4.13,10.18,2.52,5.38)
        self.crockets(0,-3.99,12.56,2.24)

    def perimeter(self):
        self.section='Galerias do recinto'
        self.body(0,13.86,26.90,.62,.20,3.82)
        for s in (-1,1):
            x=s*14.20
            self.body(x,3.86,.71,20.65,.20,3.73)
            self.body(x,-5.87,.70,5.21,.20,4.32)
            for y in (-3.5,-1,1.5,4,6.5,9,11.5,13.5):
                self.ring(IVORY[3],x,y,3.71,.27,.24,.46,8)
                self.finial(x,y,4.11,.42)
            for i in range(7):
                self.finial(s*(1+i*1.90),13.86,3.96,.40)
            self.tower(s*13.18,-6.73,.16,10.08,1.43,3.57,True)
            self.tower(s*13.20,12.5,.16,9.68,1.21,2.94)
            self.body(s*10.90,-4.92,3.48,2.97,.25,6.70)
            self.slate_roof(s*10.90,-4.92,6.79,3.93,3.54,2.74)
            self.lancet(s*10.90,-6.47,3.42,1.22,1.38)
            self.tower(s*7.20,-7.58,.25,10.93,1.05,3.07)

    def entrance(self):
        self.section='Portal imperial'
        y=-13.35
        self.arch_ring(0,y-.10,.93,4.72,2.48,.39,.78,False)
        for s in (-1,1):
            self.body(s*3.22,y,1.46,2.32,.94,6.41)
            self.pilaster(s*2.85,y-1.20,1.02,5.52,.24)
            self.pilaster(s*3.77,y-1.21,1.02,5.32,.20)
            self.lancet(s*3.23,y-1.20,3.52,.49,1.28)
            self.finial(s*3.50,y-1.03,6.48,.83)
            self.lantern(s*2.75,y-.75,2.24)
        # Two solid spandrels above the arch, with a clear passage underneath.
        opening=self.arch_path(0,.93,4.73,2.48,False)
        for s in (-1,1):
            curve=opening[12:] if s==1 else [(-x,z) for x,z in opening[12:]]
            contour=curve+[(s*2.52,3.41),(s*2.52,6.34),(0,6.34)]
            self.prism(IVORY[2],contour[::s],1.80,y+.11)
        self.ledge(0,y,6.49,7.85,2.05)
        self.prism(IVORY[4],[(-2.28,6.55),(2.28,6.55),(0,9.31)],1.37,y-.15)
        self.lancet(0,y-.87,6.73,.88,.61)
        for s in (-1,1):
            self.rod(GOLD,(s*2.24,y-.85,6.60),(0,y-.85,9.28),.064,.038)
            self.finial(s*1.93,y-.85,6.78,.41)
            self.finial(s*1.37,y-.85,7.34,.35)
        self.crockets(0,y-.96,6.79,4.02)
        self.finial(0,y-.79,9.21,.85)
        self.box(GOLD,0,y-.95,6.70,4.49,.086,.095)
        for s in (-1,1):
            self.section='left' if s==-1 else 'right'
            def top(x):
                return 3.40+sqrt(max(0,2.32**2-x**2))
            for i in range(9):
                u=s*(.044+i*.254)
                self.box(BRASS,u,y, (.94+top(u))/2,.106,.19,top(u)-.94)
                self.box(GOLD,u,y-.113,(1.05+top(u))/2,.043,.049,top(u)-1.05)
                if i<8:
                    b=s*(.044+(i+1)*.254)
                    self.rod(GOLD,(u,y-.045,top(u)),(b,y-.045,top(b)),.085)
            for z in (1.13,1.46,3.10):
                self.box(GOLD,s*1.18,y-.015,z,2.30,.23,.135)
                for i in range(7):
                    self.ellipsoid(HONEY,(s*(.21+i*.30),y-.158,z),(.051,.030,.047),8,4)
            self.prism(BRASS,[(s*.15,2.08),(s*.89,2.27),(s*.89,3.21),(s*.15,3.30)][::s],.15,y-.12)
            self.prism(GOLD,[(s*.52+.67*u,2.70+.92*v) for u,v in LION],.05,y-.215)

    def lantern(self,x,y,z):
        self.rod(BRASS,(x,y+.42,z-.21),(x,y,z-.18),.061)
        self.ring(BRASS,x,y,z-.27,.09,.165,.15,8)
        self.ellipsoid('#ffc66a',(x,y,z),(.13,.13,.23),10)
        self.ring(GOLD,x,y,z+.16,.19,.032,.18,8)

    def rock(self,x,y,z,w,d,h):
        n=7
        angles=[i*2*pi/n+self.rng.uniform(-.13,.13) for i in range(n)]
        factors=[self.rng.uniform(.81,1.20) for _ in angles]
        vertices=[(x+w*k*q*cos(a)+s*w*.12,y+d*k*q*sin(a),z+h*e+self.rng.uniform(-.08,.08))
                  for k,e,s in ((1,0,0),(.89,.55,0),(.61,1,1)) for a,q in zip(angles,factors)]
        self.mesh(IVORY[1],vertices,[tuple(range(n*2,n*3))])
        for row in range(2):
            for i in range(n):
                a=row*n+i
                b=row*n+(i+1)%n
                self.mesh(self.rng.choice((STONE,IVORY[0],IVORY[1])),
                          [vertices[k] for k in (a,b,b+n,a+n)],[(0,1,2,3)])

    def cypress(self,x,y,z,h,r):
        self.ring('#624832',x,y,z,r*.18,r*.13,h*.56,7)
        for i in range(6):
            j=i/6
            self.ellipsoid(GREEN[1+i%3],(x+.11*r*sin(i),y+.16*r*cos(i),z+h*(.30+j*.64)),
                           (r*(1-j*.67),r*(.85-j*.54),h*(.29-j*.13)),9,5)

    def lion(self,x,y,z,s):
        # Sculpted seat, ruff, forelegs, muzzle and tail in warm limestone.
        self.section='Leões esculpidos'
        body,light,mane=IVORY[2],IVORY[4],'#b09876'
        self.ellipsoid(body,(x,y+.35,z+1.00),(.54,.63,.90))
        self.ellipsoid(light,(x,y-.01,z+1.42),(.43,.43,.55))
        self.ellipsoid(mane,(x,y-.13,z+1.83),(.49,.43,.55))
        self.ellipsoid(light,(x,y-.35,z+1.96),(.35,.31,.34))
        for sign in (-1,1):
            self.ellipsoid(body,(x+sign*.42,y+.38,z+.53),(.28,.46,.57))
            self.ellipsoid(light,(x+sign*.23,y-.39,z+.61),(.145,.17,.57))
            self.ellipsoid(light,(x+sign*.24,y-.57,z+.17),(.21,.29,.15))
            self.ellipsoid(body,(x+sign*.49,y+.02,z+.14),(.18,.25,.13))
            self.ellipsoid(body,(x+sign*.25,y-.30,z+2.19),(.134,.10,.15))
            self.ellipsoid(mane,(x+sign*.25,y-.37,z+2.21),(.069,.025,.078))
            self.ellipsoid(light,(x+sign*.105,y-.59,z+1.84),(.147,.15,.117))
            self.ellipsoid(mane,(x+sign*.157,y-.612,z+2.028),(.069,.026,.045))
            for i in range(6):
                a=i*.54
                at=(x+sign*(.19+.25*sin(a)),y-.27-.085*sin(a),z+1.80+.38*cos(a))
                self.ellipsoid(light,at,(.119,.124,.151),9,5)
        self.ellipsoid(mane,(x,y-.709,z+1.905),(.12,.052,.063))
        self.ellipsoid(body,(x,y-.565,z+1.741),(.176,.14,.073))
        path=[(x,y+.69,z+.44),(x+s*.48,y+.77,z+.34),(x+s*.68,y+.43,z+.19),
              (x+s*.55,y+.08,z+.13),(x+s*.30,y-.15,z+.13)]
        for a,b in zip(path,path[1:]):
            self.rod(body,a,b,.074,.078)
            self.ellipsoid(body,b,(.080,.080,.080),8,5)

    def waterfalls(self):
        for s in (-1,1):
            x=s*9.05
            self.section='Terraços ajardinados'
            self.box(IVORY[0],x,-9.88,1.48,9.96,4.40,2.94)
            self.box(GREEN[1],x,-9.83,2.96,9.86,4.33,.12)
            self.body(s*4.41,-11.47,1.44,3.70,.22,2.62)
            self.body(s*13.50,-11.37,1.53,2.67,.18,2.92)
            for i in range(13):
                u=(i-6)*.74
                self.rock(x+u,-12.44+self.rng.uniform(-.37,.21),.13,self.rng.uniform(.48,.79),
                          self.rng.uniform(.56,.84),2.14+self.rng.random()*.89)
            for i in range(8):
                u=(i-3.5)*1.13
                self.rock(x+u,-15.89+self.rng.uniform(-.25,.12),.13,.66,.46,.23+self.rng.random()*.43)
            self.ring(IVORY[1],s*4.88,-13.91,.15,1.17,1.15,.30,16)
            self.ring(IVORY[3],s*4.88,-13.91,.45,.93,.87,1.72,16)
            self.ring(IVORY[4],s*4.88,-13.91,2.17,1.02,1.02,.23,16)
            self.lion(s*4.88,-13.91,2.40,s)
            self.section='Vegetação dos jardins'
            for u,y,h,r in ((2.48,-9.98,2.94,.63),(4.10,-10.54,2.06,.52),
                            (-2.89,-9.93,2.37,.47),(-3.06,-15.79,1.30,.41),(3.15,-15.91,1.23,.36)):
                self.cypress(x+s*u,y,3.00 if y>-12 else .20,h,r)
            for i in range(25):
                u=self.rng.uniform(1.88,4.24)*(-1 if i%2 else 1)
                y=self.rng.uniform(-13.27,-12.50) if i%3 else self.rng.uniform(-16.18,-15.67)
                z=2.95 if y>-12.85 else .29
                r=self.rng.uniform(.10,.32)
                self.ellipsoid(GREEN[i%4],(x+u,y,z),(r*1.3,r,r*.86),8,5)
                if i%4==0:
                    self.ellipsoid(('#e6bd79','#b788a6')[i%2],(x+u,y,z+.14),(r*.59,r*.60,r*.47),7,4)
            self.section='Espelhos e quedas de água'
            self.box(WATER[0],x,-11.74,3.025,4.32,1.12,.086)
            self.ellipsoid(WATER[0],(x,-14.47,.214),(4.04,1.93,.040),32,5)
            self.ellipsoid(WATER[1],(x,-14.60,.250),(3.66,1.50,.025),32,5)
            # An opaque core carries thin streamlets and translucent-looking whitewater.
            segments=15
            def point(u,t,bump=0):
                return (x+u*(.94+.24*t),-12.27-1.70*t-.52*t*t-bump,
                        .28+2.82*(1-t**1.65)+.059*cos(u*4.8)*(1-t))
            columns=30
            vertices=[point((i-columns/2)*.144,j/segments)
                      for j in range(segments+1) for i in range(columns+1)]
            faces=[]
            for j in range(segments):
                for i in range(columns):
                    k=j*(columns+1)+i
                    faces.append((k,k+1,k+columns+2,k+columns+1))
            self.mesh(WATER[1],vertices,[face[::-1] for face in faces])
            for i in range(62):
                u=self.rng.uniform(-2.11,2.11)
                start=self.rng.uniform(.0,.85)
                length=min(1-start,self.rng.uniform(.13,.56))
                w=self.rng.uniform(.019,.078)
                color=('#2c899e','#4eb4c8','#5ac7d8',WATER[2],WATER[3])[i%5]
                vertices=[point(u+s0*w*(.36+.64*sin(pi*j/6)),start+length*j/6,.030)
                          for j in range(7) for s0 in (-1,1)]
                self.mesh(color,vertices,[(2*j,2*j+2,2*j+3,2*j+1) for j in range(6)])
            for i in range(35):
                u=self.rng.uniform(-2.55,2.55)
                y=self.rng.uniform(-15.03,-14.0)
                r=self.rng.uniform(.08,.34)
                self.ellipsoid(WATER[2+i%2],(x+u,y,.29),(r,r*.63,r*.18),8,4)

    def floor(self):
        self.section='Embasamento e escadaria'
        self.box(GREEN[1],0,0,-.29,32.7,31.94,.92)
        self.box(GREEN[2],0,.23,.159,32.62,31.62,.088)
        for side in (-1,1):
            self.box(STONE,side*16.24,.33,-.02,.26,31.34,.38)
            self.box(GREEN[0],side*16.25,.33,.18,.26,31.34,.04)
        for row in range(26):
            for i in range(12):
                x=(i-5.5)*.59
                y=-12.60+(row+.5)*.63
                height=max(.216,.96-max(0,y+11.80)*.29)
                self.box(IVORY[1+(row*5+i*3)%4],x,y,height-.052,.574,.614,.104)
        for side in (-1,1):
            for row in range(4):
                for i in range(16):
                    self.box(IVORY[2+(row+i)%2],side*(3.53+i*.53),-2.14+row*.53,.212,.518,.518,.025)
            for x,z in ((4.66,-5.3),(6.40,-3.63),(12.62,-5.7),(11.95,-.86)):
                self.ring(IVORY[2],side*x,z,.20,.38,.44,.28,10)
                self.ellipsoid(GREEN[2],(side*x,z,.62),(.38,.38,.28),9,5)
        for i in range(7):
            top=.216+(i+1)*.744/7
            y=-16.97+(i+.5)*.48
            self.box(IVORY[2],0,y,(top+.145)/2,6.24,.483,top-.145)
            self.box(IVORY[4],0,y-.204,top-.027,6.26,.077,.066)
            self.box(RED,0,y,top+.014,2.79,.48,.03)
            self.box(HEM,0,y-.238,top-.032,2.79,.034,.091)
            for s in (-1,1):
                self.box(GOLD,s*1.32,y,top+.035,.057,.48,.016)
                self.box(IVORY[3],s*3.20,y,top+.137,.34,.49,.32)
        self.box(IVORY[3],0,-13.106,.5525,6.22,1.01,.815)
        for s in (-1,1):
            for y in (-16.35,-11.25):
                self.pilaster(s*3.38,y,.27 if y<-15 else .89,1.05,.17)
                self.lantern(s*3.38,y-.13,1.48 if y<-15 else 2.13)
        self.box(RED,0,-12.955,.974,2.79,1.31,.037)
        for s in (-1,1):
            self.box(GOLD,s*1.32,-12.955,.997,.056,1.31,.016)

    def lookout(self):
        self.section='Mirante acessível'
        for i in range(16):
            top=.21+(i+1)*5.79/16
            self.box(IVORY[2+i%3],7.4,-5.60+(i+.5)*9.92/16,(top+.19)/2,1.78,9.92/16+.005,top-.19)
        self.box(IVORY[3],7.4,6.9,5.92,5.15,5.15,.16)
        for x in (5.14,9.66):
            for y in (4.68,9.12):
                self.pilaster(x,y,.22,8.47,.24)
        for x in (4.825,9.975):
            self.box(IVORY[2],x,6.9,6.44,.24,5.15,.88)
        for x,y,w in ((7.4,9.475,5.15),(5.66,4.325,1.65),(9.14,4.325,1.65)):
            self.box(IVORY[2],x,y,6.44,w,.24,.88)
        self.slate_roof(7.4,6.9,8.69,5.65,5.65,2.30)

    def make(self,collection):
        self.floor()
        self.perimeter()
        self.waterfalls()
        self.lookout()
        self.hall()
        self.entrance()
        pivots={}
        for name,sign in (('left',-1),('right',1)):
            leaf=bpy.data.objects.new('Dobradiça imperial '+name,None)
            collection.objects.link(leaf)
            leaf.location=(2.36*sign,-13.35,.18)
            leaf['castleLeaf']=sign
            pivots[name]=leaf
        for (section,color),(vertices,faces) in self.parts.items():
            name=f'{section} {color}'
            mesh=bpy.data.meshes.new(name)
            pivot=pivots.get(section)
            if pivot:
                vertices=[tuple(Vector(vertex)-pivot.location) for vertex in vertices]
            mesh.from_pydata(vertices,[],faces)
            mesh.validate()
            mesh.update()
            if section in ('Leões esculpidos','Vegetação dos jardins','Espelhos e quedas de água'):
                for polygon in mesh.polygons:
                    polygon.use_smooth=True
            mesh.materials.append(imperial_material(color))
            obj=bpy.data.objects.new(name,mesh)
            collection.objects.link(obj)
            obj.parent=pivot
        for i,(x,y,z,scale) in enumerate(self.flags):
            mast=bpy.data.objects.new(f'Mastro imperial {i+1}',None)
            collection.objects.link(mast)
            mast.location=(x,y,z)
            mast['castleFlag']=True
            mast['flagScale']=scale
            rod_data=bpy.data.meshes.new(f'Haste imperial {i+1}')
            radius=.027
            coords=[(radius*cos(j*pi/4),radius*sin(j*pi/4),h) for h in (-.29,.93*scale) for j in range(8)]
            rod_data.from_pydata(coords,[],[(j,(j+1)%8,(j+1)%8+8,j+8) for j in range(8)])
            rod_data.materials.append(imperial_material(GOLD))
            rod=bpy.data.objects.new(f'Haste imperial {i+1}',rod_data)
            collection.objects.link(rod)
            rod.parent=mast


def imperial_material(color):
    # Distinct materials avoid changing the earlier levels that share the base palette.
    name='Imperial '+color
    found=bpy.data.materials.get(name)
    if found:
        return found
    mat=pigment(color).copy()
    mat.name=name
    shader=next(node for node in mat.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
    if color in (GOLD,HONEY,BRASS,'#b9842b','#d49a34','#efbf51','#f1c75d',
                 '#e9b64c','#dfab3a','#d49c36','#c38c30'):
        shader.inputs['Metallic'].default_value=.54
        shader.inputs['Roughness'].default_value=.31
        shader.inputs['Emission Color'].default_value=shader.inputs['Base Color'].default_value
        shader.inputs['Emission Strength'].default_value=.055
    elif color in (*WATER,'#2c899e','#4eb4c8','#5ac7d8'):
        shader.inputs['Roughness'].default_value=.23
        shader.inputs['Metallic'].default_value=.11
        shader.inputs['Emission Color'].default_value=shader.inputs['Base Color'].default_value
        shader.inputs['Emission Strength'].default_value=.18
    elif color=='#ffc66a':
        shader.inputs['Emission Color'].default_value=shader.inputs['Base Color'].default_value
        shader.inputs['Emission Strength'].default_value=2.4
    elif color in BLUE:
        shader.inputs['Roughness'].default_value=.67
    return mat


def studio(scene,collection):
    backdrop=bpy.data.collections.new('Estúdio de apresentação')
    scene.collection.children.link(backdrop)
    rig=Palace()
    for mast in (obj for obj in collection.objects if obj.get('castleFlag')):
        x,y,z=mast.location
        s=mast['flagScale']
        # Cloth for the still render. The game supplies its own animated fabric.
        columns,rows=19,10
        points=[]
        for row in range(rows+1):
            for i in range(columns+1):
                u,v=i/columns,row/rows
                points.append((x+u*1.6*s,y+sin(u*7.0)*u*.26*s,
                               z+(.88-.45*v+.16*u-.27*u*v)*s))
        faces=[(r*(columns+1)+i,r*(columns+1)+i+1,(r+1)*(columns+1)+i+1,(r+1)*(columns+1)+i)
               for r in range(rows) for i in range(columns)]
        rig.mesh(RED,points,faces+ [face[::-1] for face in faces])
    rig.box('#274144',0,0,-1.09,300,300,.58)
    for (section,color),(vertices,faces) in rig.parts.items():
        mesh=bpy.data.meshes.new('Estúdio '+color)
        mesh.from_pydata(vertices,[],faces)
        mesh.materials.append(imperial_material(color))
        obj=bpy.data.objects.new('Estúdio '+color,mesh)
        backdrop.objects.link(obj)

    def target(obj,point):
        obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()

    camera=bpy.data.cameras.new('Retrato imperial')
    camera.type='ORTHO'
    camera.ortho_scale=53
    scene.camera=bpy.data.objects.new('Retrato imperial',camera)
    backdrop.objects.link(scene.camera)
    scene.camera.location=(31,-59,37)
    target(scene.camera,(0,0,9.40))

    def area(name,at,color,energy,size,point):
        light=bpy.data.lights.new(name,'AREA')
        light.energy=energy
        light.color=color
        light.shape='DISK'
        light.size=size
        obj=bpy.data.objects.new(name,light)
        backdrop.objects.link(obj)
        obj.location=at
        target(obj,point)

    area('Sol da manhã',(-25,-33,44),(1.0,.84,.66),29000,21,(0,0,7))
    area('Reflexo do céu',(30,-19,23),(.61,.81,1.0),17500,28,(0,0,8))
    area('Luz de contorno',(2,21,28),(1,.78,.47),23000,18,(0,0,11))
    for s in (-1,1):
        area('Luz das lanternas',(s*3.18,-14.6,2.58),(1,.46,.13),90,1.2,(s*2.61,-13.72,2.12))
    world=bpy.data.worlds.new('Céu do estúdio imperial')
    world.use_nodes=True
    background=next(node for node in world.node_tree.nodes if node.type=='BACKGROUND')
    background.inputs['Color'].default_value=(.19,.29,.38,1)
    background.inputs['Strength'].default_value=.30
    scene.world=world
    scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=1200
    scene.render.resolution_y=1100
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.shading.color_type='MATERIAL'
                area.spaces.active.region_3d.view_perspective='CAMERA'


def build():
    scene=bpy.data.scenes.new('Palácio Imperial de Valdória')
    bpy.context.window.scene=scene
    collection=bpy.data.collections.new('Palácio imperial jogável')
    scene.collection.children.link(collection)
    Palace().make(collection)
    export_palace(collection)
    studio(scene,collection)
    # The CLI runs in its own Blender process. Discard only its default scene.
    for old in list(bpy.data.scenes):
        if old!=scene:
            bpy.data.scenes.remove(old)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/'palacio-imperial.blend'),compress=True)


def export_palace(collection):
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'src'/'assets'/'stockade-nivel-10.glb'),
                              export_format='GLB',collection=collection.name,export_yup=True,export_extras=True,
                              export_meshopt_compression_enable=True)


if __name__=='__main__':
    build()
