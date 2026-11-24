"""Author the inhabitants, riding horse and timber wagon in Blender."""
from math import cos, pi, sin
from pathlib import Path
from random import Random
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "src" / "assets"
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "Valdória | Moradores, cavalo e carroça"
scene.unit_settings.system = "METRIC"
scene.render.fps = 24
rng = Random(15461)

def position(x, y, z):
    return (x, -z, y)

def linear(channel):
    channel = int(channel, 16) / 255
    return channel / 12.92 if channel <= .04045 else ((channel + .055) / 1.055) ** 2.4

def material(name, hex_color, metallic=0, rough=.87):
    mat = bpy.data.materials.new(name)
    color = tuple(linear(hex_color[i:i+2]) for i in (0, 2, 4)) + (1,)
    mat.diffuse_color = color
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = rough
    return mat

palette = {
    'linen':'d4c1a7','linenShade':'b6a18b','thread':'d0ad73','skin1':'c7946c','skin2':'b17c55','skin3':'926145',
    'lips':'8e4939','eye':'c9c1ac','pupil':'3e3828','hair':'443126','hairLight':'634b32','gray':'8c8373',
    'boots':'493727','leather':'59402c','seam':'846445','farmer':'725d44','farmerLight':'927552',
    'merchant':'375764','merchantLight':'537a83','guard':'7e8890','guardLight':'a4aab0','rider':'943e36',
    'riderLight':'af594a','visitor':'596345','visitorLight':'7b865c','swimmer':'d2be98','swimmerLight':'e0cda9',
    'iron':'414747','ironRim':'555b5b','brass':'bb9558','rope':'a89162','sack':'a78b66',
    'horse':'965c38','horseLight':'b8784d','horseShade':'633b2b','mane':'34271f','hoof':'36302d',
    'oak':'805639','oakLight':'a57448','oakShade':'65442f','cutWood':'b68b5c'
}
colors = {name:tuple(linear(value[i:i+2]) for i in (0,2,4)) for name,value in palette.items()}
metals = {'iron','ironRim','guard','guardLight','brass'}
pigments = [material('Pigmentos dos habitantes','ffffff'),material('Metal forjado','ffffff',.41,.48)]
for mat in pigments:
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    pigment = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    pigment.layer_name = 'Pigmento'
    mat.node_tree.links.new(pigment.outputs['Color'],shader.inputs['Base Color'])

def root(name):
    obj=bpy.data.objects.new(name,None)
    scene.collection.objects.link(obj)
    return obj

def joint(parent, name, x=0, y=0, z=0):
    obj=root(parent.name.split('__')[0]+'__'+name)
    obj.parent=parent
    obj.location=position(x,y,z)
    obj.empty_display_size=.1
    return obj

