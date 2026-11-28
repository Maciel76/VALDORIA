"""Render the original character portraits shown in Valdória's training panel."""
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_housing import Architecture, ROOT, material

# Identifier, costume, accent, complexion, hair, heraldry backdrop.
UNITS=(
    ('recruit','#7f7050','#ac8955','#c89570','#513529','#3b4134'),
    ('slinger','#8b5b4b','#d39b57','#a56e51','#382b29','#514037'),
    ('archer','#3b6250','#a5b378','#d0a080','#613934','#304944'),
    ('spearman','#914548','#bf9169','#946046','#3b2d2a','#483338'),
    ('crossbow','#5b626d','#b27a55','#cf9d77','#4a4038','#384351'),
    ('bow-guard','#315e6c','#91b9ae','#b58063','#332e32','#263f49'),
    ('sword-guard','#802c36','#d1a46d','#d7ac8f','#58342d','#50323a'),
    ('royal-crossbow','#664965','#d4a465','#c18b68','#3b2b2a','#42344e'),
    ('royal-archer','#264d77','#ddae5b','#9c694e','#312929','#2e3d56'),
    ('imperial-guard','#1e3863','#f0bc65','#cea583','#443237','#332e46'),
)
LEATHER, DARK, IRON, SILVER, GOLD, IVORY='#664536','#392b36','#565c67','#a2aebb','#dfac57','#e2d0ae'


