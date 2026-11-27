"""Build Valdória's ten residential models and a Blender presentation scene."""
from contextlib import contextmanager
from math import cos, pi, sin, sqrt
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_high_fortifications import Kit, ROOT, pigment

OAK, DARK, CUT = '#70432c', '#4c3028', '#9f7145'
IVORY, SAND, CREAM = '#e6d7ba', '#c0a789', '#eadbb2'
STONE = ('#746c62','#9b8f7c','#b4a38a','#cebea0')
CLAY = ('#853e33','#9b4735','#a8563c','#bf6243','#c06b4f')
REED = ('#92703a','#ab843d','#bc9549','#c8a452','#d4ae5e')
SLATE = ('#344d58','#3f5a65','#486574','#55717e','#637f89')
TURQUOISE = ('#294952','#305762','#3b6472','#46717c','#54818b')
COBALT = ('#1b385b','#234771','#2e5481','#355f90','#4670a0')
BOURGOGNE = ('#593b44','#70444a','#824a50','#8f5655','#9e645f')
FOLIAGE = ('#35583e','#527146','#728b49','#92a35b')
GOLD, COPPER = '#d5a452', '#a76e42'
GLASS, SHADE, FLAME = '#567185', '#252c32', '#f0bc70'
TITLES = (
    'Casebre de palha','Casa do oleiro','Casa de enxaimel','Casa da varanda',
    'Casa de cantaria','Casa do torreão','Solar dos jardins','Palacete das arcadas',
    'Residência da corte','Vila real',
)