class Part:
    def __init__(self, parent, name):
        self.parent, self.name=parent,name
        self.verts, self.faces, self.colors, self.smooth=[],[],[],[]

    def add(self, vertices, faces, color, smooth=False):
        start=len(self.verts)
        self.verts.extend(position(*v) for v in vertices)
        self.faces.extend(tuple(start+i for i in face) for face in faces)
        self.colors.extend([color]*len(faces))
        self.smooth.extend([smooth]*len(faces))

    def loft(self, rows, color, sides=12, smooth=True, axis='y'):
        """Rows describe a curved silhouette as center, width and depth."""
        vertices=[]
        for (x,y,z,wide,deep) in rows:
            for i in range(sides):
                a=2*pi*i/sides
                vertices.append((x+wide*cos(a), y+deep*sin(a),z) if axis=='z'
                                else (x+wide*cos(a),y,z+deep*sin(a)))
        faces=[]
        for level in range(len(rows)-1):
            for i in range(sides):
                a=level*sides+i
                b=level*sides+(i+1)%sides
                faces.append((a,a+sides,b+sides,b) if axis=='y' else (a,b,b+sides,a+sides))
        lower=tuple(range(sides))
        upper=tuple(range((len(rows)-1)*sides,len(rows)*sides))
        if axis=='z':
            lower=lower[::-1]
            upper=upper[::-1]
        self.add(vertices,[lower,*faces,upper[::-1]],color,smooth)

    def oval(self,x,y,z,a,b,c,color,sides=12,rows=7):
        offsets=[(-pi/2+.018)+i*(pi-.036)/rows for i in range(rows+1)]
        self.loft([(x,y+b*sin(t),z,a*cos(t),c*cos(t)) for t in offsets],color,sides)

    def beam(self, start, end, width, depth, color, sides=4, tapered=1):
        aa,bb=Vector(start),Vector(end)
        axis=(bb-aa).normalized()
        reference=Vector((0,0,1)) if abs(axis.z)<.87 else Vector((0,1,0))
        u=axis.cross(reference).normalized()
        v=axis.cross(u).normalized()
        points=[]
        for center,scale in [(aa,1),(bb,tapered)]:
            points.extend(tuple(center+(cos(2*pi*i/sides+pi/4)*u*width+sin(2*pi*i/sides+pi/4)*v*depth)*.5*scale)
                          for i in range(sides))
        faces=[tuple(range(sides-1,-1,-1)),tuple(range(sides,sides*2))]
        for i in range(sides):
            j=(i+1)%sides
            faces.append((i,j,j+sides,i+sides))
        self.add(points,faces,color,sides>6)

    def box(self,x,y,z,w,h,d,color):
        self.add([(x+a*w/2,y+b*h/2,z+c*d/2) for a,b,c in
                  [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]],
                 [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(0,1,5,4),(3,7,6,2)],color)

    def torus_x(self,x,radius,tube,color,steps=24,sides=6):
        verts=[]
        for i in range(steps):
            angle=i*2*pi/steps
            for j in range(sides):
                t=j*2*pi/sides
                r=radius+tube*cos(t)
                verts.append((x+tube*sin(t),r*cos(angle),r*sin(angle)))
        faces=[]
        for i in range(steps):
            for j in range(sides):
                a=i*sides+j
                b=i*sides+(j+1)%sides
                c=((i+1)%steps)*sides+(j+1)%sides
                d=((i+1)%steps)*sides+j
                faces.append((d,c,b,a))
        self.add(verts,faces,color,True)

    def build(self):
        mesh=bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.verts,[],self.faces)
        mesh.update()
        for mat in pigments:
            mesh.materials.append(mat)
        pigment=mesh.color_attributes.new(name='Pigmento',type='BYTE_COLOR',domain='CORNER')
        for face,color,smooth in zip(mesh.polygons,self.colors,self.smooth):
            face.material_index=int(color in metals)
            face.use_smooth=smooth
            for index in face.loop_indices:
                v=mesh.vertices[mesh.loops[index].vertex_index].co
                tint=1+.045*sin(v.x*86+v.y*16+v.z*27)
                pigment.data[index].color=tuple(c*tint for c in colors[color])+(1,)
        obj=bpy.data.objects.new(self.parent.name+'_'+self.name,mesh)
        scene.collection.objects.link(obj)
        obj.parent=self.parent
        return obj

def poses(node,keys,index=0):
    for frame,value in keys:
        node.rotation_euler[index]=value
        node.keyframe_insert(data_path='rotation_euler',index=index,frame=frame)

