"""Build the chapel and church progressions, including their growing plots."""
import json
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_housing import (
    Architecture, BOURGOGNE, CLAY, COBALT, COPPER, CREAM, DARK, GOLD, IVORY,
    OAK, ROOT, SLATE, TURQUOISE, material, stage_surface,
)
from build_noble_houses import ASHLAR, MARBLE, NAVY, NobleArchitecture, WATER

CHAPELS=(
    'Capela','Capela do Campanário','Capela dos Arcos','Capela da Rosácea',
    'Capela do Claustro','Capela dos Vitrais','Capela do Mirante','Santuário da Aurora',
    'Santuário da Coroa','Santuário Imperial',
)
CHURCHES=(
    'Igreja de pedra','Igreja Paroquial','Igreja dos Contrafortes','Igreja dos Vitrais',
    'Igreja das Duas Torres','Igreja do Claustro','Basílica das Arcadas','Basílica da Coroa',
    'Catedral de Valdória','Catedral Imperial',
)
# Plot width and depth, nave height, tower body height, roof and entrance arrangement.
CHAPEL_TIERS=(
    (9,12,0,0,SLATE,''),
    (9,12,4.60,9.2,CLAY,'single'),
    (9,12,5.12,10.25,BOURGOGNE,'offset'),
    (9,12,5.68,11.27,SLATE,'single'),
    (9,12,6.20,12.72,TURQUOISE,'offset'),
    (10,13,7.05,13.45,NAVY,'single'),
    (11,14,7.98,15.08,CLAY,'offset'),
    (12,15,8.81,15.17,BOURGOGNE,'twin'),
    (13,17,10.02,16.16,COBALT,'twin'),
    (15,19,11.12,17.60,COBALT,'twin'),
)
CHURCH_TIERS=(
    (14,19,0,0,SLATE,''),
    (14,19,7.21,13.66,CLAY,'single'),
    (14,19,8.22,14.76,SLATE,'offset'),
    (14,19,9.03,15.95,BOURGOGNE,'single'),
    (14,19,9.77,16.92,NAVY,'twin'),
    (16,21,10.89,18.33,SLATE,'offset'),
    (18,24,11.78,19.14,TURQUOISE,'twin'),
    (21,26,12.96,19.93,COBALT,'twin'),
    (23,29,14.16,23.62,NAVY,'twin'),
    (26,32,15.40,25.65,COBALT,'imperial'),
)
GILT=('#a97631','#bf8d3e','#d2a750','#e7c469','#efd089')
CRIMSON='#9d3441'
GLASS=('#406c9f','#875684','#b55a59','#dca75e','#47908d','#71abc3')
SHADOW, STONE_FLOOR='#303941','#a89983'


