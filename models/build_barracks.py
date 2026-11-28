"""Build and export the ten training grounds of Valdória."""
from pathlib import Path
import sys

import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_housing import (
    CLAY, COBALT, CREAM, DARK, GOLD, IVORY, OAK, REED, ROOT, SLATE, stage_surface,
)
from build_noble_houses import ASHLAR, CRIMSON, NobleArchitecture

TITLES=(
    'Quartel da guarda','Pátio dos fundibulários','Campo dos arqueiros','Quartel dos lanceiros',
    'Fortim dos besteiros','Academia do arco','Quartel da guarda real','Fortaleza dos instrutores',
    'Academia da Coroa','Academia Imperial',
)
SAND, TURF, RUST, NIGHT='#ad8f5a','#68744a','#733c32','#222e3e'


class Barracks(NobleArchitecture):
    def __init__(self,level):
        super().__init__(level)
        self.roofs=COBALT if level>=9 else SLATE if level>=6 else CLAY if level>=3 else REED
        self.gilt=level>=8

    def banner(self,x,y,top,scale=.75):
        w=scale*.38
        self.rod(GOLD,(x-w-.12,y,top),(x+w+.12,y,top),.043)
        self.prism(GOLD,[(x-w,top),(x-w,top-scale),(x,top-scale*1.23),
                   (x+w,top-scale),(x+w,top)],.037,y)
        self.prism(CRIMSON,[(x-w+.045,top-.05),(x-w+.045,top-scale+.046),
                   (x,top-scale*1.13),(x+w-.045,top-scale+.046),(x+w-.045,top-.05)],.029,y-.026)
        self.crest(x,y-.05,top-scale*.51,scale*.18)

    def yard(self):
        for s in (-1,1):
            x=s*3.75
            self.box(TURF,x,-2.36,.036,5.95,5.85,.081)
            self.box(SAND,x,-2.38,.075,5.57,5.55,.035)
            for i in range(20):
                self.box(('#ad9267','#9f855d','#bc9f70')[i%3],x+self.rng.uniform(-2.64,2.64),
                         self.rng.uniform(-5.00,.24),.098,.074+self.rng.random()*.13,.067,.011)
            for y in (-.30,-1.46,-2.62,-3.78,-4.94):
                post=ASHLAR[2] if self.level>=7 else OAK
                self.box(post,s*6.51,y,.33,.21,.23,.56)
                self.box(IVORY if self.level>=7 else DARK,s*6.51,y,.631,.25,.26,.086)
            for z in (.26,.47):
                self.box(OAK,s*6.51,-2.62,z,.091,4.72,.078)
        if self.level>=6:
            self.paving(0,-2.55,1.23,5.46)
        else:
            self.box(SAND,0,-2.58,.051,1.18,5.47,.043)
        self.dummy(-3.40,-1.15)
        if self.level>=4:self.dummy(-5.10,-2.42)
        self.target(3.24,-.86)
        if self.level>=2:self.target(5.04,-1.12)
        if self.level>=3:self.target(4.16,-2.26)
        if self.level>=5:
            for x in (2.65,4.04,5.40):
                self.box(REED[1],x,-3.85,.18,.85,.42,.20)
                self.box(OAK,x,-3.85,.29,.87,.072,.034)
        for x,y in ((-6.06,-.72),(-5.57,-.79),(6.04,-.38)):
            self.ring(OAK,x,y,.099,.20,.206,.42,9)
            self.ring(DARK,x,y,.18,.215,.22,.049,9)
            self.ring(DARK,x,y,.42,.22,.215,.043,9)

    def dummy(self,x,y):
        self.rod(OAK,(x,y,.08),(x,y,1.45),.075)
        self.rod(OAK,(x-.47,y,.97),(x+.47,y,.97),.066)
        self.ball(REED[2],x,y,1.15,.27,.17,.35)
        self.ball(REED[3],x,y,1.55,.13,.117,.15)
        self.rod(RUST,(x-.24,y-.11,1.29),(x+.22,y-.135,.99),.054)
        self.box(DARK,x,y,.116,.72,.37,.072)

    def target(self,x,y):
        for s in (-1,1):
            self.rod(OAK,(x+s*.32,y+.31,.081),(x+s*.08,y,1.48),.053)
        self.rod(OAK,(x,y-.34,.081),(x,y,1.48),.059)
        for r,depth,color in ((.39,0,REED[2]),(.307,-.055,CREAM),(.231,-.073,RUST),
                              (.157,-.09,CREAM),(.080,-.103,CRIMSON)):
            self.rod(color,(x,y+depth,1.24),(x,y+depth-.045,1.24),r,sides=16)

    def quarters(self):
        level=self.level
        w,d=6.72 if level>2 else 5.5,3.52
        h=(2.11,2.67,2.74,3.18,3.59,4.20,4.48,4.85,5.31,6.15)[level-1]
        with self.at(0,2.47):
            self.footings(w+.30,d+.24)
            if level<=3:
                self.box('#bda371',0,0,h*.50,w,d,h)
                self.timber(w,d,.18,h,1.15,OAK,True)
            else:
                self.wall(w,d,h,.18,level>=7)
                self.cornice(w,d,h-.085,self.gilt)
                if level>=6:self.courses(-d/2,w,(h*.52,),self.gilt)
            y=-d/2-.026
            self.opening(0,y,.18,1.11,1.52,'door',IVORY if level>=4 else OAK)
            self.windows(y,.86,(-w*.29,w*.29),.63,.85,self.gilt)
            if level>=5:self.windows(y,h-.99,(-w*.285,0,w*.285),.52,.64,self.gilt)
            if level>=7:self.banner(0,y-.18,h*.60,1.08)
            self.hip(w+.49,d+.45,h+.04,1.12+level*.032,self.roofs,GOLD if self.gilt else DARK)
            self.chimney(w*.25,.24,h+.81,1.0,brick=level<5)
            if level>=9:
                self.turret_roof(0,.26,h+1.04,.87,1.20,self.roofs,level==10)
                self.rod(GOLD,(0,.26,h+2.19),(0,.26,h+2.76),.053,.019)

    def flanks(self):
        if self.level<2:return
        level=self.level
        for s in (-1,1):
            if level==2 and s==1:continue
            x=s*4.99
            with self.at(x,2.24):
                w=2.12 if level<=4 else 2.65
                d=2.44 if level<=4 else 2.84
                h=1.89+level*.16+(level-6)*.34 if level>=7 else 1.68+level*.20
                if level<=3:
                    self.box('#b99a6a',0,0,h*.50,w,d,h)
                    self.timber(w,d,.11,h,.88,OAK,True)
                else:
                    self.wall(w,d,h,.15,level>=7)
                self.opening(0,-d/2-.015,.13,.70,1.28,'door',IVORY if level>=4 else DARK)
                if level in (5,8):
                    for x0 in (-w*.36,0,w*.36):
                        for sign in (-1,1):self.box(IVORY,x0,sign*d*.476,h+.23,.38,.30,.38)
                    for sign in (-1,1):self.box(IVORY,sign*w*.47,0,h+.23,.31,.36,.37)
                else:
                    self.hip(w+.40,d+.36,h+.045,.69+level*.047,self.roofs,GOLD if self.gilt else DARK)
                if level>=5:
                    self.banner(s*.63,-d/2-.09,h-.22,.72 if level<7 else 1.05)
                if level>=7:self.windows(-d/2-.016,h*.55,(0,),.48,.60,self.gilt)
        if level>=4:
            for s in (-1,1):
                self.lamp(s*.88,-.08,.10)
                if level>=6:self.paving(s*4.95,.42,2.5,1.10)

    def review_gate(self):
        if self.level<7:return
        y=-4.95
        for s in (-1,1):
            x=s*.94
            self.box(ASHLAR[2],x,y,.176,.46,.45,.290)
            self.column(x,y,.29,1.31,.115,self.gilt)
            self.lamp(x,y,1.68)
        if self.level>=9:
            self.archway(0,y,1.57,1.46,.44,.26,True)
            self.crest(0,y-.17,2.20,.187)

    def build(self,collection):
        self.yard()
        self.quarters()
        self.flanks()
        self.review_gate()
        self.instantiate(collection,TITLES[self.level-1])


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene
    for level in range(1,11):
        collection=bpy.data.collections.new(f'Quartel Nível {level:02}')
        scene.collection.children.link(collection)
        Barracks(level).build(collection)
        bpy.ops.export_scene.gltf(filepath=str(ROOT/'src'/'assets'/f'barracks-nivel-{level}.glb'),
                                  export_format='GLB',collection=collection.name,export_yup=True,
                                  export_extras=True,export_meshopt_compression_enable=True)
    stage_surface(scene,TITLES,'Quartel',pad=(13.66,10.98),columns=16.2,rows=14.9,
                  scale=85.8,target_height=2.0,resolution_y=880,label_scale=1.13,label_clearance=3.7)
    scene.eevee.taa_render_samples=20
    scene.render.filepath=str(ROOT/'models'/'quarteis-niveis-1-a-10.png')
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/'quarteis-niveis-1-a-10.blend'),compress=True)
    bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    build()