def person(role):
    model=root(role)
    body=joint(model,'Body')
    main=role
    trim=role+'Light'
    skin={'guard':'skin2','merchant':'skin3','visitor':'skin2','rider':'skin1','swimmer':'skin2'}.get(role,'skin1')
    base=Part(body,'Tunica e cintos')
    base.loft([(0,.80,-.012,.207,.148),(0,.89,-.012,.215,.156),(0,.97,0,.186,.128),
               (0,1.14,.003,.191,.129),(0,1.37,.005,.244,.141),(0,1.45,.01,.206,.107),
               (0,1.49,.012,.115,.09)],main,16)
    base.loft([(0,.80,-.012,.208,.150),(0,.825,-.012,.212,.151)],trim,16)
    base.loft([(0,.961,0,.192,.138),(0,1.019,0,.190,.137)],'leather',16)
    base.box(0,.992,.141,.064,.050,.025,'brass')
    base.box(0,.993,.156,.036,.021,.013,'leather')
    base.oval(.165,.92,.121,.084,.105,.044,'boots',9,5)
    base.oval(.165,.955,.149,.078,.062,.023,'seam',8,4)
    for side in (-1,1):
        base.beam((side*.11,.84,.141),(side*.082,.966,.132),.010,.01,trim)
        base.beam((side*.09,1.458,.103),(0,1.36,.152),.025,.015,'linen')
    if role in ('merchant','visitor','rider'):
        base.beam((-.14,1.42,.125),(.17,.99,.135),.044,.014,'leather')
        base.oval(-.19,1.027,-.144,.115,.132,.086,'seam')
    if role=='guard':
        for side in (-1,1):
            base.oval(side*.232,1.389,0,.098,.092,.119,'guardLight',9,5)
    base.build()

    head=joint(body,'Head',0,1.485,.014)
    face=Part(head,'Rosto e cobertura')
    face.loft([(0,0,0,.066,.063),(0,.08,0,.067,.067)],skin)
    face.loft([(0,.068,.024,.059,.065),(0,.105,.024,.084,.088),(0,.165,.014,.098,.102),
               (0,.23,.006,.095,.10),(0,.276,-.004,.075,.079),(0,.297,-.005,.025,.027)],skin,16)
    face.oval(0,.158,.108,.027,.046,.036,skin,10,5)
    face.oval(0,.117,.109,.032,.008,.009,'lips',8,4)
    for side in (-1,1):
        face.oval(side*.097,.173,.008,.019,.039,.026,skin,9,5)
        face.oval(side*.037,.195,.104,.017,.009,.009,'eye',8,4)
        face.oval(side*.035,.195,.111,.006,.007,.005,'pupil',8,4)
        face.beam((side*.016,.212,.107),(side*.055,.212,.103),.009,.012,'hair')
    hair='gray' if role=='merchant' else 'hair'
    face.oval(0,.246,-.027,.099,.066,.085,hair,12,6)
    if role in ('merchant','guard'):
        face.oval(0,.092,.078,.064,.040,.053,hair,10,5)
    if role=='guard':
        face.loft([(0,.222,0,.105,.109),(0,.262,0,.116,.109),(0,.325,-.006,.09,.088),
                   (0,.356,-.005,.031,.034)],'guard',16)
        face.beam((0,.161,.125),(0,.272,.113),.021,.017,'guardLight')
        face.loft([(0,.225,-.002,.116,.111),(0,.238,-.002,.116,.110)],'iron',16)
    elif role!='swimmer':
        hat='merchant' if role=='merchant' else 'leather' if role=='rider' else trim
        face.loft([(0,.253,.002,.145,.134),(0,.265,0,.145,.131),(0,.267,-.006,.098,.090),
                   (.016,.31,-.008,.09,.081),(.031,.326,-.013,.066,.063)],hat,18)
        face.loft([(0,.265,0,.106,.096),(0,.278,0,.107,.096)],'leather',18)
    face.build()

    for name,side in [('L',-1),('R',1)]:
        hip=joint(body,'Hip'+name,side*.102,.935,0)
        knee=joint(hip,'Knee'+name,0,-.429,0)
        ankle=joint(knee,'Ankle'+name,0,-.397,0)
        leg=Part(hip,'Coxa')
        leg.loft([(0,-.444,0,.059,.059),(0,-.32,-.005,.071,.070),
                  (0,-.12,-.007,.092,.085),(0,.012,-.006,.099,.101)],'linenShade',11)
        leg.build()
        calf=Part(knee,'Perneira')
        calf.loft([(0,-.414,0,.055,.055),(0,-.28,-.015,.057,.063),
                   (0,-.13,-.019,.066,.069),(0,.028,0,.063,.067)],skin if role=='swimmer' else 'boots',11)
        if role!='swimmer':
            calf.loft([(0,-.128,-.015,.067,.071),(0,-.091,-.014,.067,.071)],'leather',11)
        calf.build()
        foot=Part(ankle,'Bota com sola')
        foot.loft([(0,-.105,.053,.059,.122),(0,-.083,.065,.062,.122),(0,-.057,.063,.059,.119),
                   (0,-.01,.02,.057,.082),(0,.057,-.005,.054,.058)],skin if role=='swimmer' else 'boots',12)
        if role!='swimmer':
            foot.loft([(0,-.109,.053,.061,.124),(0,-.091,.057,.063,.125)],'hair',12)
        foot.build()
        shoulder=joint(body,'Shoulder'+name,side*.231,1.385,0)
        elbow=joint(shoulder,'Elbow'+name,side*.018,-.266,0)
        upper=Part(shoulder,'Manga')
        upper.loft([(side*.018,-.284,0,.052,.055),(side*.023,-.20,-.002,.06,.061),
                    (side*.012,-.077,-.007,.072,.071),(0,.039,0,.078,.08)],main if role!='swimmer' else skin)
        upper.build()
        hand=Part(elbow,'Antebraco e mao')
        hand.loft([(side*.009,-.205,.012,.036,.034),(side*.014,-.134,.007,.040,.042),
                   (0,-.055,0,.052,.049),(0,.022,0,.053,.053)],skin if role=='swimmer' else trim)
        hand.loft([(side*.009,-.201,.008,.038,.036),(side*.009,-.176,.008,.040,.038)],'linenShade')
        hand.oval(side*.01,-.238,.015,.037,.06,.029,skin)
        hand.oval(side*-.015,-.238,.042,.019,.032,.016,skin,8,5)
        hand.build()
        if role=='guard' and side==1:
            spear=Part(shoulder,'Lanca')
            spear.beam((.025,-1.24,.07),(.025,.78,.07),.039,.040,'oak',8)
            spear.beam((.025,.77,.07),(.025,.95,.07),.059,.06,'iron',6,.05)
            spear.build()
        sign=1 if side<0 else -1
        poses(hip,[(1,sign*.37),(13,-sign*.37),(25,sign*.37)])
        poses(knee,[(1,.08),(7,.61 if sign==1 else .12),(13,.08),(19,.12 if sign==1 else .61),(25,.08)])
        poses(shoulder,[(1,-sign*.28),(13,sign*.28),(25,-sign*.28)])
    if role=='swimmer':
        poses(body,[(1,0),(29,0),(38,1.38),(62,1.38),(70,0)])
        for side,shift in [('L',0),('R',12)]:
            arm=bpy.data.objects[role+'__Shoulder'+side]
            poses(arm,[(38,-2.8 if shift==0 else -.2),(50,-.2 if shift==0 else -2.8),(62,-2.8 if shift==0 else -.2)])
    return model

