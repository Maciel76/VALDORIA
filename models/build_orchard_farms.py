"""Model the ten orchard farms and export their collision geometry."""
import json
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_housing import (
    Architecture, BOURGOGNE, CLAY, COBALT, COPPER, CREAM, CUT, DARK, GOLD,
    IVORY, OAK, REED, ROOT, SLATE, STONE, TURQUOISE, material, stage_surface,
)

TITLES=(
    'Fazenda com pomar','Chácara cercada','Sítio do celeiro','Pomar irrigado',
    'Quinta de pedra','Fazenda do lagar','Herdade em terraços','Quinta das estufas',
    'Fazenda da coroa','Herdade imperial',
)
TURF, EARTH, RIDGE, PATH=('#677a42','#6d4733','#886345','#bc9a64')
LEAF=('#405833','#567337','#65823d','#7a9448','#90a850')
FRUIT={'apple':'#bf4135','pear':'#dbb74d','plum':'#554066','peach':'#e5a27c'}
WATER, FOAM='#468e94','#91c4bb'
LIMESTONE=('#9b8d7c','#c0b198','#d5c7aa','#e6d8be')


class Farm(Architecture):
    def __init__(self,level):
        super().__init__(level)
        self.rng.seed(5214+level)
        self.solids=[]
        self.rotors=[]

    def solid(self,x,y,w,d):
        # Game +Z points toward the entrance, which is Blender -Y.
        self.solids.append([round(x,3),round(-y,3),round(w,3),round(d,3)])

    def walk(self,x,y,w,d,paved=False):
        self.box(STONE[1] if paved else PATH,x,y,.045,w,d,.057)
        cols=max(1,round(w/.69))
        rows=max(1,round(d/.64))
        for row in range(rows):
            for col in range(cols):
                left=x+w*((col+.5)/cols-.5)
                front=y+d*((row+.5)/rows-.5)
                if paved:
                    self.box(STONE[1+(row*3+col)%3],left,front,.077,w/cols-.018,d/rows-.022,.020)
                elif (row*3+col)%5==0:
                    self.ball('#a88858',left,front,.075,.10,.15,.011)

    def fence(self,x,y,span,angle=0,stone=False):
        with self.at(x,y,angle=angle):
            posts=max(1,round(span/1.38))
            for i in range(posts+1):
                u=(i/posts-.5)*span
                if stone:
                    self.box(STONE[2],u,0,.42,.27,.31,.79)
                    self.box(IVORY,u,0,.81,.34,.38,.092)
                else:
                    self.box(OAK,u,0,.47,.16,.19,.91)
                    self.ring(CUT,u,0,.88,.109,.04,.134,4,pi/4)
            for z in (.32,.67) if not stone else (.41,.60):
                self.box(CUT if not stone else OAK,0,0,z,span,.11,.09)
        width,depth=(span+.19,.23) if angle==0 else (.23,span+.19)
        self.solid(x,y,width,depth)

    def ground(self):
        self.box(TURF,0,0,-.026,17.81,14.78,.097)
        for i in range(50):
            x=self.rng.uniform(-8.55,8.55)
            y=self.rng.uniform(-7.09,7.09)
            for j in (-1,0,1):
                angle=j*.53+self.rng.uniform(-.3,.3)
                height=self.rng.uniform(.06,.15)
                self.mesh(LEAF[2+i%3],[(x-.032+j*.028,y,.022),(x+.028+j*.028,y,.022),
                                         (x+.095*sin(angle)+j*.028,y+.06*cos(angle),height)],
                          [(0,1,2),(2,1,0)])
        self.walk(0,-2.13,1.77,10.63,self.level>=5)
        self.walk(-3.85,.91,6.18,1.20,self.level>=5)
        self.walk(4.59,1.03,6.96,1.14,self.level>=7)
        if self.level>=2:
            for s in (-1,1):
                self.fence(s*5.11,-7.12,7.12,stone=self.level>=7)
            for s in (-1,1):
                self.fence(s*8.64,-2.70,7.71,pi/2,stone=self.level>=7)

    def fruit_tree(self,x,y,size,fruit,blossom=False):
        self.solid(x,y,.63*size,.63*size)
        bark='#775337'
        self.rod(bark,(x,y,.016),(x+.09*size,y+.04,size*1.57),.116*size,.058*size,8)
        for j in range(5):
            a=j*2*pi/5+self.rng.uniform(-.29,.29)
            u,v=cos(a),sin(a)
            r=size*self.rng.uniform(.37,.56)
            cx,cy=x+u*r,y+v*r
            z=size*self.rng.uniform(1.37,1.69)
            self.rod(bark,(x,y,1.09*size),(cx,cy,z),.061*size,.038*size)
            self.ball(LEAF[1+j%4],cx,cy,z+.27*size,.48*size,.47*size,.51*size)
            for k in range(3):
                a2=a+(k-1)*.46
                ix=cx+cos(a2)*size*self.rng.uniform(.42,.48)
                iy=cy+sin(a2)*size*self.rng.uniform(.42,.48)
                h=z+size*self.rng.uniform(.09,.39)
                color='#f0c1be' if blossom and k==0 else FRUIT[fruit]
                berry=(.078 if fruit=='plum' else .101)*size
                self.ball(color,ix,iy,h,berry,berry*.97,berry*(1.24 if fruit=='pear' else .94))
        self.ball(LEAF[3],x+.07*size,y,z+.60*size,.55*size,.53*size,.62*size)

    def orchard(self):
        points=[(2.52,-1.64),(5.74,-1.64),(2.52,-4.87),(5.74,-4.87)]
        if self.level>=4: points += [(7.69,-2.53),(7.69,-5.28)]
        varieties=('apple','pear','plum','apple','peach')
        for i,(x,y) in enumerate(points):
            size=min(1.29,.76+.049*self.level+(i%2)*.04)
            if i>=4:size*=.69
            fruit='apple' if self.level<3 else varieties[(i+self.level)%len(varieties)]
            if self.level in (9,10):
                self.ring(STONE[2],x,y,.015,.45,.47,.102,12)
                self.ring(EARTH,x,y,.12,.40,.40,.017,12)
            self.fruit_tree(x,y,size,fruit,blossom=self.level in (4,7,10))

    def bed(self,x,y,w,d,kind,raised=False):
        base=.25 if raised else .076
        self.box(STONE[1] if raised else EARTH,x,y,base/2,w,d,base)
        if raised:
            for s in (-1,1):
                self.box(IVORY,x+s*(w/2-.10),y,base,.18,d,.16)
                self.box(STONE[3],x,y+s*(d/2-.10),base,w,.18,.16)
        rows=max(2,round(w/.55))
        for i in range(rows):
            cx=x+w*((i+.5)/rows-.5)
            self.box(RIDGE,cx,y,base+.035,w/rows*.65,d-.22,.068)
            count=max(3,round(d/(.62 if kind=='pumpkin' else .39)))
            for j in range(count):
                px=cx+self.rng.uniform(-.11,.11)
                py=y+(d-.32)*((j+.5)/count-.5)
                self.crop(kind,px,py,base+.071,i+j)

    def crop(self,kind,x,y,z,index):
        if kind in ('wheat','flower'):
            palette=('#8e6f36','#c9a34e','#e1bb67') if kind=='wheat' else ('#c96c79','#dd9c7f','#edd69e')
            for i in range(3):
                dx=(i-1)*.065
                h=self.rng.uniform(.25,.43)
                self.rod(LEAF[2],(x+dx,y,z),(x+dx*1.57,y+dx,z+h),.014,.009,5)
                self.ball(palette[(index+i)%3],x+dx*1.57,y+dx,z+h,.038,.033,.093 if kind=='wheat' else .038)
        elif kind=='pumpkin':
            self.ball('#c57536' if index%2 else '#d98e3f',x,y,z+.091,.143,.121,.096)
            self.rod(LEAF[0],(x,y,z+.15),(x+.023,y,z+.207),.018)
            self.ball(LEAF[2],x-.1,y,z+.06,.12,.09,.036)
        else:
            for i in range(4):
                a=i*pi*.5+index*.57
                self.ball(LEAF[1+i%4],x+cos(a)*.064,y+sin(a)*.064,z+.098,.098,.105,.091)
            self.ball('#a9ad64',x,y,z+.137,.078,.078,.091)

    def farmhouse(self,x,y,w,d,wall,roof,stories=1,style='gable',timbered=False):
        self.solid(x,y,w,d)
        h=2.25 if stories==1 else 3.74
        with self.at(x,y):
            self.pad(w+.12,d+.13)
            if wall=='stone':
                self.masonry_faces(w,d,.155,h,LIMESTONE)
            else:
                self.masonry_faces(w,d,.155,.54)
                self.box(wall,0,0,(h+.52)/2,w,d,h-.52)
            if timbered:
                self.timber(w,d,.56,h,1.12,braces=stories>1,openings=((-w*.27,.54),(0,.62),(w*.27,.54)))
            elif stories>1:
                self.band(w,d,2.35,IVORY,.11)
            self.band(w,d,h-.055,IVORY if wall=='stone' else OAK,.16)
            if style=='front':
                self.roof_cross(w+.51,d+.48,h,1.66,roof,trim=COPPER if self.level>=8 else OAK)
                self.prism(IVORY if wall=='stone' else wall,[(-w/2,h),(w/2,h),(0,h+1.58)],.10,-d/2-.04)
                self.opening(0,-d/2-.102,h+.37,.58,.63,'arch',IVORY)
            elif style=='hip':
                self.hip(w+.54,d+.50,h,1.61,roof,GOLD if self.level==10 else OAK)
            else:
                self.tiled_roof(w+.52,d+.51,h,1.48 if stories==1 else 1.74,roof,trim=OAK)
            self.opening(0,-d/2-.046,.18,1.15,1.75,'door',IVORY if wall=='stone' else OAK)
            self.entry_steps(0,-d/2-.075,w=1.18,count=2)
            for sign in (-1,1):
                ax=sign*w*.29
                self.opening(ax,-d/2-.04,1.01,.75,.84,'arch' if wall=='stone' else 'window',
                             IVORY if wall=='stone' else OAK,wall!='stone')
                self.planter(ax,-d/2-.25,.91,.80)
                if stories>1:self.opening(ax,-d/2-.04,2.63,.69,.86,'arch',IVORY)
            if stories>1:self.chimney(-w*.31,d*.27,h+.87,.91,wall!='stone')

    def barn(self,x,y,w=4.55,d=3.54,roof=CLAY,color='#aa6250'):
        self.solid(x,y,w,d)
        with self.at(x,y):
            self.pad(w+.15,d+.15)
            self.box(color,0,0,1.48,w,d,2.58)
            self.timber(w,d,.20,2.77,1.06,braces=False,openings=((0,1.08),))
            self.roof_cross(w+.48,d+.48,2.78,1.41,roof)
            self.prism(color,[(-w/2,2.76),(w/2,2.76),(0,4.10)],.09,-d/2-.061)
            self.opening(0,-d/2-.14,.18,w*.42,2.16,'door',DARK)
            for s in (-1,1):
                self.rod(CUT,(s*w*.20,-d/2-.341,.46),(.05*s,-d/2-.341,1.76),.052)
            self.opening(0,-d/2-.126,3.04,.48,.48)

    def barrel(self,x,y):
        self.ring(OAK,x,y,.036,.259,.288,.30,12)
        self.ring(CUT,x,y,.336,.289,.265,.28,12)
        for h in (.11,.46):self.ring(DARK,x,y,h,.289,.291,.057,12)

    def well(self,x,y,ornate=False):
        self.solid(x,y,1.23,1.19)
        self.ring(STONE[2],x,y,.055,.69,.69,.35,14)
        self.ring(WATER,x,y,.41,.53,.53,.03,14)
        self.ring(IVORY,x,y,.40,.70,.70,.09,14)
        for s in (-1,1):
            self.rod(OAK if not ornate else IVORY,(x+s*.52,y,.45),(x+s*.52,y,1.63),.070)
        self.rod(CUT,(x-.60,y,1.50),(x+.60,y,1.50),.066)
        if ornate:
            self.ring(COPPER,x,y,1.58,.12,.103,.33,10)
            self.ball(GOLD,x,y,1.93,.10,.10,.105)
        else:
            with self.at(x,y):self.hip(1.43,1.27,1.68,.43,CLAY)

    def irrigation(self,x,y,length,ornate=False):
        self.box(STONE[2],x,y,.096,.94,length,.18)
        self.box(WATER,x,y,.198,.65,length-.07,.035)
        for s in (-1,1):
            self.box(IVORY if ornate else RIDGE,x+s*.43,y,.162,.14,length,.31)
        for j in range(7):
            self.rod(FOAM,(x-.15,y+(j/6-.5)*(length-.44),.221),
                     (x+.17,y+(j/6-.5)*(length-.44)+.07,.221),.013)
        self.box(CUT if not ornate else STONE[3],x,y-.12,.327,1.23,.84,.13)
        for j in range(6):
            self.box(OAK if not ornate else IVORY,x,y-.49+j*.147,.404,1.27,.112,.06)

    def trellis(self,x,y,w,d):
        for side in (-1,1):
            for y0 in (-d/2,0,d/2):
                self.rod(CUT,(x+side*w/2,y+y0,.08),(x+side*w/2,y+y0,1.38),.059,.049,5)
            self.rod(CUT,(x+side*w/2,y-d/2,1.28),(x+side*w/2,y+d/2,1.28),.054)
        for i in range(8):
            a=y+d*(i/7-.5)
            self.rod(CUT,(x-w/2,a,1.31),(x+w/2,a,1.31),.054)
            for side in (-1,1):
                self.ball(LEAF[i%5],x+side*w*.28,a,1.38,.36,.24,.17)
                self.ball(FRUIT['plum'],x+side*w*.31,a,1.24,.076,.076,.11)
        self.solid(x,y,w+.18,d+.16)

    def glasshouse(self,x,y,w,d):
        self.solid(x,y,w,d)
        glass='#57928c'
        green='#385c50'
        with self.at(x,y):
            self.pad(w+.20,d+.16)
            self.box(EARTH,0,0,.24,w-.22,d-.17,.11)
            for i in range(7):
                for j in range(4):
                    self.crop('leaf',(i-3)*w/8,(j-1.5)*d/5,.28,i+j)
            h=1.68
            for y0 in (-d/2,d/2):
                self.prism(glass,[(-w/2,.20),(w/2,.20),(w/2,h),(0,h+1.03),(-w/2,h)],.026,y0)
            for s in (-1,1):
                x0=s*w/2
                self.mesh(glass,[(x0,-d/2,.2),(x0,d/2,.2),(x0,d/2,h),(x0,-d/2,h)],[(0,1,2,3)])
                self.mesh(glass,[(x0,-d/2,h),(x0,d/2,h),(0,d/2,h+1.03),(0,-d/2,h+1.03)],[(0,1,2,3)])
                for j in range(6):
                    y0=d*(j/5-.5)
                    self.rod(green,(x0,y0,.17),(x0,y0,h),.052)
                    self.rod(green,(x0,y0,h),(0,y0,h+1.03),.051)
                for height in (.24,.96,h):
                    self.rod(green,(x0,-d/2,height),(x0,d/2,height),.043)
            self.rod(green,(0,-d/2,h+1.03),(0,d/2,h+1.03),.061)
            self.opening(0,-d/2-.041,.23,.68,1.29,'door',green)

    def pump(self,x,y):
        self.solid(x,y,2.33,2.22)
        self.ring(STONE[3],x,y,.09,1.14,1.03,.44,12)
        self.ring(IVORY,x,y,.51,1.02,.78,2.99,12)
        for z,r in ((.70,1.04),(2.37,.89),(3.45,.83)):
            self.ring(LIMESTONE[1],x,y,z,r,r,.13,12)
        self.turret_roof(x,y,3.52,.99,1.21,SLATE)
        self.rotors.append((x,y-.91,2.89))

    def rows(self,kind,alternate,raised=False):
        self.bed(-6.17,-4.69,3.25,3.93,kind,raised)
        self.bed(-2.80,-4.69,2.81,3.93,alternate,raised)

    def homestead(self):
        self.farmhouse(-5.21,3.90,5.77,4.12,'#c2a171',REED,timbered=True)
        self.rows('leaf','wheat')
        self.barrel(-7.91,1.15)

    def fenced_farm(self):
        self.farmhouse(-4.89,3.67,6.31,4.19,'#dabb89',CLAY,style='hip')
        self.barn(4.38,4.69,3.26,2.63,REED,'#9a7049')
        self.rows('wheat','leaf')

    def barn_farm(self):
        self.farmhouse(-4.89,3.67,6.14,4.27,'#dbc8a4',BOURGOGNE,2,timbered=True)
        self.barn(4.69,4.16,5.29,4.11,CLAY,'#a45343')
        self.rows('wheat','pumpkin')
        self.barrel(1.41,1.39)

    def irrigated(self):
        self.farmhouse(-4.99,3.72,6.13,4.21,'#b5b78c',SLATE,style='front')
        self.barn(5.02,4.20,4.85,3.36,SLATE,'#8c795a')
        self.irrigation(-4.35,-4.50,4.45)
        self.bed(-6.50,-4.60,2.89,4.12,'leaf')
        self.bed(-2.30,-4.60,2.39,4.12,'wheat')
        self.well(1.72,2.71)

    def stone_farm(self):
        self.farmhouse(-4.91,3.76,6.79,4.56,'stone',SLATE,2,'front')
        self.barn(4.62,4.43,5.43,3.49,CLAY,'#9d7858')
        self.rows('leaf','pumpkin',True)
        self.well(1.67,2.85)

    def press_farm(self):
        self.farmhouse(-4.92,3.79,6.54,4.56,'#d4b181',BOURGOGNE,2,'hip',True)
        self.barn(4.71,4.38,5.01,3.89,BOURGOGNE,'#a06156')
        self.trellis(-6.28,-4.46,2.93,4.37)
        self.bed(-2.79,-4.69,2.78,4.14,'flower')
        for x in (2.86,3.53,4.22): self.barrel(x,2.12)

    def terraces(self):
        self.farmhouse(-4.92,3.64,6.79,4.48,'stone',CLAY,2,'hip')
        self.barn(4.81,4.17,5.42,3.73,SLATE,'#a98258')
        for row,kind in enumerate(('wheat','flower','pumpkin')):
            self.bed(-4.67,-2.76-row*1.66,6.35,1.28,kind,True)
        self.well(1.78,2.78)

    def greenhouse(self):
        self.farmhouse(-4.88,3.84,6.66,4.58,'#dec49a',SLATE,2,'front')
        self.glasshouse(4.53,4.33,6.34,3.85)
        self.rows('flower','leaf',True)
        self.well(1.72,2.05)

    def crown(self):
        self.farmhouse(-4.78,3.69,6.91,4.62,'stone',TURQUOISE,2,'front')
        self.pump(6.49,4.94)
        self.glasshouse(2.86,4.29,3.88,3.62)
        self.irrigation(-4.46,-4.51,4.24,True)
        self.bed(-6.51,-4.52,2.94,4.24,'wheat',True)
        self.bed(-2.49,-4.52,2.80,4.24,'pumpkin',True)

    def imperial(self):
        self.farmhouse(-4.61,3.89,7.20,4.44,'stone',COBALT,2,'hip')
        self.pump(6.73,4.72)
        self.glasshouse(2.76,4.15,4.06,3.84)
        for x in (-6.57,-5.76,-3.52,-2.72):
            self.column(x,1.27,.18,2.11,.126,True)
        self.box(IVORY,-4.63,1.24,2.37,5.37,.72,.23)
        self.roof_cross(2.87,2.46,3.62,1.17,COBALT,-4.61,2.55,GOLD)
        self.prism(IVORY,[(-5.95,3.63),(-3.27,3.63),(-4.61,4.72)],.12,1.30)
        self.opening(-4.61,1.23,3.78,.56,.59,'arch',GOLD)
        with self.at(-4.63,1.21):
            self.railing(-.40,2.46,-2.46,2.46,.49,GOLD)
        self.well(.99,-.75,True)
        self.irrigation(-4.31,-4.52,4.36,True)
        self.bed(-6.50,-4.52,3.10,4.40,'flower',True)
        self.bed(-2.31,-4.52,2.81,4.40,'leaf',True)
        for x in (1.46,-1.45):
            self.boxwood(x,-6.76,.04,.70,True)

    def build(self,collection):
        self.ground()
        profiles=(self.homestead,self.fenced_farm,self.barn_farm,self.irrigated,self.stone_farm,
                  self.press_farm,self.terraces,self.greenhouse,self.crown,self.imperial)
        profiles[self.level-1]()
        self.orchard()
        self.instantiate(collection,f'Fazenda {self.level:02}')
        for x,y,z in self.rotors:
            rotor=bpy.data.objects.new('Eixo do moinho de irrigação',None)
            rotor['farmRotor']=True
            rotor.location=(x,y,z)
            collection.objects.link(rotor)
            for i in range(4):
                shape=Architecture(self.level)
                angle=pi*.18+i*pi/2
                def turn(x,y,z):
                    return (x*cos(angle)+z*sin(angle),y,z*cos(angle)-x*sin(angle))
                shape.rod(OAK,turn(0,-.13,.06),turn(0,-.13,1.75),.046)
                for row in range(7):
                    lo=.57+row*.173
                    hi=lo+.163
                    shape.mesh(CREAM if row%2==0 else '#cfb689',
                               [turn(a,-.153,b) for a,b in ((.045,lo),(.42,lo),(.37,hi),(.045,hi))],
                               [(0,1,2,3),(3,2,1,0)])
                    shape.rod(CUT,turn(.015,-.16,lo),turn(.42,-.16,lo),.021)
                for obj in shape.instantiate(collection,'Pá do moinho'):
                    obj.parent=rotor
            hub=Architecture(self.level)
            hub.rod(COPPER,(0,.05,0),(0,-.26,0),.157,.109,9)
            for obj in hub.instantiate(collection,'Cubo do eixo'):
                obj.parent=rotor