class Sanctuary(NobleArchitecture):
    def __init__(self,major,level,profile):
        super().__init__(level)
        self.major=major
        self.w,self.d,self.nave_height,self.tower_height,self.palette,self.front=profile
        self.nave_width=self.w*(.51 if major else .56)
        self.nave_depth=self.d*.65
        self.nave_y=self.d*.105
        self.front_y=self.nave_y-self.nave_depth/2
        self.pale=level>=5
        self.solids=[]
        self.rng.seed(22019+31*level+100*major)

    def solid(self,x,y,w,d):
        px,py,_,c,s=self.offset
        self.solids.append([round(px+x*c-y*s,3),round(-(py+x*s+y*c),3),
                            round(w*abs(c)+d*abs(s),3),round(w*abs(s)+d*abs(c),3)])

    def grounds(self):
        w,d=self.w,self.d
        self.box('#6c7d4e',0,0,-.03,w-.25,d-.24,.11)
        self.paving(0,-d*.371,w*.89,d*.224)
        self.paving(0,d*.08,w*.79,d*.73)
        for s in (-1,1):
            for y in (-d*.455,-d*.308,d*.371):
                x=s*w*.417
                self.box('#647d50',x,y,.092,w*.114,d*.048,.06)
                self.boxwood(x,y,.11,.62+w*.032,self.level>=5)
            if self.level>=7:
                scale=(.99+w*.047) if self.level==10 else .62+w*.027
                self.fountain(s*w*.257,-d*.378,scale)
                self.solid(s*w*.257,-d*.378,1.32*scale,1.32*scale)
                if self.level>=9:
                    self.box('#678150',s*w*.385,-d*.406,.089,w*.107,d*.109,.088)
                    for i in range(4):
                        self.boxwood(s*w*.385+(-1)**i*w*.024,-d*.447+i*d*.026,.13,.68+w*.019,True)
            elif self.level>=3:
                self.column(s*w*.238,-d*.391,.09,.58+w*.021,.14,self.level>=5)
                self.lamp(s*w*.238,-d*.391,.72+w*.021)
        if self.level>=9:
            span=self.w*.161
            for i in range(5):
                y=self.front_y-self.d*.148+i*self.d*.016
                z=.15+i*.085
                step=self.d*.016+.007
                self.box(IVORY,0,y,z/2,span+.27,step,z)
                self.box(CRIMSON,0,y,z+.018,span*.54,step-.009,.026)
                for s in (-1,1):self.box(GOLD,s*span*.274,y,z+.032,.049,step-.01,.013)
            landing=self.d*.056
            y=self.front_y-self.d*.052
            self.box(IVORY,0,y,.246,span+.27,landing,.49)
            self.box(CRIMSON,0,y,.504,span*.54,landing-.012,.027)

    def pointed(self,x,z,w,h,sections=14):
        r=w/2
        return [(x-r+w*i/sections,z+h*sin(pi*i/sections)**.76) for i in range(sections+1)]

    def gothic(self,x,y,low,w,stem,rise,portal=False,ornate=False):
        c=IVORY if self.pale else ASHLAR[3]
        outer=self.pointed(x,low+stem,w+.31,rise+.18)
        inner=self.pointed(x,low+stem,w,rise)
        for i in range(len(inner)-1):
            self.prism(c if i%4 else CREAM,[inner[i],inner[i+1],outer[i+1],outer[i]],.14,y)
            if ornate:
                a,b=inner[i],inner[i+1]
                self.rod(GOLD,(a[0],y-.108,a[1]),(b[0],y-.108,b[1]),.028)
        for s in (-1,1):
            self.box(c,x+s*(w/2+.071),y,low+stem/2,.147,.22,stem)
        panels=[(x-w/2,low),(x+w/2,low)]+inner[::-1]
        self.prism(OAK if portal else SHADOW,panels,.11,y+.021)
        if portal:
            for i in range(9):
                vx=x+w*((i+.5)/9-.5)
                self.box(('#855735','#a47140','#96683e')[i%3],vx,y-.062,low+stem*.485,w/9-.012,.05,stem*.97)
            for f in (.34,.72):
                self.box(COPPER if ornate else DARK,x,y-.115,low+stem*f,w-.024,.046,.074)
            for s in (-1,1):
                self.ball(GOLD,x+s*.11,y-.145,low+stem*.49,.058,.043,.062)
        else:
            glass=self.pointed(x,low+stem,w-.19,rise-.12)
            self.prism(GLASS[0],[(x-w*.5+.095,low+.06),(x+w*.5-.095,low+.06)]+glass[::-1],.027,y-.054)
            if ornate:
                for row in range(3):
                    for col in range(2):
                        u=x+(col-.5)*w*.38
                        z=low+stem*(.22+row*.26)
                        self.prism(GLASS[(row*2+col+1)%6],
                            [(u-w*.10,z),(u,z-stem*.073),(u+w*.10,z),(u,z+stem*.073)],.023,y-.075)
            self.box(GOLD if ornate else ASHLAR[3],x,y-.095,low+stem*.48,.047,.035,stem*.91)
            self.box(IVORY,x,y-.069,low-.039,w+.32,.20,.082)

    def cross(self,x,y,z,h,gilt=True):
        color=GOLD if gilt else COPPER
        self.rod(color,(x,y,z),(x,y,z+h),h*.051,h*.038)
        self.rod(color,(x-h*.29,y,z+h*.63),(x+h*.29,y,z+h*.63),h*.047)
        if gilt:
            for u,v in ((x,z+h),(x-h*.29,z+h*.63),(x+h*.29,z+h*.63)):
                self.ball(CREAM,u,y,v,h*.061,h*.054,h*.063)

    def rose(self,x,y,z,r,rich=False):
        for radius,depth,color,yy in ((r*1.15,.17,IVORY,y),(r*1.055,.095,GOLD if rich else ASHLAR[2],y-.105),
                                       (r*.965,.083,SHADOW,y-.137),(r*.908,.042,GLASS[0],y-.192)):
            self.prism(color,[(x+radius*cos(a*pi/24),z+radius*sin(a*pi/24)) for a in range(48)],depth,yy)
        count=12 if rich else 8
        for i in range(count):
            a=i*2*pi/count
            petal=[(x+dist*r*cos(a+theta),z+dist*r*sin(a+theta))
                   for dist,theta in ((.28,-.09),(.63,-.18),(.84,0),(.63,.18),(.28,.09))]
            self.prism(GLASS[(i+1)%6],petal,.025,y-.219)
            self.rod(GOLD if rich else ASHLAR[3],
                     (x+.24*r*cos(a+.23),y-.243,z+.24*r*sin(a+.23)),
                     (x+.89*r*cos(a+.23),y-.243,z+.89*r*sin(a+.23)),r*.027)
        self.prism(IVORY,[(x+r*.244*cos(a*pi/8),z+r*.244*sin(a*pi/8)) for a in range(16)],.059,y-.245)
        self.prism(GLASS[3],[(x+r*.163*cos(a*pi/8),z+r*.163*sin(a*pi/8)) for a in range(16)],.034,y-.288)

    def nave(self):
        w,d,h=self.nave_width,self.nave_depth,self.nave_height
        with self.at(0,self.nave_y):
            self.wall(w,d,h,.21,self.pale)
            self.solid(0,0,w,d)
            pitch=min(w*.52,1.46+h*.14)
            self.roof_cross(w+.43,d+.43,h+.04,pitch,self.palette,trim=GOLD if self.level>=8 else COPPER)
            self.prism(MARBLE[3] if self.pale else ASHLAR[3],
                       [(-w*.50,h), (w*.50,h),(0,h+pitch-.10)],.14,-d*.50-.27)
            self.rod(GOLD if self.level>=7 else ASHLAR[2],(-w*.498,-d*.50-.38,h+.02),
                     (0,-d*.50-.38,h+pitch-.06),.052)
            self.rod(GOLD if self.level>=7 else ASHLAR[2],(w*.498,-d*.50-.38,h+.02),
                     (0,-d*.50-.38,h+pitch-.06),.052)
            if self.level>=3:self.cornice(w,d,h-.018,self.level>=8)
            self.cross(0,-d*.46,h+pitch+.09,h*.11,self.level>=6)
            for s in (-1,1):
                with self.at(s*(w*.503),0,angle=s*pi/2):
                    count=4 if self.major else 3
                    for i in range(count):
                        x=d*((i+.5)/count-.50)*.87
                        self.gothic(x,-.038,h*.375,min(1.5,w*.19),h*.25,h*.113,
                                    ornate=self.level>=4)
        self.center_front()

    def center_front(self):
        w,h,y=self.nave_width,self.nave_height,self.front_y
        self.gothic(0,y-.085,.28,w*.354,h*.305,h*.126,True,self.level>=5)
        if self.level>=3:
            self.rose(0,y-.138,h*.695,min(w*(.215 if self.level==10 else .18),h*.205),self.level>=7)
        if self.level>=4:
            for s in (-1,1):
                x=s*w*.255
                self.gothic(x,y-.081,h*.39,w*.112,h*.206,h*.092,ornate=self.level>=6)
                self.column(s*w*.403,y-.246,.30,h*.784,.11+self.w*.007,self.level>=8)
        if self.level>=8 and self.major:
            for s in (-1,1):
                x=s*w*.305
                self.gothic(x,y-.097,.31,w*.161,h*.188,h*.089,True,True)
                self.lamp(s*w*.196,y-.35,.39)
        if self.level>=9:
            for i in range(7):
                x=w*((i+.5)/7-.5)
                self.crest(x,y-.129,h*.925,.105+w*.010,GOLD)

    def buttresses(self,fly=False):
        r,w,h=self.nave_depth,self.nave_width,self.nave_height
        for s in (-1,1):
            for i in range(3 if self.major else 2):
                y=self.nave_y+r*((i+.5)/(3 if self.major else 2)-.5)*.92
                x=s*(w*.50+self.w*(.116 if fly else .03))
                width=self.w*(.049 if fly else .055)
                height=h*(.54 if fly else .69)
                self.box(ASHLAR[2],x,y,height*.50,width,r*.047,height)
                self.box(IVORY,x,y,height+.064,width+.14,r*.053,.16)
                self.solid(x,y,width+.13,r*.054)
                if fly:
                    cx=s*w*.501
                    p=[(x,y,height),(x-s*.15,y,height+.42),(cx,y,h*.764),(cx,y,h*.684)]
                    u=[(a,b+r*.015,z) for a,b,z in p]+[(a,b-r*.015,z) for a,b,z in p]
                    self.mesh(IVORY,u,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)])

    def aisle(self,s,apse=False):
        x=s*self.w*.314
        w=self.w*.223
        y=self.d*.123
        d=self.d*(.53 if apse else .44)
        h=self.nave_height*(.61 if apse else .48)
        with self.at(x,y):
            self.wall(w,d,h,.17,self.pale)
            self.solid(0,0,w,d)
            self.hip(w+.31,d+.36,h+.03,1.13+self.w*.041,self.palette,COPPER)
            for z in (-d*.19,d*.19):
                with self.at(s*(w*.513),z,angle=s*pi/2):
                    self.gothic(0,-.035,h*.28,w*.36,h*.32,h*.103,ornate=self.level>=5)

    def crossing(self):
        w,d,h=self.w*.81,self.d*.224,self.nave_height*.76
        with self.at(0,self.d*.181):
            self.wall(w,d,h,.20,self.pale)
            self.solid(0,0,w,d)
            self.tiled_roof(w+.48,d+.41,h+.041,1.13+self.w*.074,self.palette,trim=GOLD if self.level>=8 else COPPER)
            for s in (-1,1):
                with self.at(s*w*.50,0,angle=s*pi/2):
                    self.rose(0,-.272,h*.78,min(d*.23,h*.16),self.level>=7)

    def cloister(self,s):
        w=self.w*.236
        h=self.nave_height*.46
        y=self.d*.102
        span=self.d*.399
        with self.at(s*self.w*.323,y,angle=-s*pi/2):
            self.loggia(-w*.49,.15,span,3,h,self.level>=7)
            for i in range(4):
                x=span*(i/3-.5)
                self.solid(x,-w*.49,.29,.36)
            self.hip(span+.30,w+.35,h+.41,1.13+self.w*.036,CLAY,COPPER)

    def bell_tower(self,x,y,h,profile='spire',small=False):
        w=self.w*(.157 if small else .223)
        body=h-self.w*.198
        roof=self.palette if self.level>=6 else SLATE
        with self.at(x,y):
            self.wall(w,w,body,.21,self.pale)
            self.solid(0,0,w,w)
            for p in (.34,.63,.91):
                self.band(w,w,body*p,IVORY,.15)
                if self.level>=9:self.band(w+.02,w+.02,body*p+.081,GOLD,.046)
            if self.level>=8:
                for s in (-1,1):
                    for sy in (-1,1):
                        self.column(s*w*.452,sy*w*.449,.23,body*.62,w*.038,self.level==10)
                if not small:
                    self.gothic(0,-w*.505,.18+body*.111,w*.266,body*.15,body*.058,
                                ornate=self.level>=9)
            for s in (-1,1):
                for a in (0,pi/2,-pi/2):
                    with self.at((w*.501)*sin(a),-(w*.501)*cos(a),angle=a):
                        self.gothic(s*w*.205,-.042,body*.49,w*.235,body*.16,body*.058,
                                    ornate=self.level>=5)
            belfry=h-body
            for a in (0,pi/2,-pi/2,pi):
                with self.at((w*.495)*sin(a),-(w*.495)*cos(a),angle=a):
                    for s in (-1,1):
                        self.column(s*w*.39,0,body,belfry*.67,w*.048,self.level>=7)
                    self.archway(0,-.005,body+belfry*.60,w*.55,belfry*.237,.198,self.level>=6)
            self.ring(COPPER,0,0,body+belfry*.26,w*.159,w*.118,belfry*.32,15)
            self.rod(OAK,(0,0,body+belfry*.58),(0,0,body+belfry*.85),w*.026)
            self.cornice(w,w,h-.13,self.level>=7)
            if profile=='dome':
                r=w*.771
                rise=w*.92
                self.turret_roof(0,0,h+.027,r,rise,roof,True)
                self.cross(0,0,h+rise+.35,w*.35)
            elif profile=='hip':
                rise=w*1.08
                self.hip(w+.42,w+.45,h+.035,rise,roof,GOLD if self.level>=7 else COPPER)
                self.cross(0,0,h+rise+.14,w*.37,self.level>=5)
            else:
                rise=w*(1.39 if self.major else 1.51)
                self.turret_roof(0,0,h+.031,w*.781,rise,roof)
                self.cross(0,0,h+rise+.33,w*.39,self.level>=5)

    def cupola(self,imperial=False):
        w,h=self.w,self.nave_height
        y=self.d*.17
        crown=h+(w*(.112 if self.major else .145))
        r=w*(.171 if imperial else .155)
        drum=w*(.143 if imperial else .112)
        self.ring(ASHLAR[2],0,y,crown-.29,r*.95,r*.95,.33,24)
        self.ring(MARBLE[3],0,y,crown+.03,r*.91,r*.91,drum,24)
        self.ring(GOLD,0,y,crown+drum,r*.975,r*.999,.17,24)
        for i in range(12 if imperial else 8):
            count=12 if imperial else 8
            a=i*2*pi/count
            with self.at(r*.918*sin(a),y-r*.918*cos(a),angle=a):
                self.gothic(0,-.034,crown+drum*.16,r*.27,drum*.46,drum*.19,
                            ornate=True)
        rise=r*(1.28 if imperial else 1.10)
        self.turret_roof(0,y,crown+drum+.19,r*1.09,rise,GILT if self.major and self.level==10 else COBALT,True)
        foot=crown+drum+.19+rise
        self.ring(IVORY,0,y,foot+.105,r*.214,r*.183,r*.21,16)
        self.ring(GOLD,0,y,foot+r*.22,r*.213,r*.071,r*.22,16)
        self.cross(0,y,foot+r*.41,r*.46)

    def porch(self):
        w=self.nave_width*.91
        y=self.front_y-self.d*.051
        h=self.nave_height*.388
        sections=3 if self.major else 1
        self.loggia(y,.25,w,sections,h,self.level>=7)
        for i in range(sections+1):
            self.solid(w*(i/sections-.5),y,.37,.41)
        self.roof_cross(w+.30,self.d*.136,h+.34,self.nave_width*.16,self.palette,
                        y=y+.32,trim=GOLD if self.level>=8 else COPPER)

    def imperial_front(self):
        w,h,y=self.nave_width,self.nave_height,self.front_y-self.d*.057
        spring=h*.286
        span=w*.46
        for s in (-1,1):
            self.column(s*span*.59,y,.45,spring-.28,w*.021,True)
            self.column(s*span*.75,y+.24,.18,spring+.36,w*.016,True)
            self.solid(s*span*.60,y,w*.105,.64)
            self.lamp(s*span*.73,y-.15,.36)
        self.archway(0,y-.06,spring,span,h*.133,.43,True)
        self.archway(0,y+.16,spring+.037,span+.25,h*.151,.33,True)
        top=spring+h*.151+.42
        self.box(IVORY,0,y+.43,top,span*1.74,1.16,.18)
        self.box(GOLD,0,y-.18,top-.15,span*1.76,.15,.074)
        self.prism(MARBLE[3],[(-span*.86,top), (span*.86,top),(0,top+h*.128)],.42,y+.24)
        self.crest(0,y-.008,top+h*.052,.18+w*.016,GOLD)
        for s in (-1,1):
            self.rod(GOLD,(s*span*.88,y-.013,top+.038),(0,y-.013,top+h*.134),.061)
            for i in range(3):
                x=(i/3-.65)*span*s
                self.pilaster_cap(x,y+.07,top+max(0,(1-abs(x)/(span*.86))*.1*h),.27+w*.018)

    def pilaster_cap(self,x,y,z,r):
        self.ring(IVORY,x,y,z,r*.46,r*.46,.13,8)
        self.ring(GOLD,x,y,z+.13,r*.32,r*.16,r*.56,8)
        self.ball(GOLD,x,y,z+.15+r*.62,r*.139,r*.131,r*.165)

    def design(self,collection):
        self.grounds()
        self.nave()
        if self.level>=3:self.buttresses(self.major and self.level>=6)
        if self.level>=4:
            for s in (-1,1):self.aisle(s,self.major and self.level>=6)
        if self.level>=5 and (self.major or self.level in (7,9,10)):self.crossing()
        if self.level in (3,5,6,7):self.porch()
        if self.level==10:self.imperial_front()
        if self.level in (5,6,7):self.cloister(-1)
        if self.level in (8,10) or (not self.major and self.level==7):self.cupola(self.level==10)
        if self.front=='single':
            self.bell_tower(0,self.d*.326,self.tower_height,'hip' if self.level<4 else 'spire')
        elif self.front=='offset':
            self.bell_tower(-self.w*.286,self.d*.294,self.tower_height,
                            'dome' if not self.major and self.level in (5,7) else 'spire')
        else:
            for s in (-1,1):
                x=s*self.w*(.293 if self.level>=8 else .284)
                self.bell_tower(x,self.front_y-.19,self.tower_height,
                                'dome' if self.level==8 and not self.major else 'spire')
                if self.front=='imperial':
                    self.bell_tower(s*self.w*.282,self.d*.335,self.tower_height*.74,'hip',True)
        self.instantiate(collection,('Igreja' if self.major else 'Capela')+f' {self.level:02}')
        self.add_fountains(collection,'sanctuaryFountain')