def horse():
    model=root('horse')
    body=joint(model,'Body')
    torso=Part(body,'Peito e garupa')
    torso.loft([(0,1.35,-1.06,.208,.21),(0,1.36,-.78,.340,.355),(0,1.41,-.37,.405,.385),
                (0,1.45,.11,.366,.403),(0,1.50,.52,.385,.423),(0,1.53,.77,.274,.343),
                (0,1.55,.93,.188,.249)],'horse',16,axis='z')
    torso.oval(0,1.484,-.7,.347,.365,.42,'horse')
    torso.oval(0,1.63,.38,.364,.285,.38,'horseLight')
    torso.loft([(0,1.64,-.35,.23,.26),(0,1.75,-.34,.29,.25),(0,1.829,-.29,.22,.24)],'leather',16)
    torso.oval(0,1.754,-.26,.278,.075,.332,'seam')
    for side in (-1,1):
        torso.beam((side*.30,1.75,-.33),(side*.389,1.17,-.27),.057,.031,'leather')
        torso.beam((side*.37,1.56,.46),(side*.30,1.23,.76),.053,.025,'leather')
    torso.build()
    neck=joint(body,'Neck',0,1.53,.58)
    neckpart=Part(neck,'Pescoco e crina')
    neckpart.loft([(0,-.184,.04,.251,.325),(0,.10,.077,.261,.332),(0,.37,.15,.187,.287),
                   (0,.59,.243,.148,.207),(0,.75,.278,.131,.151)],'horse',16)
    for i in range(7):
        neckpart.oval((i%2-.5)*.05,i*.104+.074,-.155+i*.022,.068,.168,.135,'mane',8,5)
    neckpart.build()
    head=joint(neck,'Head',0,.695,.27)
    face=Part(head,'Cabeca do cavalo')
    face.loft([(0,.059,-.158,.114,.125),(0,.066,-.02,.158,.194),(0,.022,.15,.140,.148),
               (0,-.084,.337,.113,.098),(0,-.126,.44,.123,.10),(0,-.127,.518,.092,.071)],'horseLight',14,axis='z')
    face.oval(0,-.128,.444,.124,.107,.133,'horseShade',14,7)
    face.oval(0,.173,.207,.040,.074,.019,'linenShade',8,5)
    face.loft([(0,-.169,.429,.129,.114),(0,-.12,.435,.128,.107)],'leather',14)
    for side in (-1,1):
        face.oval(side*.129,.079,.12,.027,.025,.039,'mane',10,6)
        face.oval(side*.151,.084,.127,.008,.007,.008,'brass',8,4)
        face.oval(side*.083,-.099,.544,.021,.019,.012,'mane',8,4)
        face.beam((side*.099,.188,-.07),(side*.145,.436,-.115),.090,.118,'horse',8,.14)
        face.beam((side*.126,.121,-.021),(side*.124,-.14,.435),.028,.033,'leather')
        face.oval(side*.12,-.176,.360,.022,.022,.024,'brass',10,4)
    face.build()
    tail=joint(body,'Tail',0,1.553,-.963)
    tailpart=Part(tail,'Cauda')
    tailpart.loft([(0,-.65,-.37,.037,.046),(0,-.49,-.351,.081,.087),(0,-.29,-.274,.10,.105),
                   (0,-.11,-.149,.089,.076),(0,0,0,.049,.07)],'mane',9)
    tailpart.build()
    for key,side,z in [('FL',-.253,.657),('FR',.253,.657),('HL',-.272,-.734),('HR',.272,-.734)]:
        rear=key.startswith('H')
        hip=joint(body,'Leg'+key,side,1.30,z)
        knee=joint(hip,'Joint'+key,0,-.627,.052 if rear else .023)
        hoof=joint(knee,'Hoof'+key,0,-.566,0)
        leg=Part(hip,'Perna superior')
        leg.loft([(0,-.66,.057 if rear else .023,.064,.067),(0,-.51,.015,.078,.073),
                 (0,-.25,-.01 if rear else .023,.100,.111),(0,-.045,0,.157,.178 if rear else .122),
                 (-side*.06,.17,0,.128,.139)],'horse',11)
        leg.build()
        shin=Part(knee,'Canela')
        shin.loft([(0,-.566,0,.048,.052),(0,-.45,0,.035,.044),
                  (0,-.17,-.012,.048,.048),(0,.052,0,.064,.064)],'horseShade',11)
        shin.build()
        shoe=Part(hoof,'Casco')
        shoe.loft([(0,-.107,.04,.073,.101),(0,-.087,.045,.071,.100),(0,-.018,.027,.063,.083),
                   (0,.042,.004,.047,.063)],'hoof',11)
        shoe.loft([(0,-.107,.043,.074,.104),(0,-.094,.043,.074,.103)],'iron',11)
        shoe.build()
        sign=1 if key in ('FL','HR') else -1
        poses(hip,[(1,sign*.36),(13,-sign*.36),(25,sign*.36)])
        poses(knee,[(1,.10),(7,.55 if sign>0 else .08),(13,.10),(19,.08 if sign>0 else .55),(25,.10)])
    return model