class Architecture(Kit):
    def __init__(self,level):
        super().__init__(3)
        self.level=level
        self.section='Moradia'
        self.offset=(0,0,0,1,0)

    @contextmanager
    def at(self,x=0,y=0,z=0,angle=0):
        previous=self.offset
        px,py,pz,pc,ps=previous
        c,s=cos(angle),sin(angle)
        self.offset=(px+x*pc-y*ps,py+x*ps+y*pc,pz+z,pc*c-ps*s,ps*c+pc*s)
        try:
            yield
        finally:
            self.offset=previous

    def mesh(self,color,vertices,faces):
        x,y,z,c,s=self.offset
        super().mesh(color,[(x+u*c-v*s,y+u*s+v*c,z+q) for u,v,q in vertices],faces)

    def rod(self,color,start,end,radius,tip=None,sides=7):
        a,b=Vector(start),Vector(end)
        axis=(b-a).normalized()
        u=axis.cross(Vector((0,1,0) if abs(axis.z)>.8 else (0,0,1))).normalized()
        v=axis.cross(u)
        tip=radius if tip is None else tip
        vertices=[tuple(p+r*(u*cos(i*2*pi/sides)+v*sin(i*2*pi/sides)))
                  for p,r in ((a,radius),(b,tip)) for i in range(sides)]
        faces=[tuple(range(sides-1,-1,-1)),tuple(range(sides,sides*2))]
        faces.extend((i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides))
        self.mesh(color,vertices,faces)

    def ball(self,color,x,y,z,rx,ry,rz,tilt=0):
        sides=9
        vertices=[(x+rx*cos(a)*sin(p)+tilt*cos(p),y+ry*sin(a)*sin(p),z+rz*cos(p))
                  for p in (pi/4,pi/2,3*pi/4) for a in (i*2*pi/sides for i in range(sides))]
        vertices.extend(((x+tilt,y,z+rz),(x-tilt,y,z-rz)))
        faces=[(27,i,(i+1)%sides) for i in range(sides)]
        for row in range(2):
            for i in range(sides):
                a=row*sides+i
                b=row*sides+(i+1)%sides
                faces.append((a,a+sides,b+sides,b))
        faces.extend((28,18+(i+1)%sides,18+i) for i in range(sides))
        self.mesh(color,vertices,faces)

    def masonry_faces(self,w,d,low,high,colors=STONE):
        self.box(colors[0],0,0,(low+high)/2,w,d,high-low)
        rows=max(1,round((high-low)/.35))
        for angle,span,depth in ((0,w,d),(pi,w,d),(pi/2,d,w),(-pi/2,d,w)):
            # Transform the thin blocks around the current building, including wings.
            count=max(1,round(span/.61))
            for row in range(rows):
                cuts=[-span/2]+[span*((i+(.23 if row%2 else -.21))/count-.5) for i in range(1,count)]+[span/2]
                for a,b in zip(cuts,cuts[1:]):
                    c=self.rng.choice(colors[1:])
                    x,y=(a+b)/2,-depth/2
                    center=(x*cos(angle)-y*sin(angle),x*sin(angle)+y*cos(angle))
                    width=b-a-.018
                    bw,bd=(width,.065) if angle in (0,pi) else (.065,width)
                    self.box(c,*center,low+(row+.5)*(high-low)/rows,bw,bd,(high-low)/rows-.025)

    def band(self,w,d,z,color=IVORY,profile=.12):
        self.box(color,0,0,z,w+.16,d+.16,profile)
        self.box(STONE[2] if color==IVORY else color,0,0,z-profile*.66,w+.095,d+.095,profile*.40)

    def timber(self,w,d,low,high,spacing=1.4,color=OAK,braces=False,openings=()):
        for z in (low+.08,high-.075):
            self.band(w,d,z,color,.15)
        for s in (-1,1):
            for x in (-w*.473,w*.473):
                self.box(color,x,s*(d/2+.033),(high+low)/2,.16,.10,high-low)
            for y in (-d*.30,0,d*.30):
                self.box(color,s*(w/2+.035),y,(high+low)/2,.10,.13,high-low)
            for i in range(1,round(w/spacing)):
                x=-w/2+i*w/round(w/spacing)
                if all(abs(x-mid)>clear for mid,clear in openings):
                    self.box(color,x,s*(d/2+.036),(low+high)/2,.115,.087,high-low)
            if braces:
                for side in (-1,1):
                    self.rod(color,(side*w*.43,s*(d/2+.050),low+.20),
                             (side*(w*.43-.47),s*(d/2+.050),high-.14),.052)
                    self.rod(CUT,(side*(w*.43-.43),s*(d/2+.048),low+.19),
                             (side*w*.43,s*(d/2+.048),high-.14),.043)

    def tiled_roof(self,w,d,z,rise,palette,hip=0,upper=1,trim=DARK):
        # The cover is solid below its rows of individual slate, clay or reed.
        front=((-w/2,-d/2),(w/2,-d/2))
        back=((w/2,d/2),(-w/2,d/2))
        gable_top_left=(-w/2+w*hip,-d*(1-upper)/2)
        gable_top_right=(w/2-w*hip,-d*(1-upper)/2)
        rear_top_right=(gable_top_right[0],d*(1-upper)/2)
        rear_top_left=(gable_top_left[0],d*(1-upper)/2)
        faces=[(*front,gable_top_left,gable_top_right),(*back,rear_top_right,rear_top_left),
               (front[1],back[0],gable_top_right,rear_top_right),
               (back[1],front[0],rear_top_left,gable_top_left)]
        for i,(a,b,c,e) in enumerate(faces):
            def point(u,t,height=0):
                return ((a[0]*(1-u)+b[0]*u)*(1-t)+(c[0]*(1-u)+e[0]*u)*t,
                        (a[1]*(1-u)+b[1]*u)*(1-t)+(c[1]*(1-u)+e[1]*u)*t,z+rise*t+height)
            self.mesh(palette[0],[point(0,0),point(1,0),point(1,1),point(0,1)],[(0,1,2,3)])
            if i<2 or hip>0:
                count=max(1,round((abs(a[0]-b[0])+abs(a[1]-b[1]))/(.25 if palette==REED else .35)))
                rows=max(3,round(rise/(.29 if palette==REED else .23)))
                for row in range(rows):
                    lo,hi=row/rows,(row+1)/rows
                    boundaries=[0]+[(j+(.27 if row%2 else -.26))/count for j in range(1,count)]+[1]
                    for left,right in zip(boundaries,boundaries[1:]):
                        a0=point(left,lo,.082 if palette==REED else .055)
                        a1=point(right-.005,lo,.07 if palette==REED else .050)
                        a2=point(right-.005,hi,.026)
                        a3=point(left,hi,.026)
                        self.mesh(self.rng.choice(palette),(a0,a1,a2,a3),[(0,1,2,3)])
            self.rod(trim,point(0,0),point(1,0),.076)
            if i<2 or hip>0:
                self.rod(trim,point(0,0,.045),point(0,1,.075),.067)
        if upper>=.99:
            self.rod(trim,(*gable_top_left,z+rise+.07),(*gable_top_right,z+rise+.07),.095)
        else:
            self.box(palette[1],0,0,z+rise,w*(1-2*hip),d*(1-upper),.12)

    def roof_cross(self,w,d,z,rise,palette,x=0,y=0,trim=DARK):
        with self.at(x,y,angle=pi/2):
            self.tiled_roof(d,w,z,rise,palette,trim=trim)

    def hip(self,w,d,z,rise,palette,trim=DARK):
        self.tiled_roof(w,d,z,rise,palette,.26,1,trim)

    def turret_roof(self,x,y,z,r,h,palette,dome=False):
        perimeter=36
        rows=max(6,round(h/.19))
        def shape(t):
            return r*(.02+.98*((sqrt(max(0,1-t*t)) if dome else (1-t)**1.19)))
        for row in range(rows):
            lo,hi=row/rows,(row+1)/rows
            for i in range(perimeter):
                a,b=i*2*pi/perimeter,(i+.986)*2*pi/perimeter
                points=[(x+(shape(t)+extra)*cos(u),y+(shape(t)+extra)*sin(u),z+h*t)
                        for u,t,extra in ((a,lo,.021),(b,lo,.021),(b,hi,0),(a,hi,0))]
                self.mesh(self.rng.choice(palette),points,[(0,1,2,3)])
        for i in range(8):
            a=i*pi/4
            for row in range(6):
                lo,hi=row/6,(row+1)/6
                self.rod(GOLD if dome else COPPER,
                         (x+(shape(lo)+.03)*cos(a),y+(shape(lo)+.03)*sin(a),z+h*lo),
                         (x+(shape(hi)+.03)*cos(a),y+(shape(hi)+.03)*sin(a),z+h*hi),.027,.022)
        self.ring(COPPER,x,y,z-.065,r+.036,r+.01,.115,24)
        self.ring(GOLD,x,y,z+h-.018,.12,.12,.08,10)
        self.ball(GOLD,x,y,z+h+.13,.105,.105,.13)
        self.ring(GOLD,x,y,z+h+.22,.046,.007,.23,8)

    @staticmethod
    def arch(x,z,w,stem,cap):
        return [(x-w/2,z),(x+w/2,z)]+[(x+cos(i*pi/16)*w/2,z+stem+sin(i*pi/16)*cap) for i in range(17)]

    def opening(self,x,y,z,w,h,style='window',trim=OAK,shutters=False):
        is_door=style=='door'
        cap=h*.20 if style in ('arch','door') else 0
        def profile(width,bottom,stem,top):
            return self.arch(x,bottom,width,stem,top) if top else [
                (x-width/2,bottom),(x+width/2,bottom),(x+width/2,bottom+stem),(x-width/2,bottom+stem)]
        self.prism(trim,profile(w+.17,z-.055,h-cap+.095,cap+.038 if cap else 0),.17,y+.016)
        self.prism(SHADE,profile(w,z,h-cap,cap),.10,y-.072)
        fill=w*.86
        material=OAK if is_door else GLASS
        self.prism(material,profile(fill,z+.052,h-cap-.12,cap*.90),.033,y-.13)
        if is_door:
            for i in (-2,-1,0,1,2):
                self.box(DARK,x+i*fill/5.3,y-.151,z+(h-cap)*.51,.022,.043,h-cap-.108)
            for t in (.24,.68):
                self.box(COPPER,x,y-.176,z+h*t,fill*.96,.063,.065)
            self.ball(GOLD,x+w*.25,y-.197,z+h*.42,.046,.023,.046)
        else:
            self.box('#a6bdc1',x-fill*.21,y-.155,z+(h-cap)*.72,fill*.20,.016,max(.12,(h-cap)*.31))
            self.box(trim,x,y-.162,z+.50*(h-cap),.061,.050,h-cap-.02)
            self.box(trim,x,y-.163,z+.51*(h-cap),w-.055,.051,.052)
            self.box(trim,x,y-.026,z-.075,w+.29,.45,.10)
            if shutters:
                for sign in (-1,1):
                    a=x+sign*(w*.69+.044)
                    self.box('#526348',a,y-.12,z+h*.49,w*.31,.088,h*.92)
                    for j in range(6):
                        self.box('#71805b',a,y-.172,z+h*(.15+j*.137),w*.28,.035,.036)

    def chimney(self,x,y,z,height=.82,brick=False):
        colors=('#6d413b','#985849','#ac6f5e','#bc7d60') if brick else STONE
        with self.at(x,y):
            self.masonry_faces(.57,.63,z,z+height,colors)
            self.band(.61,.67,z+height,colors[2],.13)
            self.box(SHADE,0,0,z+height+.067,.37,.40,.014)

    def entry_steps(self,x,y,z=0,w=1.12,count=3):
        for i in range(count):
            top=z+.10+i*.095
            self.box(STONE[2+i%2],x,y-.32+i*.18,top/2,w+.16-i*.064,.35,top)

    def boxwood(self,x,y,z,scale=.5,flowers=False):
        colors=('#d3a06c','#c36e7c','#e3d58d')
        self.ring('#93674b',x,y,z,.32*scale,.41*scale,.39*scale,9)
        for i in range(7):
            angle=i*pi*.797
            r=scale*(.13+i%3*.05)
            height=z+scale*(.54+i%4*.08)
            self.ball(FOLIAGE[i%4],x+cos(angle)*r,y+sin(angle)*r,height,scale*.29,scale*.27,scale*.25)
            if flowers and i%2==0:
                self.ball(colors[i%3],x+cos(angle)*r,y+sin(angle)*r,height+scale*.19,
                          scale*.093,scale*.095,scale*.102)

    def planter(self,x,y,z,w=.92):
        self.box(CUT,x,y,z,w,.33,.23)
        self.box(DARK,x,y,z+.11,w*.94,.28,.041)
        for i in range(8):
            r=w*(i/8-.435)
            self.ball(FOLIAGE[i%4],x+r,y,z+.22,.12,.12,.14)
            if i%2:
                self.ball(('#be6a7d','#e8be81')[i%3==0],x+r,y-.024,z+.33,.062,.066,.081)

    def column(self,x,y,z,h,r=.12,gilt=False):
        self.box(STONE[2],x,y,z+.074,r*3.12,r*3.12,.15)
        self.ring(IVORY,x,y,z+.14,r*1.24,r,h-.27,10)
        self.ring(GOLD if gilt else SAND,x,y,z+h-.14,r,r*1.32,.083,10)
        self.box(IVORY,x,y,z+h-.035,r*2.89,r*2.89,.084)

    def railing(self,y,z,left,right,h,color=OAK):
        self.rod(color,(left,y,z+h),(right,y,z+h),.049)
        self.rod(color,(left,y,z+.12),(right,y,z+.12),.036)
        count=max(2,round((right-left)/.25))
        for i in range(count+1):
            x=left+(right-left)*i/count
            self.rod(color,(x,y,z),(x,y,z+h),.052 if i%4==0 else .025)

    def pad(self,w,d,x=0,y=0):
        self.box(STONE[0],x,y,.062,w,d,.15)
        self.box(STONE[2],x,y,.152,w-.075,d-.075,.068)

    def instantiate(self,collection,label):
        objects=[]
        for (_,color),(vertices,faces) in self.parts.items():
            name=f'{label} {color}'
            mesh=bpy.data.meshes.new(name)
            mesh.from_pydata(vertices,[],faces)
            mesh.validate()
            mesh.update()
            mesh.materials.append(material(color))
            obj=bpy.data.objects.new(name,mesh)
            collection.objects.link(obj)
            objects.append(obj)
        return objects