def legacy(collection,filename):
    previous=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'src'/'assets'/filename))
    for obj in set(bpy.data.objects)-previous:
        for source in list(obj.users_collection):
            source.objects.unlink(obj)
        collection.objects.link(obj)


def build_family(kind,major,tiers,titles,base_name):
    scene=bpy.data.scenes.new(f'{kind} de Valdória')
    bpy.context.window.scene=scene
    records=[]
    for level,profile in enumerate(tiers,1):
        w,d=profile[:2]
        collection=bpy.data.collections.new(f'{kind} Nível {level:02}')
        scene.collection.children.link(collection)
        if level==1:
            legacy(collection,'igreja.glb' if major else 'capela.glb')
            rectangles=[[0,0,round(w*.86,3),round(d*.84,3)]]
        else:
            model=Sanctuary(major,level,profile)
            model.design(collection)
            rectangles=model.solids
            stem='church' if major else 'chapel'
            bpy.ops.export_scene.gltf(filepath=str(ROOT/'src'/'assets'/f'{stem}-nivel-{level}.glb'),
                                      export_format='GLB',collection=collection.name,export_yup=True,
                                      export_extras=True,export_meshopt_compression_enable=True)
        records.append({'w':w,'d':d,'solids':rectangles})
    stage_surface(scene,titles,kind,pad=(tiers[-1][0]+.18,tiers[-1][1]+.20),
                  columns=35.1 if major else 21.07,rows=40.0 if major else 27.5,
                  scale=183 if major else 110.5,target_height=5.4 if major else 4.4,
                  resolution_y=1160,label_scale=2.40 if major else 1.73)
    for old in list(bpy.data.scenes):
        if old!=scene:
            bpy.data.scenes.remove(old)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/f'{base_name}-niveis-1-a-10.blend'),compress=True)
    return records


def build():
    water=material(WATER)
    next(n for n in water.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Roughness'].default_value=.25
    for color in (*GLASS,*GILT):
        mat=material(color)
        shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        shader.inputs['Roughness'].default_value=.32
        shader.inputs['Emission Color'].default_value=shader.inputs['Base Color'].default_value
        shader.inputs['Emission Strength'].default_value=.155 if color in GLASS else .067
        if color in GILT:shader.inputs['Metallic'].default_value=.55
    chapel=build_family('Capela',False,CHAPEL_TIERS,CHAPELS,'capelas')
    church=build_family('Igreja',True,CHURCH_TIERS,CHURCHES,'igrejas')
    layout=ROOT/'src'/'core'/'sanctuary-layouts.json'
    layout.write_text('{\n  "chapel": [\n'+',\n'.join('    '+json.dumps(entry) for entry in chapel)+
                      '\n  ],\n  "church": [\n'+',\n'.join('    '+json.dumps(entry) for entry in church)+
                      '\n  ]\n}\n',encoding='utf8',newline='\r\n')


if __name__=='__main__':
    build()