def wagon():
    model=root('wagon')
    bed=Part(model,'Carroceria, carga e ferragens')
    for x in [-.54,-.22,.14,.49]:
        bed.box(x,.803,0,.301,.092,2.18,rng.choice(['oak','oakLight']))
    for side in (-1,1):
        bed.beam((side*.57,.64,-1.04),(side*.57,.72,1.05),.125,.135,'oakShade')
        for y in (.89,1.045,1.201):
            bed.box(side*.692,y,-.025,.080,.141,2.13,rng.choice(['oakLight','oak']))
        for z in (-.99,-.44,.45,.965):
            bed.beam((side*.73,.703,z),(side*.756,1.325,z),.089,.106,'oakShade')
            for h in (.82,1.17):
                bed.oval(side*.791,h,z,.020,.023,.020,'iron',8,4)
        bed.beam((side*.60,.698,.98),(side*.333,1.02,2.53),.091,.105,'oakShade',6)
        bed.beam((side*.319,1.02,2.44),(side*.319,1.033,2.63),.089,.089,'iron',8)
    bed.box(0,1.013,-1.099,1.36,.43,.079,'oak')
    bed.box(0,1.045,1.042,1.39,.31,.079,'oakLight')
    bed.box(0,1.26,.735,1.49,.13,.43,'oakShade')
    for side in (-1,1):
        bed.beam((side*.60,1.06,1.01),(side*.63,1.252,.72),.073,.07,'oak')
    for x in (-.33,.27):
        bed.oval(x,1.035,-.45,.280,.218,.452,'sack',12,7)
        bed.beam((x-.216,1.17,-.48),(x+.203,1.19,-.43),.025,.025,'rope',7)
    bed.box(.33,1.016,.314,.49,.355,.48,'oak')
    for side in (-1,1):
        bed.beam((.081, .94, .314+side*.25),(.56,1.146,.314+side*.25),.062,.068,'oakShade')
    for z,r in [(.72,.48),(-.77,.62)]:
        bed.beam((-.93,r,z),(.93,r,z),.107,.111,'iron',8)
    bed.build()
    for key,x,z,r in [('FL',-.85,.72,.48),('FR',.85,.72,.48),('RL',-.88,-.77,.62),('RR',.88,-.77,.62)]:
        hub=joint(model,'Wheel'+key,x,r,z)
        wheel=Part(hub,'Roda raiada')
        wheel.torus_x(0,r-.062,.048,'oakShade')
        wheel.torus_x(0,r-.018,.020,'ironRim')
        wheel.beam((-.127,0,0),(.127,0,0),r*.33,r*.33,'oakLight',12)
        wheel.beam((-.138,0,0),(-.109,0,0),r*.23,r*.23,'iron',12)
        wheel.beam((.109,0,0),(.138,0,0),r*.23,r*.23,'iron',12)
        for i in range(12):
            a=i*2*pi/12
            wheel.beam((0,cos(a)*r*.13,sin(a)*r*.13),(0,cos(a)*(r-.077),sin(a)*(r-.077)),
                       .056,.042,'oakLight',4,.81)
        wheel.build()
        poses(hub,[(1,0),(25,2*pi)])
    return model