class Portrait(Architecture):
    def __init__(self,level,colors):
        super().__init__(level)
        self.rng.seed(7809+level)
        self.coat,self.trim,self.skin,self.hair=colors
        self.metal=IRON if level<6 else SILVER

    def loft(self,color,levels,sides=16):
        vertices=[(x+w*cos(a),y+d*sin(a),z) for z,x,y,w,d in levels
                  for a in ((i+.5)*2*pi/sides for i in range(sides))]
        faces=[tuple(range(sides-1,-1,-1))]
        for row in range(len(levels)-1):
            for i in range(sides):
                j=(i+1)%sides
                faces.append((row*sides+i,row*sides+j,(row+1)*sides+j,(row+1)*sides+i))
        faces.append(tuple(range(len(vertices)-sides,len(vertices))))
        self.mesh(color,vertices,faces)

    def uniform(self):
        level=self.level
        self.loft(self.coat,[(.25,0,0,.26,.145),(.73,0,0,.29,.17),
                 (.99,0,0,.245,.155),(1.34,0,0,.40,.19),(1.46,0,0,.34,.16),
                 (1.56,0,0,.14,.125)])
        self.loft(LEATHER,[(.87,0,0,.269,.176),(.93,0,0,.266,.179)])
        self.box(self.trim,.03,-.180,.90,.115,.035,.080)
        self.box(DARK,.03,-.205,.90,.074,.015,.042)
        self.loft(self.trim,[(1.43,0,0,.19,.163),(1.49,0,0,.151,.139),(1.56,0,0,.114,.108)])
        self.loft(self.skin,[(1.47,0,0,.086,.091),(1.66,0,.017,.086,.088)])
        for s in (-1,1):
            a=(s*.295,.004,1.39)
            b=(s*.415,-.02,1.15)
            c=(s*.44,-.28,1.24 if s<0 else 1.08)
            self.rod(self.coat,a,b,.112,.082,10)
            self.ball(self.coat,*a,.148,.157,.123)
            self.rod(LEATHER,b,c,.082,.057,9)
            self.ball(self.skin,*c,.068,.065,.069)
            if level>=4:
                self.loft(self.metal,[(1.31,s*.345,.005,.128,.125),(1.39,s*.336,.009,.163,.165),
                          (1.47,s*.322,.005,.143,.125),(1.51,s*.312,.005,.088,.086)])
                self.rod(self.trim,(s*.38,-.145,1.39),(s*.258,-.151,1.43),.020)
                self.rod(self.metal,b,(s*.435,-.217,1.22 if s<0 else 1.10),.086,.069,9)
            else:
                self.rod(self.trim,(s*.420,-.12,1.20),(s*.437,-.192,1.21 if s<0 else 1.12),.086,.073,9)
        if level in (4,5,7,8,10):
            self.loft(self.metal,[(.964,0,-.045,.232,.135),(1.22,0,-.038,.302,.173),
                     (1.374,0,-.026,.316,.175),(1.43,0,-.025,.206,.147)])
            for z in (1.006,1.075,1.143,1.212):
                if level not in (7,10):
                    self.rod(self.trim,(-.196,-.204,z),(.196,-.204,z),.016)
            self.gem(0,-.218,1.279,.067,GOLD if level>=7 else DARK)
            if level==10:
                for s in (-1,1):
                    self.rod(GOLD,(s*.039,-.220,1.188),(s*.220,-.191,1.340),.018)
                    self.rod(GOLD,(s*.030,-.216,1.119),(s*.230,-.179,1.247),.013)
                    self.ball(GOLD,s*.350,-.117,1.419,.104,.055,.063)
        elif level in (3,6,9,2):
            self.rod(LEATHER,(-.245,-.158,1.474),(.177,-.207,.944),.041,.048,6)
            self.rod(self.trim,(-.213,-.193,1.440),(.207,-.221,.954),.013,.016,5)
            for z in (1.04,1.12,1.20,1.28,1.36):
                self.ball(self.trim,.021,-.196,z,.016,.013,.015)
        if level>=6:
            self.mesh(self.coat,[(-.34,.12,1.49),(.34,.12,1.49),(.55,.22,.32),
                      (.24,.32,.23),(-.14,.26,.31),(-.47,.22,.225),(-.53,.19,.35),
                      (-.27,.20,1.17),(.25,.21,1.16)],
                      [(0,1,8,7),(7,8,2,3),(7,3,4),(0,7,4,5,6)])
            self.ball(self.trim,-.29,-.16,1.446,.060,.029,.062)
            self.ball(self.trim,.29,-.16,1.446,.060,.029,.062)

    def face(self):
        level=self.level
        self.loft(self.skin,[(1.568,0,-.017,.056,.081),(1.61,0,-.03,.107,.113),
                 (1.70,0,-.01,.132,.121),(1.82,0,-.005,.137,.125),
                 (1.912,0,.009,.113,.115),(1.947,0,.01,.079,.087)])
        for s in (-1,1):
            self.ball(self.skin,s*.127,.007,1.735,.031,.037,.059)
            self.ball(IVORY,s*.056,-.123,1.771,.031,.013,.016)
            self.ball('#362932',s*.055,-.136,1.770,.012,.009,.0125)
            self.ball('#f4dbc4',s*.051,-.144,1.773,.004,.003,.004)
            self.rod(self.hair,(s*.034,-.125,1.801),(s*.087,-.105,1.795),.009)
        self.ball(self.skin,0,-.130,1.730,.030,.046,.036)
        self.ball('#70443a',0,-.137,1.658,.042,.009,.007)
        if level in (1,4,7,8,10):
            self.loft(self.hair,[(1.555,0,-.066,.035,.064),(1.607,0,-.064,.09,.096),
                     (1.668,0,-.021,.117,.101),(1.726,0,.021,.130,.079)])
            self.ball('#70443a',0,-.166,1.651,.031,.009,.007)
        if level in (2,3,6,9):
            self.loft(self.hair,[(1.755,0,.056,.135,.101),(1.861,0,.001,.144,.135),
                     (1.942,0,0,.118,.114),(1.975,0,0,.065,.075)])
            for s in (-1,1):
                self.rod(self.hair,(s*.122,.027,1.834),(s*.111,.048,1.626),.023,.012)
        if level in (1,2):
            self.loft(self.coat,[(1.815,0,.012,.150,.147),(1.900,0,.025,.161,.152),
                     (1.982,-.026,.03,.113,.116),(2.016,-.048,.033,.030,.049)])
            self.loft(self.trim,[(1.807,0,.014,.155,.151),(1.831,0,.014,.161,.152)])
        elif level in (3,6,9):
            self.loft(self.coat,[(1.781,0,.066,.159,.108),(1.872,0,.015,.174,.158),
                     (1.973,0,.026,.133,.119),(2.051,0,.068,.066,.065)])
            for s in (-1,1):
                self.rod(self.coat,(s*.118,-.103,1.854),(s*.153,-.044,1.655),.035,.06)
                self.rod(self.trim,(s*.10,-.111,1.93),(s*.135,-.102,1.778),.014)
            if level==9:self.gem(0,-.148,1.930,.038,GOLD)
        else:
            self.loft(self.metal,[(1.824,0,.013,.156,.141),(1.931,0,.017,.154,.135),
                     (2.017,0,.023,.111,.105),(2.075,0,.032,.033,.051)])
            self.loft(self.trim,[(1.817,0,.012,.163,.149),(1.845,0,.012,.164,.150)])
            for s in (-1,1):
                self.rod(self.metal,(s*.125,-.080,1.864),(s*.126,-.061,1.688),.037,.017)
            if level>=7:
                self.rod(self.trim,(0,-.144,1.836),(0,-.115,1.754),.023,.015,6)
                self.gem(0,-.143,1.902,.039,GOLD)
                self.rod(self.trim,(0,.028,2.050),(0,.030,2.174),.033,.014)
                for i in range(5):
                    x=(i-2)*.022
                    self.ball(self.coat,x,.034+i*.023,2.163+i*.011,.046,.091,.060)
            if level==10:
                for s in (-1,1):
                    self.prism(GOLD,[(s*.090,1.938),(s*.151,1.901),
                                     (s*.167,2.057),(s*.121,2.011)],.034,-.080)
                self.prism(GOLD,[(-.048,1.933),(0,1.905),(.048,1.933),(0,2.048)],.033,-.119)

    def gem(self,x,y,z,r,color):
        self.prism(color,[(x-r,z),(x,z-r*1.2),(x+r,z),(x,z+r*1.2)],.037,y)

    def shield(self):
        x,y=-.34,-.408
        shape=[(x-.198,1.28),(x-.203,1.021),(x-.131,.862),(x,.758),
               (x+.131,.862),(x+.203,1.021),(x+.198,1.28),(x,1.324)]
        if self.level==1:
            self.rod(LEATHER,(x,y+.040,1.045),(x,y,1.045),.229,sides=14)
            self.rod(self.trim,(x,y,1.045),(x,y-.025,1.045),.218,sides=14)
            self.rod(self.coat,(x,y-.025,1.045),(x,y-.050,1.045),.194,sides=14)
            self.ball(self.metal,x,y-.073,1.045,.062,.047,.062)
            return
        self.prism(self.trim,shape,.068,y)
        self.prism(self.coat,[(x+(u-x)*.89,1.05+(z-1.05)*.90) for u,z in shape],.030,y-.049)
        self.gem(x,y-.085,1.068,.074,GOLD)
        for s in (-1,1):
            self.rod(self.trim,(x+s*.121,y-.083,1.177),(x+s*.038,y-.086,1.089),.015)
            self.rod(self.trim,(x+s*.110,y-.083,1.231),(x+s*.052,y-.086,1.169),.015)

    def bow(self):
        x,y=.57,-.318
        profile=[(x-.07,y,.59),(x+.02,y,.742),(x+.121,y,.945),(x+.137,y,1.176),
                 (x+.094,y,1.41),(x-.015,y,1.684),(x-.086,y,1.794)]
        for j,(a,b) in enumerate(zip(profile,profile[1:])):
            self.rod(self.trim if self.level>=6 else LEATHER,a,b,.021 if j in (0,5) else .026)
        self.rod(IVORY,profile[0],profile[-1],.005,sides=5)
        self.rod(DARK,(x+.134,y,1.035),(x+.136,y,1.215),.033)
        self.ball(self.skin,x+.135,y-.018,1.11,.055,.043,.057)
        for j in range(4):
            u=-.33+j*.035
            h=1.755+(j%2)*.055
            self.rod(LEATHER,(u+.16,.15,1.038),(u,.12,h),.010)
            self.rod(self.trim,(u+.034,.126,h-.128),(u,.12,h),.025,.009,6)

    def arbalest(self):
        y=-.382
        self.rod(LEATHER,(-.235,y+.10,.896),(.331,y,1.235),.054,.038,6)
        self.rod(self.metal,(-.148,y+.072,.934),(.344,y-.036,1.24),.023,.012)
        path=[(.079,y-.077,1.54),(.186,y-.093,1.435),(.331,y-.104,1.255),
              (.430,y-.099,1.052),(.452,y-.087,.931)]
        for a,b in zip(path,path[1:]):self.rod(self.trim,a,b,.026)
        notch=(.166,y-.079,1.138)
        self.rod(IVORY,path[0],notch,.008)
        self.rod(IVORY,notch,path[-1],.008)
        self.ball(self.skin,-.205,y+.085,.931,.062,.046,.062)
        self.ball(self.skin,.316,y+.025,1.193,.064,.055,.050)

    def equipment(self):
        level=self.level
        if level in (3,6,9):
            self.bow()
            return
        if level in (5,8):
            self.arbalest()
            return
        if level==2:
            self.ball(LEATHER,-.24,-.223,.851,.116,.053,.119)
            self.rod(self.trim,(.42,-.282,1.116),(.566,-.279,1.375),.019)
            self.rod(self.trim,(.566,-.279,1.375),(.65,-.283,1.197),.017)
            self.ball(LEATHER,.65,-.283,1.179,.057,.023,.044)
            return
        self.shield()
        if level==4:
            self.rod(LEATHER,(.47,-.291,.34),(.52,-.267,1.977),.025,.023)
            self.prism(SILVER,[(.518,1.863),(.463,1.971),(.516,2.227),(.579,1.978)],.036,-.267)
        else:
            self.rod(LEATHER,(.44,-.285,.998),(.47,-.269,1.259),.028)
            self.ball(self.trim,.44,-.286,1.001,.042,.041,.042)
            self.rod(self.trim,(.352,-.269,1.242),(.592,-.27,1.222),.032,.027)
            self.prism(SILVER,[(.426,1.244),(.448,1.76),(.518,1.851),
                       (.563,1.744),(.515,1.239)],.037,-.267)
            self.rod(IVORY,(.469,-.297,1.24),(.519,-.297,1.792),.012)

    def make(self,collection,label):
        self.uniform()
        self.face()
        self.equipment()
        self.instantiate(collection,label)