class House(Architecture):
    def straw_roof(self):
        width,depth,base,rise=6.62,5.09,2.36,1.49
        rows,columns=7,27
        def point(u,t,side,lift=0):
            ripple=(.052*sin(u*74)+.035*sin(u*31))*(1-t)
            return (width*(u-.5),side*(depth/2*(1-t)+ripple),
                    base+rise*(1-(1-t)**1.71)+lift+.8*ripple)
        for side in (-1,1):
            for row in range(rows):
                a,b=row/rows,(row+1)/rows
                for i in range(columns):
                    left,right=i/columns,(i+1)/columns
                    backing=(point(left,a,side),point(right,a,side),point(right,b,side),point(left,b,side))
                    strip=(point(left,a,side,.10),point(right-.002,a,side,.08),
                           point(right-.002,b,side,.04),point(left,b,side,.042))
                    self.mesh(REED[0],backing,[(0,1,2,3)[::-side]])
                    self.mesh(self.rng.choice(REED),strip,[(0,1,2,3)[::-side]])
            for i in range(columns):
                x,y,z=point((i+.5)/columns,0,side)
                self.rod(REED[2+i%3],(x,y-side*.15,z+.12),(x-.024,y,z-.083),.09,.05)
        with self.at(angle=pi/2):
            # Form a solid end wall below the rounded bundles of straw.
            silhouette=[(0,base)]+[(v,base+rise*(1-(abs(v)/(depth/2))**1.71)-.035)
                                    for v in [depth/2*(i/12-1) for i in range(25)]]
            self.prism(CUT,silhouette[::-1],width-.08)
        self.rod(REED[3],(-width/2,0,base+rise), (width/2,0,base+rise),.107)

    def hut(self):
        self.pad(6.07,4.64)
        self.box('#bb9b61',0,0,1.26,5.86,4.38,2.16)
        self.timber(5.86,4.38,.21,2.37,1.17,CUT,openings=((-1.45,.54),(.69,.60),(2.02,.48)))
        for i in range(23):
            x=(i-11)*.244
            self.box(('#a98352','#bc9c68','#c1a16b')[i%3],x,2.202,.63,.231,.053,.83+(i%4)*.095)
        self.straw_roof()
        self.opening(.69,-2.24,.18,.86,1.65,'door',DARK)
        for x in (-1.45,2.02): self.opening(x,-2.23,1.10,.57,.56)
        self.entry_steps(.69,-2.31,count=2)
        self.boxwood(2.44,-2.59,.018,.55,True)
        for i in range(6):
            x=-2.18+(i%3)*.22
            z=.18+(i//3)*.22
            self.rod(CUT if i%2 else OAK,(x,-2.52,z),(x,-2.04,z),.104)

    def potter(self):
        self.pad(6.72,5.25)
        self.masonry_faces(6.56,5.10,.16,.74)
        self.box('#dfbd85',0,0,1.88,6.56,5.10,2.30)
        self.band(6.56,5.10,2.98,CUT)
        self.tiled_roof(7.34,5.90,3.04,1.36,CLAY,trim=CLAY[0])
        self.chimney(2.21,.60,3.47,1.08,True)
        self.opening(0,-2.59,.23,.97,2.01,'door',OAK)
        for x in (-2.02,2.02):
            self.opening(x,-2.59,1.11,.86,.92,shutters=True)
            self.planter(x,-2.81,.98,.93)
        self.entry_steps(0,-2.58)
        self.boxwood(-1.02,-2.95,.027,.73,True)

    def half_timber(self):
        self.pad(6.52,5.61)
        self.masonry_faces(6.34,5.41,.16,2.62,('#9d8a6d','#baa37d','#c8b58f','#d5c39d'))
        self.box(IVORY,0,-.08,3.58,7.14,5.66,2.14)
        with self.at(0,-.08):
            self.timber(7.14,5.66,2.55,4.65,1.36,braces=True,openings=((-1.93,.45),(0,.45),(1.93,.45)))
        self.tiled_roof(7.91,6.30,4.64,1.37,BOURGOGNE)
        self.roof_cross(2.76,3.42,4.63,1.57,BOURGOGNE,y=-1.54)
        self.prism(IVORY,[(-1.31,4.53),(1.31,4.53),(0,6.11)],.11,-3.22)
        self.opening(0,-3.29,4.84,.56,.70,'arch')
        for x in (-1.93,0,1.93):
            self.opening(x,-2.96,3.19,.71,1.04)
            self.box(OAK,x,-2.88,2.51,.13,.60,.29)
        for x in (-1.94,1.94): self.opening(x,-2.76,1.03,.90,.88)
        self.opening(0,-2.76,.21,.99,2.03,'door')
        self.entry_steps(0,-2.80)
        self.chimney(-2.27,.67,5.00,1.17)

    def veranda(self):
        self.pad(7.08,5.57)
        self.box('#b4b28a',0,.26,2.18,6.81,4.80,3.93)
        with self.at(0,.26):
            self.band(6.81,4.8,.29,SAND)
            self.band(6.81,4.8,2.31,CUT)
            self.tiled_roof(7.64,5.50,4.13,1.74,CLAY)
        self.box('#c5c295',-1.62,-1.34,4.38,2.52,2.06,1.22)
        self.roof_cross(2.88,2.43,4.94,1.29,CLAY,-1.62,-1.33)
        self.opening(-1.62,-2.41,4.17,.72,.68,'arch')
        self.box(CUT,0,-2.71,.33,6.93,1.20,.28)
        self.box('#886143',0,-2.73,2.48,7.07,1.33,.17)
        self.box(CLAY[2],0,-3.00,2.65,7.14,.77,.12)
        for x in (-3.28,-1.21,1.21,3.28):
            self.box(OAK,x,-3.23,1.36,.15,.15,2.11)
        for a,b in ((-3.28,-.68),(.68,3.28)):
            self.railing(-3.24,.45,a,b,.56)
        self.opening(0,-2.21,.42,1.02,1.83,'door')
        for x in (-2.25,2.25):
            self.opening(x,-2.2,1.09,.75,.86)
            self.opening(x,-2.2,2.83,.81,1.02,shutters=True)
            self.planter(x,-2.38,2.76,.89)
        self.entry_steps(0,-3.25,count=3)
        self.chimney(2.18,1.05,4.94,1.39,True)

    def ashlar(self):
        self.pad(7.19,5.83)
        self.masonry_faces(7.04,5.66,.16,4.54)
        self.band(7.04,5.66,2.52,IVORY)
        self.band(7.04,5.66,4.47,IVORY)
        self.roof_cross(7.28,5.83,4.54,1.95,SLATE,y=.04,trim=SLATE[0])
        for y in (-2.88,2.88):
            self.prism(STONE[2],[(-3.50,4.51),(3.50,4.51),(0,6.44)],.27,y)
            for i in range(9):
                x=(i-4)*.70
                self.box(STONE[3],x,y,6.48-abs(i-4)*.43,.66,.38,.16)
        self.opening(0,-3.05,5.09,.70,.69,'arch',IVORY)
        for x in (-2.22,0,2.22): self.opening(x,-2.88,3.0,.84,1.12,'arch',IVORY)
        self.opening(0,-2.88,.25,1.15,1.97,'door',IVORY)
        for x in (-2.20,2.20): self.opening(x,-2.88,1.13,.77,.93,'arch',IVORY)
        self.entry_steps(0,-2.93,w=1.23)
        self.boxwood(-1.99,-3.11,.025,.57,True)
        self.chimney(-2.46,.26,4.79,1.56)

    def tower_home(self):
        self.pad(7.27,5.47)
        with self.at(-.79,.17):
            self.masonry_faces(5.64,4.81,.19,4.28)
            self.band(5.64,4.81,2.39,IVORY)
            self.hip(6.18,5.29,4.33,1.73,BOURGOGNE)
        self.ring(STONE[2],2.11,-1.55,.18,1.39,1.22,4.88,8,pi/8)
        for row in range(10):
            r=1.38-row*.015
            self.ring(STONE[2+row%2],2.11,-1.55,.34+row*.469,r,r-.009,.446,8,pi/8)
        self.ring(IVORY,2.11,-1.55,5.01,1.30,1.32,.13,8,pi/8)
        self.turret_roof(2.11,-1.55,5.15,1.52,2.02,TURQUOISE)
        for x in (-2.43,2.11):
            for y,z in ((-2.30 if x<0 else -2.84,1.01),(-2.30 if x<0 else -2.80,3.0)):
                self.opening(x,y,z,.73,1.13,'arch',IVORY)
        self.opening(-.69,-2.28,.25,1.06,1.93,'door',IVORY)
        self.opening(-.69,-2.30,3.02,.89,1.00,'arch',IVORY)
        self.entry_steps(-.69,-2.33,w=1.06)
        self.planter(-2.41,-2.48,.91,.92)
        self.chimney(-2.52,.81,4.94,1.34,True)

    def garden_manor(self):
        self.pad(7.40,5.81,0,.04)
        self.box('#deb788',-.24,.53,2.38,6.74,4.22,4.42)
        with self.at(-.24,.53):
            self.band(6.74,4.22,2.19,CREAM)
            self.hip(7.19,4.87,4.59,1.66,CLAY,CLAY[0])
        self.box('#d5ad7c',-2.36,-1.60,2.18,2.26,2.95,4.06)
        self.roof_cross(2.60,3.35,4.22,1.82,BOURGOGNE,-2.36,-1.61)
        self.prism(CREAM,[(-3.57,4.23),(-1.15,4.23),(-2.36,5.95)],.10,-3.22)
        self.opening(-2.36,-3.31,4.62,.64,.71,'arch',IVORY)
        for x,y in ((-2.36,-3.11),(.34,-1.62),(1.95,-1.62)):
            self.opening(x,y,2.86,.82,1.16,'arch',IVORY)
            self.planter(x,y-.20,2.72,.87)
        self.opening(.31,-1.64,.31,1.03,1.87,'door',IVORY)
        self.opening(2.00,-1.62,.93,.82,.98,'arch',IVORY)
        self.entry_steps(.31,-1.72,w=1.18)
        for x,y,size in ((-1.02,-2.43,.81),(2.90,-2.14,.87),(3.14,-3.20,.62),(-2.45,-3.37,.50)):
            self.boxwood(x,y,.02,size,True)
        self.ring(STONE[2],1.83,-2.87,.013,.51,.55,.226,14)
        self.ring('#5b95a0',1.83,-2.87,.222,.46,.46,.019,14)
        self.ring(IVORY,1.83,-2.87,.235,.11,.096,.35,10)
        self.ring('#7eb9c1',1.83,-2.87,.58,.12,.023,.26,10)
        self.chimney(2.15,1.11,5.1,1.17)

    def arcades(self):
        self.pad(7.67,5.86)
        self.box(IVORY,0,.46,2.46,7.48,4.64,4.61)
        self.box('#c3a989',0,-2.17,1.42,7.48,.64,2.45)
        with self.at(0,.46):
            self.band(7.48,4.64,4.64,IVORY)
            self.hip(8.28,5.39,4.78,1.51,CLAY,CLAY[0])
        self.box(SAND,0,.38,5.89,3.28,2.60,1.12)
        with self.at(0,.38): self.hip(3.79,3.16,6.43,1.34,CLAY,CLAY[0])
        self.opening(0,-.95,5.46,.72,.76,'arch',IVORY)
        for x in (-2.56,0,2.56):
            self.opening(x,-2.50,.27,1.33,2.14,'door' if x==0 else 'arch',IVORY)
            self.opening(x,-1.90,3.04,.90,1.32,'arch',IVORY)
        for x in (-3.48,-1.42,1.42,3.48): self.column(x,-2.76,.23,2.28,.135)
        for x,r in ((-2.45,.90),(0,1.28),(2.45,.90)):
            for i in range(13):
                a,b=i*pi/13,(i+1)*pi/13
                arch=[(x+radius*cos(phi),1.58+height*sin(phi))
                      for phi,radius,height in ((a,r,.79),(b,r,.79),(b,r+.14,.94),(a,r+.14,.94))]
                self.prism(IVORY if i%3 else CREAM,arch[::-1],.22,-2.79)
        self.box(IVORY,0,-2.38,2.58,7.54,1.20,.26)
        self.railing(-2.97,2.69,-3.61,3.61,.53,STONE[2])
        self.entry_steps(0,-2.68,w=1.53)
        for x in (-2.56,2.56): self.boxwood(x,-3.16,.019,.65,True)

    def courtly(self):
        self.pad(7.53,5.69)
        self.masonry_faces(7.32,5.52,.17,4.91,('#9a9488','#c6c2b0','#d5d1bc','#e0d9c5'))
        self.band(7.32,5.52,2.68,IVORY)
        self.band(7.32,5.52,4.84,IVORY)
        self.tiled_roof(7.96,6.12,4.95,1.64,TURQUOISE,.18,.57,COPPER)
        self.hip(5.18,2.68,6.57,.77,SLATE,COPPER)
        for x in (-2.16,0,2.16):
            self.box(IVORY,x,-2.07,5.71,1.09,1.21,1.30)
            self.roof_cross(1.29,1.42,6.37,.72,TURQUOISE,x,-2.11,COPPER)
            self.opening(x,-2.72,5.18,.62,1.06,'arch',IVORY)
            self.opening(x,-2.81,3.16,.90,1.38,'arch',IVORY)
        self.opening(0,-2.83,.32,1.24,2.05,'door',IVORY)
        for x in (-2.18,2.18):
            self.opening(x,-2.82,1.04,.98,1.16,'arch',IVORY)
            self.column(x*.60,-2.91,.23,2.18,.14,True)
            self.planter(x,-3.02,.89,.89)
        self.box(IVORY,0,-2.97,2.60,2.92,.75,.20)
        self.railing(-3.37,2.69,-1.43,1.43,.49,COPPER)
        self.entry_steps(0,-2.94,w=1.43)
        self.chimney(2.40,.84,5.74,1.70)

    def royal(self):
        self.pad(7.57,5.95)
        self.box(IVORY,0,.33,2.42,7.37,5.19,4.53)
        with self.at(0,.33):
            self.band(7.37,5.19,2.51,CREAM,.16)
            self.band(7.37,5.19,4.64,IVORY)
        for side in (-1,1):
            with self.at(side*2.38,.22): self.hip(3.20,5.83,4.73,1.45,COBALT,GOLD)
            for y in (1.20,-.88,-2.30):
                self.column(side*3.69,y,.21,4.44,.126,True)
            for x in (side*1.65,side*2.95):
                self.opening(x,-2.32,3.04,.57,1.25,'arch',GOLD)
            self.opening(side*2.43,-2.32,1.16,1.05,1.16,'arch',IVORY)
            self.boxwood(side*2.56,-2.89,.028,.83,True)
        self.ring(STONE[2],0,-1.01,.19,1.38,1.38,.27,18)
        self.ring(IVORY,0,-1.01,.45,1.31,1.32,5.21,20)
        self.ring(GOLD,0,-1.01,5.43,1.37,1.37,.10,24)
        self.ring(IVORY,0,-1.01,5.55,1.44,1.45,.17,24)
        self.ring(IVORY,0,-.86,5.71,1.13,1.13,1.13,24)
        for x in (-.57,0,.57):
            self.opening(x,-1.98+abs(x)*.24,5.89,.33,.64,'arch',GOLD)
        self.turret_roof(0,-.86,6.88,1.44,1.32,COBALT,True)
        self.opening(0,-2.37,.27,1.20,2.15,'door',GOLD)
        self.opening(0,-2.38,3.22,1.13,1.45,'arch',GOLD)
        for x in (-.79,.79):
            self.column(x,-2.91,.31,2.14,.14,True)
        self.box(IVORY,0,-2.72,2.58,2.36,1.03,.23)
        self.railing(-3.20,2.68,-1.15,1.15,.47,GOLD)
        self.entry_steps(0,-2.93,w=1.68,count=4)
        for x in (-1.36,1.36):
            self.ring(SAND,x,-2.98,.04,.20,.19,.40,10)
            self.ball(FLAME,x,-2.98,.49,.091,.091,.116)
        # A paved approach and a low crest above the residential entrance.
        for i in range(4):
            self.box(STONE[2+i%2],0,-3.57+i*.21,.019,1.64,.196,.044)
        self.ring(GOLD,0,-2.44,4.91,.12,.12,.18,12)

    def side_windows(self):
        # Depth, right facade position, window sill heights, trim and shape.
        sides=(
            (0,2.96,(1.04,),OAK,'window'),(0,3.31,(1.07,),OAK,'window'),
            (-.16,3.61,(3.10,),OAK,'window'),(.31,3.44,(1.07,2.80),OAK,'window'),
            (0,3.55,(1.10,3.03),IVORY,'arch'),(.56,1.99,(1.01,3.08),IVORY,'arch'),
            (.67,3.16,(1.10,3.13),IVORY,'arch'),(.60,3.76,(1.12,3.14),IVORY,'arch'),
            (0,3.68,(1.15,3.16),IVORY,'arch'),(.39,3.73,(1.17,3.21),GOLD,'arch'),
        )
        y,x,heights,trim,shape=sides[self.level-1]
        for orientation in (-1,1):
            facade=x*orientation if self.level not in (6,7) or orientation==1 else (-3.65)
            with self.at(facade,y,angle=orientation*pi/2):
                for h in heights:
                    for u in ((0,) if self.level==1 else (-.98,.98)):
                        self.opening(u,0,h,.59 if self.level<5 else .69,.64 if self.level==1 else .99,shape,trim)

    def build(self,collection):
        levels=(self.hut,self.potter,self.half_timber,self.veranda,self.ashlar,
                self.tower_home,self.garden_manor,self.arcades,self.courtly,self.royal)
        levels[self.level-1]()
        self.side_windows()
        self.instantiate(collection,f'Moradia {self.level:02}')


def material(color):
    name='Moradia '+color
    if mat:=bpy.data.materials.get(name):
        return mat
    mat=pigment(color).copy()
    mat.name=name
    shader=next(node for node in mat.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
    if color in (GOLD,COPPER):
        shader.inputs['Metallic'].default_value=.38
        shader.inputs['Roughness'].default_value=.42
    if color in (GLASS,FLAME):
        shader.inputs['Roughness'].default_value=.42
        shader.inputs['Emission Color'].default_value=shader.inputs['Base Color'].default_value
        shader.inputs['Emission Strength'].default_value=.13 if color==GLASS else 1.38
    return mat


def stage_surface(scene,titles=TITLES,kind='Moradia',pad=(8.65,7.68),
                  columns=10.35,rows=12.85,scale=54.8,target_height=3.20,resolution_y=992,label_scale=1):
    props=bpy.data.collections.new('Estúdio · '+kind)
    scene.collection.children.link(props)
    camera=bpy.data.cameras.new('Prancha · '+kind)
    camera.type='ORTHO'
    camera.ortho_scale=scale
    scene.camera=bpy.data.objects.new(camera.name,camera)
    props.objects.link(scene.camera)
    direction=Vector((.545,-.838,.695)).normalized()
    right=Vector((.838,.545,0)).normalized()
    back=Vector((-.545,.838,0)).normalized()
    target=Vector((0,0,target_height))
    scene.camera.location=target+direction*105
    scene.camera.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
    rig=Architecture(1)
    stage_width=max(250,scale*2)
    rig.box('#203438',0,0,-.73,stage_width,stage_width,.22)
    for index,title in enumerate(titles):
        origin=right*((index%5-2)*columns)+back*(rows if index<5 else -rows)
        collection=scene.collection.children[f'{kind} Nível {index+1:02}']
        for obj in collection.objects:
            if obj.parent is None:
                obj.location+=origin
        with rig.at(origin.x,origin.y):
            rig.box('#56633c',0,0,-.184,*pad,.37)
            rig.box('#6d8050',0,0,-.035,pad[0]-.13,pad[1]-.12,.074)
        label_lift=.90*(label_scale-1)
        anchor=origin-back*(pad[1]/2+2.0*label_scale+label_lift*1.42)
        for text_content,size,color,height in ((f'NÍVEL {index+1:02}',.54,'#d7ac68',.48),
                                               (title,.68,'#f0e4cc',-.35)):
            text=bpy.data.curves.new(text_content,'FONT')
            text.body=text_content
            text.align_x='CENTER'
            text.align_y='CENTER'
            text.size=size*label_scale
            text.materials.append(label_material(color))
            obj=bpy.data.objects.new(text_content,text)
            props.objects.link(obj)
            obj.location=anchor+Vector((0,0,height*label_scale+label_lift))
            obj.rotation_euler=scene.camera.rotation_euler
    for (_,color),(vertices,faces) in rig.parts.items():
        mesh=bpy.data.meshes.new('Estúdio '+color)
        mesh.from_pydata(vertices,[],faces)
        mesh.materials.append(material(color))
        props.objects.link(bpy.data.objects.new(mesh.name,mesh))

    for name,rotation,color,energy,angle in (
            ('Sol dourado',(.47,-.42,-.12),(1,.85,.68),2.28,.23),
            ('Reflexo do céu',(.64,.52,-.64),(.65,.81,1),.88,.73),
            ('Contraluz',(-.51,.86,.32),(1,.89,.69),1.20,.46)):
        light=bpy.data.lights.new(name,'SUN')
        light.energy=energy
        light.color=color
        light.angle=angle
        obj=bpy.data.objects.new(name,light)
        props.objects.link(obj)
        obj.rotation_euler=rotation
    world=bpy.data.worlds.new('Céu do estúdio · '+kind)
    world.use_nodes=True
    background=next(node for node in world.node_tree.nodes if node.type=='BACKGROUND')
    background.inputs['Color'].default_value=(.22,.35,.42,1)
    background.inputs['Strength'].default_value=.32
    scene.world=world
    scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=1760
    scene.render.resolution_y=resolution_y
    scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.shading.color_type='MATERIAL'
                area.spaces.active.region_3d.view_perspective='CAMERA'


def label_material(color):
    mat=material(color)
    shader=next(node for node in mat.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
    shader.inputs['Emission Color'].default_value=shader.inputs['Base Color'].default_value
    shader.inputs['Emission Strength'].default_value=.70
    return mat


def build():
    scene=bpy.data.scenes.new('Moradias de Valdória')
    bpy.context.window.scene=scene
    for level in range(1,11):
        collection=bpy.data.collections.new(f'Moradia Nível {level:02}')
        scene.collection.children.link(collection)
        House(level).build(collection)
        path=ROOT/'src'/'assets'/f'moradia-nivel-{level}.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',collection=collection.name,
                                  export_yup=True,export_meshopt_compression_enable=True)
    stage_surface(scene)
    for old in list(bpy.data.scenes):
        if old!=scene:
            bpy.data.scenes.remove(old)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/'moradias-niveis-1-a-10.blend'),compress=True)


if __name__=='__main__':
    build()