models=[person(role) for role in ('farmer','merchant','guard','rider','visitor','swimmer')]+[horse(),wagon()]
scene.frame_end=70
scene.timeline_markers.new('Passada',frame=1)
scene.timeline_markers.new('Entrada na água',frame=29)
scene.timeline_markers.new('Braçadas',frame=38)
scene.frame_set(1)
for i,obj in enumerate(models):
    obj.location=position((i%4)*3.5,0,(i//4)*5.5)
focus=Vector(position(5.15,.75,2.6))
for screen in bpy.data.screens:
    for area in (area for area in screen.areas if area.type=='VIEW_3D'):
        view=area.spaces.active
        view.region_3d.view_location=focus
        view.region_3d.view_distance=13
        view.region_3d.view_rotation=(Vector(position(4,6,13))-Vector(position(0,1,0))).to_track_quat('Z','Y')
        view.shading.color_type='VERTEX'

# Save the editable model lineup, then export every template in its neutral local pose.
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'moradores-e-carroca.blend'),compress=True)
for obj in scene.objects:
    obj.animation_data_clear()
    obj.rotation_euler=(0,0,0)
for obj in models:
    obj.location=(0,0,0)
bpy.ops.export_scene.gltf(filepath=str(ASSETS/'moradores-e-carroca.glb'),export_format='GLB',
                          export_yup=True,export_animations=False,
                          export_meshopt_compression_enable=True,export_meshopt_extension='EXT_meshopt_compression')