def lamps(collection):
    for name,position,energy,color,size in (
            ('Luz principal',(-2.5,-3.5,4.3),350,(1,.84,.69),3.4),
            ('Luz frontal',(2.2,-2.5,2.8),170,(.76,.87,1),2.65),
            ('Contraluz',(1.0,1.1,3.65),290,(1,.75,.51),2.1)):
        data=bpy.data.lights.new(name,'AREA')
        data.energy=energy
        data.color=color
        data.shape='DISK'
        data.size=size
        light=bpy.data.objects.new(name,data)
        collection.objects.link(light)
        light.location=position
        light.rotation_euler=(Vector((0,0,1.36))-light.location).to_track_quat('-Z','Y').to_euler()


def backdrop(collection,color):
    stage=Architecture(1)
    stage.box(color,0,1.16,1.38,25,.055,24)
    # Quiet, soft-edged heraldic rings behind the characters.
    for value,r in ((.007,.69),(.011,.735)):
        for i in range(48):
            a,b=i*2*pi/48,(i+1)*2*pi/48
            stage.rod('#8f775d',(r*cos(a),1.114,1.505+r*sin(a)),
                      (r*cos(b),1.114,1.505+r*sin(b)),value,sides=5)
    stage.instantiate(collection,'Fundo')


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    studio=bpy.context.scene
    studio.name='Retratos de Valdória'
    rig=bpy.data.collections.new('Câmera e iluminação')
    studio.collection.children.link(rig)
    camera=bpy.data.cameras.new('Retrato')
    camera.type='ORTHO'
    camera.ortho_scale=1.59
    rig.objects.link(studio_camera:=bpy.data.objects.new('Retrato',camera))
    studio_camera.location=(.72,-5.1,1.87)
    studio_camera.rotation_euler=(Vector((.045,0,1.517))-studio_camera.location).to_track_quat('-Z','Y').to_euler()
    studio.camera=studio_camera
    lamps(rig)
    world=bpy.data.worlds.new('Luz âmbar')
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.28,.24,.28,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.32
    studio.world=world
    studio.render.engine='BLENDER_EEVEE'
    studio.eevee.taa_render_samples=20
    studio.render.resolution_x=360
    studio.render.resolution_y=420
    studio.render.image_settings.file_format='PNG'
    studio.view_settings.view_transform='AgX'
    studio.view_settings.look='AgX - Medium High Contrast'
    for color in (IRON,SILVER,GOLD):
        shader=next(node for node in material(color).node_tree.nodes if node.type=='BSDF_PRINCIPLED')
        shader.inputs['Metallic'].default_value=.46
        shader.inputs['Roughness'].default_value=.38
    out=ROOT/'public'/'tropas'
    out.mkdir(parents=True,exist_ok=True)
    units=[]
    for level,(label,*colors,background) in enumerate(UNITS,1):
        collection=bpy.data.collections.new(f'{level:02} · {label}')
        studio.collection.children.link(collection)
        Portrait(level,colors).make(collection,label)
        backdrop(collection,background)
        collection.hide_render=collection.hide_viewport=True
        units.append((label,collection))
    for label,collection in units:
        collection.hide_render=collection.hide_viewport=False
        studio.render.filepath=str(out/(label+'.png'))
        bpy.ops.render.render(write_still=True)
        collection.hide_render=collection.hide_viewport=True
    units[-1][1].hide_render=units[-1][1].hide_viewport=False
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.shading.color_type='MATERIAL'
                area.spaces.active.region_3d.view_perspective='CAMERA'
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models'/'tropas-de-valdoria.blend'),compress=True)


if __name__=='__main__':
    build()