def build():
    glass=material('#57928c')
    glass.surface_render_method='DITHERED'
    shader=next(node for node in glass.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
    shader.inputs['Alpha'].default_value=.39
    shader.inputs['Roughness'].default_value=.26
    scene=bpy.data.scenes.new('Fazendas com pomar de Valdória')
    bpy.context.window.scene=scene
    layouts=[]
    for level in range(1,11):
        collection=bpy.data.collections.new(f'Fazenda Nível {level:02}')
        scene.collection.children.link(collection)
        farm=Farm(level)
        farm.build(collection)
        layouts.append(farm.solids)
        path=ROOT/'src'/'assets'/f'farm-nivel-{level}.glb'
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',collection=collection.name,
                                  export_yup=True,export_extras=True,export_meshopt_compression_enable=True)
    manifest=ROOT/'src'/'core'/'farm-layouts.json'
    manifest.write_text('[\n'+',\n'.join('  '+json.dumps(layout) for layout in layouts)+'\n]\n',encoding='utf8')
    stage_surface(scene,TITLES,'Fazenda',pad=(18.34,15.42),columns=24.6,rows=22.20,
                  scale=126,target_height=1.25,resolution_y=820,label_scale=1.67)
    for old in list(bpy.data.scenes):
        if old!=scene:
            bpy.data.scenes.remove(old)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/'fazendas-com-pomar-niveis-1-a-10.blend'),compress=True)


if __name__=='__main__':
    build()
