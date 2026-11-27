"""Model ten markets and export a level-by-level exhibit for Valdória."""
import json
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_housing import (
    Architecture, BOURGOGNE, CLAY, COBALT, COPPER, CREAM, CUT, DARK, GOLD,
    IVORY, OAK, ROOT, SAND, SLATE, TURQUOISE, material, stage_surface,
)
from build_noble_houses import ASHLAR, MARBLE, NAVY, NobleArchitecture

TITLES=(
    'Mercado','Feira de pavilhões','Mercado dos telheiros','Praça dos mercadores',
    'Mercado de cantaria','Mercado do relógio','Grande Bazar','Galeria de vidro',
    'Mercado da coroa','Mercado Imperial',
)
CRIMSON, MOSS, OCHRE, INDIGO='#a63843','#4d7860','#bb8846','#3a6185'
CANVAS=(CRIMSON,MOSS,OCHRE,INDIGO)
RUST, INK, GLASS='#7b4433','#334b51','#72a9a6'
WARES=('#b74235','#d7883b','#73934b','#6c4862','#e8bf71')


class Market(NobleArchitecture):
    def __init__(self,level):
        super().__init__(level)
        self.rng.seed(2901+level)
        self.solids=[]
        self.clocks=[]
        self.flags=[]

    def solid(self,x,y,w,d):
        px,py,_,c,s=self.offset
        wx,wy=px+x*c-y*s,py+x*s+y*c
        self.solids.append([round(wx,3),round(-wy,3),
                            round(w*abs(c)+d*abs(s),3),round(w*abs(s)+d*abs(c),3)])

    def floor(self):
        self.box('#7f704e',0,0,-.035,12.79,10.82,.12)
        if self.level<=2:
            self.box('#b3986a',0,0,.031,12.69,10.73,.04)
            for i in range(55):
                x=self.rng.uniform(-6.26,6.26)
                y=self.rng.uniform(-5.14,5.14)
                self.ball(ASHLAR[1+i%3],x,y,.05,.14,.13,.025)
        else:
            self.paving(0,0,12.64,10.67)
            for s in (-1,1):
                self.box(IVORY,s*6.19,.02,.099,.21,10.62,.12)
                if self.level>=7:
                    self.box(ASHLAR[1],s*1.14,-3.06,.106,.091,4.31,.032)
            if self.level>=9:
                for i in range(11):
                    y=-5.03+i*.36
                    self.prism(COPPER,[(-.16,.104),(0,.098),(.16,.104),(0,.122)],.26,y)

    def crates(self,x,y,goods,size=.55,z=.93):
        self.box(OAK,x,y,z,size,size,.20)
        for side in (-1,1):
            self.box(CUT,x+side*(size/2-.026),y,z+.11,.046,size,.09)
            self.box(CUT,x,y+side*(size/2-.027),z+.11,size,.043,.09)
        for i in range(5):
            for j in range(2):
                self.ball(WARES[goods%5],x+(i-2)*size*.155,y+(j-.5)*size*.37,
                          z+.17+(i%2)*.024,size*.094,size*.125,size*.108)

    def counter(self,x,y,w,goods):
        self.solid(x,y,w,.62)
        self.box(OAK,x,y,.47,w,.64,.74)
        for i in range(max(3,round(w/.32))):
            sections=max(3,round(w/.32))
            u=x+w*((i+.5)/sections-.5)
            self.box(CUT if i%4 else OAK,u,y-.325,.51,w/sections-.018,.065,.72)
        self.box(CUT,x,y,.848,w+.13,.77,.104)
        n=max(2,round(w/.54))
        for i in range(n):
            self.crates(x+w*((i+.5)/n-.5),y-.026,goods+i,w/n*.83,1.01)

    def canvas(self,w,d,z,rise,color,pitched=False):
        columns=14
        rows=12
        def point(u,t):
            sag=.091*sin(u*pi*4)*sin(t*pi)
            peak=1-abs(2*t-1) if pitched else 1-t**1.19
            return (w*(u-.5),d*(.5-t),z+rise*peak+sag)
        for col in range(columns):
            color0=color if col%2 else CREAM
            for j in range(rows):
                u,v=col/columns,(col+1)/columns
                a,b=j/rows,(j+1)/rows
                self.mesh(color0,[point(u,a),point(u,b),point(v,b),point(v,a)],[(0,1,2,3)])
            x0,x1=w*(col/columns-.5),w*((col+1)/columns-.5)
            self.prism(color0,[(x0,z-.15),(x1,z-.15),(x1,z),(x0,z)],.046,-d/2)
        self.rod(OAK,(-w/2,-d/2,z),(w/2,-d/2,z),.047)

    def booth(self,x,y,w,d,h,color,goods,angle=0,pitched=False):
        with self.at(x,y,angle=angle):
            for s in (-1,1):
                for b in (-1,1):
                    z=h+(0 if b<0 or pitched else .57)
                    self.box(OAK,s*w*.44,b*d*.43,z/2,.117,.117,z)
                    self.solid(s*w*.44,b*d*.43,.16,.16)
            self.counter(0,-d*.31,w*.84,goods)
            self.box(OAK,0,d*.358,.52,w*.82,.12,1.04)
            self.solid(0,d*.36,w*.82,.14)
            self.canvas(w+.24,d+.29,h,.66 if pitched else .68,color,pitched)

    def booth_row(self,h,colors,y=3.09):
        for i,x in enumerate((-4.12,0,4.12)):
            self.booth(x,y,3.18,2.62,h,colors[i],i,pitched=self.level>1)

    def side_booths(self,h,y=-1.17,colors=(INDIGO,MOSS)):
        for sign in (-1,1):
            self.booth(sign*4.61,y,2.86,2.17,h,colors[(sign+1)//2],(sign+1)//2+2,
                       angle=-sign*pi/2,pitched=self.level>=5)

    def back_wall(self,w,d,h):
        self.wall(w,.35,h,.17,True)
        self.solid(0,0,w,.42)
        for s in (-1,1):
            y=-d*.43
            self.box(IVORY,s*w*.47,y,h*.50,.24,d*.95,h-.18)
            self.solid(s*w*.47,y,.28,d*.95)

    def stores(self,w,d,arch_top,palette,high=0,dome=False):
        # Back wall and vendor tables leave the front and aisles open.
        with self.at(0,3.42):
            self.back_wall(w,d,arch_top+(1.53 if high else .15))
            self.loggia(-d+.48,.16,w-.45,3,arch_top,self.level>=6)
            for i in range(4):
                x=(i-1.5)*(w-.45)/3
                self.solid(x,-d+.48,.36,.39)
            for i,x in enumerate((-w*.324,0,w*.324)):
                self.counter(x,-.63,w*.240,i+2)
            if high:
                with self.at(0,-d*.47):
                    self.wall(w,d+.21,arch_top+1.66,arch_top+.28,True)
                    self.cornice(w,d+.21,arch_top+1.68,self.level>=7)
                    self.windows(-d*.52,arch_top+.54,(-w*.313,0,w*.313),.91,.87,self.level>=7)
                z=arch_top+1.74
            else:
                z=arch_top+.38
            with self.at(0,-d*.45):
                if dome:
                    self.hip(w+.39,d+.51,z,1.03,palette,GOLD)
                elif high>=2:
                    self.tiled_roof(w+.47,d+.51,z,1.35,palette,.21,.65,COPPER)
                    self.hip(w*.59,d*.48,z+1.32,.63,palette,GOLD)
                else:
                    self.hip(w+.48,d+.49,z,1.41,palette,COPPER if high else OAK)
        self.lamp(-2.14,.83,1.94)
        self.lamp(2.14,.83,1.94)

    def medallion(self,y,z,scale=1):
        self.rod(GOLD,(0,y,z-.48*scale),(0,y,z+.47*scale),.063*scale)
        self.rod(GOLD,(-.48*scale,y,z+.26*scale),(.48*scale,y,z+.26*scale),.042*scale)
        self.rod(GOLD,(-.24*scale,y,z-.43*scale),(.24*scale,y,z-.43*scale),.045*scale)
        for s in (-1,1):
            x=s*.41*scale
            self.rod(GOLD,(x,y,z+.24*scale),(x-.14*scale,y,z-.07*scale),.022*scale)
            self.rod(GOLD,(x,y,z+.24*scale),(x+.14*scale,y,z-.07*scale),.022*scale)
            self.prism(GOLD,[(x-.164*scale,z-.055*scale),(x-.079*scale,z-.195*scale),
                             (x+.079*scale,z-.195*scale),(x+.164*scale,z-.055*scale)],.065,y)

    def plaza(self,place):
        for s in (-1,1):
            x=s*2.49
            self.fountain(x,place,.83)
            self.solid(x,place,1.09,1.09)
            self.boxwood(s*3.54,place-.17,.074,.68,True)

    def pavilion(self,x,y,top,palette,pair=False):
        with self.at(x,y):
            self.wall(2.78,2.63,top,.16,True)
            self.cornice(2.78,2.63,top-.045,True)
            if pair:
                self.turret_roof(0,0,top+.035,1.52,1.94,palette)
            else:
                self.hip(3.19,3.05,top+.055,1.51,palette,GOLD)
            self.opening(0,-1.38,.25,1.05,1.90,'door',IVORY)
            for z in (2.72,top-1.23):self.stained_window(0,-1.39,z,.66,.88)
            self.solid(0,0,2.78,2.63)

    def barrel_roof(self,w,d,z,rise,accent):
        panels=12
        columns=14
        def pt(a,b):
            phi=pi*(1-a)
            return (cos(phi)*w/2,d*(b-.5),z+rise*sin(phi))
        for i in range(panels):
            a,b=i/panels,(i+1)/panels
            for j in range(columns):
                p,q=j/columns,(j+1)/columns
                self.mesh(GLASS,[pt(a,p),pt(b,p),pt(b,q),pt(a,q)],[(0,1,2,3)])
            for j in range(6):
                v=j/5
                self.rod(accent,pt(a,v),pt(b,v),.049 if j in (0,5) else .031)
            self.rod(INK,pt(a,0),pt(a,1),.036)
        self.rod(accent,(w/2,-d/2,z),(w/2,d/2,z),.065)

    def canopy(self,x,y,height,color,span=2.8):
        with self.at(x,y):
            for s in (-1,1):
                self.column(s*(span/2-.16),-.88,.17,height-.16,.11,self.level>=9)
                self.solid(s*(span/2-.16),-.88,.34,.32)
            self.canvas(span+.20,1.98,height,.53,color)
            self.counter(0,.31,span-.34,2 if x<0 else 4)

    def flagpole(self,x,y,h,scale=.9):
        self.rod(COPPER,(x,y,h-.33),(x,y,h+.72),.048,.034)
        self.ball(GOLD,x,y,h+.76,.067,.067,.082)
        self.flags.append((x,y,h,scale))

    def village(self):
        self.booth_row(2.32,(CRIMSON,MOSS,OCHRE))
        self.boxwood(-5.30,-1.21,.041,.56)
        self.crates(-4.91,.13,4,.74,.19)
        self.crates(-4.32,.36,1,.58,.17)
        self.crates(5.12,.25,2,.77,.19)

    def pavilions(self):
        self.booth_row(2.47,(OCHRE,CRIMSON,INDIGO))
        self.side_booths(2.39,-1.21,(MOSS,INDIGO))
        self.flagpole(0,3.12,3.27,.83)
        self.crates(-5.58,.71,4,.68,.17)
        self.crates(5.43,.66,2,.72,.17)

    def sheds(self):
        for i,x in enumerate((-4.05,0,4.05)):
            with self.at(x,2.66):
                self.counter(0,-.84,2.74,i)
                for s in (-1,1):
                    for y in (-1.12,1.13):
                        self.box(OAK,s*1.41,y,1.48,.21,.18,2.78)
                        self.solid(s*1.41,y,.24,.21)
                self.hip(3.77,3.39,2.85,1.30,CLAY)
                self.canvas(2.94,1.13,2.23,.55,CANVAS[i])
        self.side_booths(2.24)

    def merchants(self):
        for s in (-1,1):
            self.pavilion(s*3.65,2.82,3.58,BOURGOGNE)
            self.canopy(s*3.64,-.01,2.40,CRIMSON if s<0 else INDIGO)
        self.fountain(-2.23,-2.82,.94)
        self.solid(-2.23,-2.82,1.22,1.22)
        self.booth(0,3.38,2.86,2.33,2.64,OCHRE,2,pitched=True)
        self.flagpole(0,3.43,3.38)

    def ashlar_market(self):
        self.stores(11.32,4.06,3.57,SLATE)
        self.side_booths(2.57,-2.05,(MOSS,CRIMSON))
        self.box(IVORY,0,1.23,4.14,2.88,.20,.54)
        self.medallion(1.04,4.21,.73)
        self.plaza(-3.10)

    def clock_market(self):
        self.stores(11.27,4.04,2.85,BOURGOGNE,1)
        with self.at(0,1.91):
            self.wall(2.34,2.21,6.63,4.34,True)
            self.hip(2.75,2.71,6.68,1.14,SLATE,COPPER)
        y,z=.76,5.89
        for s in (1,2,3):
            r=(.89,.80,.72)[s-1]
            self.prism((COPPER,GOLD,IVORY)[s-1],[(r*cos(i*pi/16),z+r*sin(i*pi/16)) for i in range(32)],
                       .084,y-s*.056)
        for i in range(12):
            a=i*pi/6
            x,q=.60*sin(a),z+.60*cos(a)
            self.rod(INK,(x,y-.21,q),(.66*sin(a),y-.21,z+.66*cos(a)),.028)
        self.clocks.append((0,y-.236,z))
        self.side_booths(2.66,-1.89,(INDIGO,OCHRE))
        self.flagpole(0,1.97,7.85,.94)

    def bazaar(self):
        self.stores(10.95,4.13,2.71,TURQUOISE,1,True)
        for s in (-1,1):
            self.canopy(s*4.23,-1.51,2.48,CRIMSON if s<0 else MOSS,3.22)
            self.flagpole(s*3.55,1.96,5.64,.80)
        self.ring(MARBLE[2],0,1.98,5.18,1.75,1.69,1.05,16)
        self.ring(GOLD,0,1.98,6.22,1.74,1.78,.12,16)
        self.turret_roof(0,1.98,6.36,2.09,2.24,TURQUOISE,True)
        self.medallion(.72,5.52,.60)
        self.plaza(-3.89)

    def glass_gallery(self):
        for s in (-1,1):
            self.pavilion(s*4.54,2.84,4.62,TURQUOISE)
            self.canopy(s*3.97,-1.96,2.58,INDIGO if s<0 else MOSS,3.34)
            self.solid(s*2.78,1.04,.44,6.14)
            self.box(IVORY,s*2.78,1.04,1.51,.37,6.14,2.97)
            for y in (-1.89,.43,3.22):self.column(s*2.65,y,.19,4.19,.125,True)
        self.loggia(-1.98,.19,5.55,1,3.99,True)
        for s in (-1,1):self.solid(s*2.76,-1.98,.44,.48)
        with self.at(0,1.17):
            self.barrel_roof(5.67,6.80,4.44,4.69,COPPER)
        self.archway(0,-2.27,4.44,5.28,4.40,.25,True)
        self.medallion(-2.43,6.44,.88)
        self.counter(0,3.17,3.88,3)

    def crown(self):
        self.stores(11.42,4.20,3.27,NAVY,2,True)
        for s in (-1,1):
            self.pavilion(s*4.31,3.52,5.60,BOURGOGNE)
            self.canopy(s*4.13,-2.11,2.63,CRIMSON if s<0 else OCHRE,3.32)
        self.ring(IVORY,0,1.91,6.55,1.63,1.50,1.05,16)
        self.turret_roof(0,1.91,7.65,1.89,1.98,NAVY,True)
        self.medallion(.12,4.78,1.02)
        self.plaza(-3.97)
        self.flagpole(0,1.91,9.82,.91)

    def imperial(self):
        self.stores(11.44,4.22,3.29,COBALT,2,True)
        for s in (-1,1):
            self.pavilion(s*4.59,3.37,6.57,COBALT,True)
            self.canopy(s*4.11,-2.04,2.70,CRIMSON if s<0 else INDIGO,3.39)
            self.flagpole(s*4.59,3.37,8.77,.81)
        with self.at(0,1.32):
            self.barrel_roof(4.37,4.73,5.60,1.83,GOLD)
        self.ring(MARBLE[3],0,2.11,6.28,1.99,1.85,1.90,18)
        for i in range(8):
            a=i*pi/4
            with self.at(1.81*sin(a),2.11-1.81*cos(a),angle=a):
                self.stained_window(0,-.08,6.84,.65,1.17)
        self.ring(GOLD,0,2.11,8.16,1.93,2.03,.17,20)
        self.turret_roof(0,2.11,8.34,2.35,2.52,COBALT,True)
        self.loggia(-1.30,.16,4.04,1,3.47,True)
        for s in (-1,1):
            self.solid(s*2.02,-1.30,.41,.38)
            self.lamp(s*2.56,-1.51,.22)
        self.prism(MARBLE[3],[(-1.94,3.85),(1.94,3.85),(0,5.42)],.59,-1.17)
        self.rod(GOLD,(-1.96,-1.48,3.88),(0,-1.48,5.45),.083)
        self.rod(GOLD,(1.96,-1.48,3.88),(0,-1.48,5.45),.083)
        self.medallion(-1.49,4.38,1.10)
        self.plaza(-4.01)
        self.flagpole(0,2.11,11.05,1.04)

    def effects(self,collection):
        self.add_fountains(collection,'marketFountain')
        for x,y,z in self.clocks:
            hub=bpy.data.objects.new('Mostrador do relógio',None)
            hub.location=(x,y,z)
            hub['marketClock']=True
            collection.objects.link(hub)
            hands=Architecture(self.level)
            hands.rod(INK,(0,-.044,-.11),(.24,-.044,.22),.055,.028)
            hands.rod(CRIMSON,(0,-.052,-.10),(-.40,-.052,.33),.031,.016)
            hands.ball(GOLD,0,-.058,0,.078,.034,.078)
            for obj in hands.instantiate(collection,'Ponteiros'):
                obj.parent=hub
        for x,y,z,scale in self.flags:
            flag=Architecture(self.level)
            columns,rows=15,6
            vertices=[(scale*u,sin(u*9)*u*.16,(.61-v*.46+.13*u)*scale)
                      for v in (i/rows for i in range(rows+1)) for u in (j/columns for j in range(columns+1))]
            faces=[(j*(columns+1)+i,j*(columns+1)+i+1,(j+1)*(columns+1)+i+1,(j+1)*(columns+1)+i)
                   for j in range(rows) for i in range(columns)]
            flag.mesh(CRIMSON,vertices,faces)
            for obj in flag.instantiate(collection,'Flâmula do mercado'):
                obj.location=(x,y,z)
                obj['marketPennant']=True

    def make(self,collection):
        designs=(self.village,self.pavilions,self.sheds,self.merchants,self.ashlar_market,
                 self.clock_market,self.bazaar,self.glass_gallery,self.crown,self.imperial)
        self.floor()
        designs[self.level-1]()
        self.instantiate(collection,f'Mercado {self.level:02}')
        self.effects(collection)


def build():
    glass=material(GLASS)
    glass.surface_render_method='DITHERED'
    shader=next(node for node in glass.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
    shader.inputs['Alpha'].default_value=.39
    shader.inputs['Roughness'].default_value=.27
    scene=bpy.data.scenes.new('Mercados de Valdória')
    bpy.context.window.scene=scene
    layouts=[]
    for level in range(1,11):
        collection=bpy.data.collections.new(f'Mercado Nível {level:02}')
        scene.collection.children.link(collection)
        market=Market(level)
        market.make(collection)
        layouts.append(market.solids)
        bpy.ops.export_scene.gltf(filepath=str(ROOT/'src'/'assets'/f'market-nivel-{level}.glb'),
                                  export_format='GLB',collection=collection.name,export_yup=True,
                                  export_extras=True,export_meshopt_compression_enable=True)
    manifest=ROOT/'src'/'core'/'market-layouts.json'
    manifest.write_text('[\n'+',\n'.join('  '+json.dumps(layout) for layout in layouts)+'\n]\n',encoding='utf8')
    stage_surface(scene,TITLES,'Mercado',pad=(13.34,11.27),columns=16.34,rows=18.87,
                  scale=83.8,target_height=2.55,resolution_y=994,label_scale=1.34)
    for old in list(bpy.data.scenes):
        if old!=scene:
            bpy.data.scenes.remove(old)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/'mercados-niveis-1-a-10.blend'),compress=True)


if __name__=='__main__':
    build()
