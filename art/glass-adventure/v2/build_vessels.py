"""Author reference-led hollow glass and exact closed fractures without generation.

The first two silhouettes are hand authored from the approved image references.
Meshy donors, when available, remain separately attributed and cannot overwrite v1.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import random
import sys
import bmesh
import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('v2_geometry',HERE/'build_architecture.py')
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
k=a.k
OUT=a.OUT
TAU=math.tau


def surface_uv(obj,height,radius):
    data=obj.data
    for layer in list(data.uv_layers):data.uv_layers.remove(layer)
    uv=data.uv_layers.new(name='surface_uv')
    for face in data.polygons:
        coords=[data.vertices[data.loops[li].vertex_index].co + obj.location for li in face.loop_indices]
        angles=[(math.atan2(p.y,p.x)/TAU)%1 for p in coords]
        crossing=max(angles)-min(angles)>.5
        # Caps need real two-dimensional islands; exterior is seam-correct cylindrical UV.
        cut=max(angles)-min(angles)<1e-7
        for li,p,u in zip(face.loop_indices,coords,angles):
            if abs(face.normal.z)>.94:uv.data[li].uv=(p.x,p.y)
            elif cut:uv.data[li].uv=(math.hypot(p.x,p.y),p.z)
            else:uv.data[li].uv=((u+(1 if crossing and u<.5 else 0))*TAU*radius,p.z)


def lathe(name,profile,begin,end,steps,root,mat,flute=0,scallop=0,height=None):
    obj=k.lathe(name,profile,begin,end,steps,root,mat,flute)
    h=height or max(z for _,z in profile)
    if scallop:
        for v in obj.data.vertices:
            if v.co.z>h-.015:v.co.z+=scallop*math.cos(12*math.atan2(v.co.y,v.co.x))*((v.co.z-(h-.015))/.015)
        obj.data.update()
    surface_uv(obj,h,max(r for r,_ in profile))
    # Partial sector cap faces are new fracture surfaces, split normals from polished glass.
    obj.data.materials.append(k.MATS['glass_cut'])
    if end-begin<TAU-1e-8:
        for face in obj.data.polygons:
            if len(face.vertices)>4:face.material_index=1;face.use_smooth=False
    return obj


def radius_at(outer,z):
    for (r0,z0),(r1,z1) in zip(outer,outer[1:]):
        if z0<=z<=z1:return r0+(r1-r0)*(z-z0)/max(1e-8,z1-z0)
    return outer[-1][0]


def radial_leaf(name,outer,z0,theta,dz,dtheta,root,flute=0):
    verts=[];rows=7
    for back in (False,True):
        for j in range(rows+1):
            t=j/rows;half=.021*math.sin(math.pi*t)
            for side in (-1,0,1):
                angle=theta+dtheta*t+side*half
                z=z0+dz*t
                r=radius_at(outer,z)*(1+flute*math.cos(12*angle))+(.0007 if back else .0014)+(.001 if side==0 and not back else 0)*math.sin(math.pi*t)
                verts.append((r*math.cos(angle),r*math.sin(angle),z))
    n=(rows+1)*3;faces=[]
    for j in range(rows):
        for q in range(2):
            i=j*3+q;faces.extend([(i,i+1,i+4,i+3),(n+i,n+i+3,n+i+4,n+i+1)])
        for q in (0,2):
            i=j*3+q;faces.append((i,i+3,n+i+3,n+i))
    faces.extend([(0,n,n+1,n+2,2,1),(n-3,n-2,n-1,2*n-1,2*n-2,2*n-3)])
    obj=k.mesh(name,verts,faces,root,k.MATS['gold_trim'],True);a.stone_uv(obj);return obj


def build(name,outer,inner,regions,flute=0,scallop=0):
    profile=[(0,0)]+outer+inner
    root=k.parent(name,'vessels.glb');h=outer[-1][1];r=max(x for x,_ in outer)
    intact=lathe(name+'_intact',profile,0,TAU,72,root,k.MATS['glass_shell'],flute,scallop,h);intact['role']='intact'
    shards=[];lookup=[]
    for low,high,sectors in regions:
        for sector in range(sectors):
            clipped=k.clip_profile(profile,low,True) if low>0 else profile
            clipped=k.clip_profile(clipped,high,False) if high<h else clipped
            index=len(shards);begin=TAU*sector/sectors;end=TAU*(sector+1)/sectors
            shard=lathe(name+'_shard_%03d'%index,clipped,begin,end,72//sectors,root,k.MATS['glass_shell'],flute,scallop,h)
            shard['role']='shard';shard.hide_render=True;shards.append(shard);lookup.append((low,high,begin,end))
    def choose(z,angle):
        angle=angle%TAU
        return next((s for s,(lo,hi,begin,end) in zip(shards,lookup) if lo-1e-7<=z<=hi+1e-7 and begin<=angle<end),shards[-1])
    def add_gold(obj,z,angle):
        copy=obj.copy();copy.data=obj.data.copy();bpy.context.scene.collection.objects.link(copy);copy.parent=root
        k.join_into(intact,obj);k.join_into(choose(z,angle),copy)
    # Gilt lips are split along the same angular boundaries as the glass.
    for rim_z,rim_radius,wire in [(h,outer[-1][0],.0018),(.012,outer[0][0],.0018)]:
        ring_profile=[(rim_radius+wire*math.cos(TAU*j/6),rim_z+wire*math.sin(TAU*j/6)) for j in range(6)]
        for sector in range(12):
            begin=TAU*sector/12;end=TAU*(sector+1)/12
            obj=lathe(name+'_gilt_lip_'+str(rim_z)+'_'+str(sector),ring_profile,begin,end,6,root,k.MATS['gold_trim'],flute=flute,scallop=scallop if rim_z==h else 0,height=h)
            # Every surface of the gilding is metal, including the small cut caps.
            for face in obj.data.polygons:face.material_index=0
            add_gold(obj,min(h-1e-6,rim_z),begin+.001)
    # Reference-specific gold laurel sprays follow the bowl surface.
    if name=='goblet_laurel':zlo,zhi,sprays=.27,.465,2
    else:zlo,zhi,sprays=.24,.345,4
    for spray in range(sprays):
        base=-math.pi/2+TAU*spray/sprays
        points=[]
        for j in range(19):
            t=j/18;z=zlo+(zhi-zlo)*t;theta=base+.65*t;r0=radius_at(outer,z)*(1+flute*math.cos(12*theta))+.0014
            points.append((r0*math.cos(theta),r0*math.sin(theta),z))
        # Segment branches at each leaf level: ornament does not remain a whole floating vine after fracture.
        for j in range(0,18,3):
            branch=a.line(name+'_laurel_stem',points[j:j+4],.00095,root,'gold_trim',sides=6)
            mid=(j+1.5)/18;add_gold(branch,zlo+(zhi-zlo)*mid,base+.65*mid)
        for j in range(1,7):
            t=j/7;z=zlo+(zhi-zlo)*t;theta=base+.65*t
            for side in (-1,1):
                obj=radial_leaf(name+'_laurel_leaf',outer,z,theta,(zhi-zlo)*.12,side*.20,root,flute)
                add_gold(obj,z+(zhi-zlo)*.06,theta+side*.10)
    for shard in shards:k.center_geometry(shard)
    k.ASSETS[name].update({'role':'breakable','intact':intact.name,'shards':[s.name for s in shards],'persistent':[], 'wallThickness':.003 if name=='goblet_laurel' else .004,'construction':'Blender authored from image reference; no Meshy generation','reference':'references/laurel-goblet.png' if name=='goblet_laurel' else 'references/rose-bud-vase.png'})
    return root


def irregular_fracture(name):
    """Intersect the intact shell with seeded convex cells, preserving its surfaces."""
    record=k.ASSETS[name];root=k.GROUPS[name];intact=bpy.data.objects[record['intact']]
    # Triangulate the authored surface before cutting: fluted quad faces are not
    # perfectly planar. Boolean-clipping an untriangulated warped quad can form
    # overlapping cut ngons even when its edge connectivity initially looks closed.
    surface=bmesh.new();surface.from_mesh(intact.data)
    bmesh.ops.triangulate(surface,faces=list(surface.faces))
    if any(not edge.is_manifold for edge in surface.edges):raise ValueError(name+' input triangulation is not closed')
    surface.to_mesh(intact.data);surface.free()
    rng=random.Random(20260915 if name=='goblet_laurel' else 20260916)
    seeds=[]
    if name=='goblet_laurel':
        for i in range(4):
            theta=TAU*i/4+.2;seeds.append(Vector((.054*math.cos(theta),.054*math.sin(theta),.013)))
        seeds.extend([Vector((.004,-.002,.082)),Vector((-.003,.003,.15)),Vector((.003,.002,.222))])
        rings=[(7,.325,.105),(9,.478,.13)]
    else:rings=[(7,.10,.13),(9,.255,.145),(7,.40,.072)]
    for count,z,r in rings:
        phase=rng.uniform(0,TAU)
        for i in range(count):
            theta=phase+TAU*i/count+rng.uniform(-.10,.10)
            seeds.append(Vector((r*math.cos(theta),r*math.sin(theta),z+rng.uniform(-.030,.030))))
    coords=[v.co for v in intact.data.vertices]
    lo=Vector(tuple(min(v[j] for v in coords)-.04 for j in range(3)))
    hi=Vector(tuple(max(v[j] for v in coords)+.04 for j in range(3)))
    # Intersect disconnected gilt components independently. Joining/coincident caps
    # before a self-intersection Boolean creates false nonmanifold rim junctions.
    source=intact.copy();source.data=intact.data.copy();bpy.context.scene.collection.objects.link(source);source.parent=root
    before=set(bpy.data.objects);k.select_only([source]);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
    components=[source]+[obj for obj in bpy.data.objects if obj not in before]
    replacements=[]
    for index,seed in enumerate(seeds):
        planes=[((other+seed)/2,(other-seed).normalized()) for other in seeds if other is not seed]
        bm=bmesh.new();bmesh.ops.create_cube(bm,size=1)
        for v in bm.verts:v.co=Vector(tuple(lo[j]+(v.co[j]+.5)*(hi[j]-lo[j]) for j in range(3)))
        for middle,normal in planes:
            result=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=middle,plane_no=normal,clear_outer=True,clear_inner=False)
            edges=[edge for edge in result['geom_cut'] if isinstance(edge,bmesh.types.BMEdge) and edge.is_boundary]
            if edges:bmesh.ops.holes_fill(bm,edges=edges,sides=0)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        data=bpy.data.meshes.new('fracture_cell');bm.to_mesh(data);bm.free()
        cell=bpy.data.objects.new('fracture_cell',data);bpy.context.scene.collection.objects.link(cell);cell.data.materials.append(k.MATS['glass_cut']);a.stone_uv(cell)
        pieces=[]
        for component in components:
            vertices=[v.co for v in component.data.vertices];inside=True;outside=False
            for middle,normal in planes:
                distances=[(v-middle).dot(normal) for v in vertices]
                if min(distances)>1e-7:outside=True;break
                if max(distances)>1e-7:inside=False
            if outside:continue
            piece=component.copy();piece.data=component.data.copy();bpy.context.scene.collection.objects.link(piece);piece.parent=root
            if not inside:
                k.select_only([piece]);modifier=piece.modifiers.new('authored_cell','BOOLEAN');modifier.operation='INTERSECT';modifier.solver='EXACT';modifier.object=cell
                if hasattr(modifier,'use_hole_tolerant'):modifier.use_hole_tolerant=True
                if hasattr(modifier,'material_mode'):modifier.material_mode='TRANSFER'
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            if not piece.data.polygons:bpy.data.objects.remove(piece,do_unlink=True);continue
            gold=all(component.data.materials[f.material_index].name=='gold_trim' for f in component.data.polygons)
            for face in piece.data.polygons:
                if piece.data.materials[face.material_index].name=='glass_cut':
                    face.use_smooth=False
                    if gold:
                        slot=next((i for i,mat in enumerate(piece.data.materials) if mat.name=='gold_trim'),None)
                        if slot is None:piece.data.materials.append(k.MATS['gold_trim']);slot=len(piece.data.materials)-1
                        face.material_index=slot
            check=bmesh.new();check.from_mesh(piece.data)
            bmesh.ops.remove_doubles(check,verts=list(check.verts),dist=1e-7)
            wires=[edge for edge in check.edges if not edge.link_faces]
            if wires:bmesh.ops.delete(check,geom=wires,context='EDGES')
            bmesh.ops.recalc_face_normals(check,faces=list(check.faces))
            bad=sum(not edge.is_manifold for edge in check.edges)
            check.to_mesh(piece.data);check.free()
            if bad:raise ValueError(f'{name} cell {index}, component {component.name}: {bad} nonmanifold edges')
            pieces.append(piece)
        bpy.data.objects.remove(cell,do_unlink=True)
        if not pieces:continue
        shard=pieces[0]
        for piece in pieces[1:]:k.join_into(shard,piece)
        k.center_geometry(shard);shard['role']='shard';shard.hide_render=True;replacements.append(shard)
    for component in components:bpy.data.objects.remove(component,do_unlink=True)
    for old in record['shards']:bpy.data.objects.remove(bpy.data.objects[old],do_unlink=True)
    for index,shard in enumerate(replacements):shard.name=name+'_shard_%03d'%index
    record['shards']=[shard.name for shard in replacements]
    record['fracture']='Seeded convex Voronoi cells intersected with actual intact glass and gilt geometry; closed cut faces'


def init():
    k.material('glass_shell',(.94,.99,.985),rough=.025,transmission=.98)
    k.material('glass_cut',(.83,.98,.97),rough=.14,transmission=.88)
    k.material('gold_trim',(.76,.50,.17),metal=.95,rough=.20)
    k.MATS['museum_brass']=k.MATS['gold_trim']


def export():
    for obj in bpy.data.objects:
        if obj.type!='MESH':continue
        bm=bmesh.new();bm.from_mesh(obj.data)
        bmesh.ops.triangulate(bm,faces=list(bm.faces))
        after=sum(not e.is_manifold for e in bm.edges)
        if after:raise ValueError(f'{obj.name}: triangulation produced {after} nonmanifold edges')
        bm.to_mesh(obj.data);bm.free()
    k.inspect_assets()
    for root in k.GROUPS.values():
        for obj in root.children:
            if obj.type=='MESH':
                bm=bmesh.new();bm.from_mesh(obj.data)
                nonmanifold=sum(not edge.is_manifold for edge in bm.edges);bm.free()
                if nonmanifold:raise ValueError(f'{obj.name}: {nonmanifold} nonmanifold edges')
    k.select_only([obj for root in k.GROUPS.values() for obj in [root,*root.children]])
    OUT.mkdir(parents=True,exist_ok=True);(HERE/'models').mkdir(exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/'vessels.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_animations=False,export_tangents=True)
    raw=(OUT/'vessels.glb').read_bytes()
    report={'version':2,'units':'metres','up':'+Y','front':'+Z','uvMetresPerRepeat':1,'assets':k.ASSETS,'bundle':{'name':'vessels.glb','bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()},'source':'build_vessels.py','status':'glass-geometry-review; Meshy ornament donors pending authentication'}
    (HERE/'vessels-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'models/vessels.blend'))
    print('V2_VESSELS='+json.dumps({'bytes':len(raw),'assets':list(k.ASSETS)}))


def preview():
    for root in k.GROUPS.values():
        root.hide_render=True
        for obj in root.children:obj.hide_render=True
    for name,pos in [('goblet_laurel',(-.23,0,0)),('vase_rounded',(.23,0,0))]:
        root=k.GROUPS[name];root.hide_render=False;root.location=pos
        for obj in root.children:obj.hide_render=obj.get('role')=='shard'
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
    scene.cycles.transmission_bounces=12;scene.cycles.transparent_max_bounces=12
    scene.render.resolution_x=1400;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('glass_review_world');scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.025,.032,.042,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.5
    k.material('review_floor',(.035,.046,.054),rough=.34)
    floor=k.cube('review_floor',(200,200,.02),(0,0,-.023),None,k.MATS['review_floor'])
    for name,pos,power,size,color in [('key',(-1,-1,2),130,1.4,(1,.89,.70)),('fill',(1,-.4,.8),85,1.2,(.7,.89,1)),('rim',(0,1,1.4),180,.7,(1,.92,.78))]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='RECTANGLE';data.size=size;data.size_y=.20;data.color=color
        obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=(Vector((0,0,.25))-obj.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(.75,-1.5,.76));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.27))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.04;scene.camera=cam
    scene.view_settings.view_transform='AgX';scene.render.filepath=str(HERE/'vessels-review.png');bpy.ops.render.render(write_still=True)
    # A separate expanded-pieces render is proof of surface-coherent closed fragments.
    for name in ['goblet_laurel','vase_rounded']:
        root=k.GROUPS[name]
        for obj in root.children:
            if obj.get('role')=='shard':
                obj.hide_render=False;obj.location.x*=1.45;obj.location.y*=1.45;obj.location.z=(obj.location.z-.24)*1.15+.24
            else:obj.hide_render=True
    scene.render.filepath=str(HERE/'fractures-review.png');bpy.ops.render.render(write_still=True)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--render',action='store_true');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0;bpy.context.scene.unit_settings.system='METRIC';init()
    goblet=[(.092,0),(.099,.008),(.095,.014),(.070,.020),(.038,.035),(.018,.053),(.011,.075),(.009,.18),(.016,.21),(.021,.226),(.029,.234),(.052,.247),(.078,.27),(.105,.302),(.124,.345),(.136,.398),(.139,.445),(.134,.49),(.126,.535)]
    inner=[(r-.003,z) for r,z in reversed(goblet[10:])]+[(0,.237)]
    build('goblet_laurel',goblet,inner,[(0,.055,4),(.055,.235,3),(.235,.535,12)])
    vase=[(.061,0),(.075,.012),(.079,.028),(.098,.052),(.133,.10),(.157,.17),(.155,.235),(.132,.29),(.091,.33),(.067,.365),(.066,.402),(.075,.433),(.087,.45)]
    inner=[(r-.004,max(.012,z)) for r,z in reversed(vase[1:])]+[(0,.012)]
    build('vase_rounded',vase,inner,[(0,.22,8),(.22,.45,8)],flute=.035,scallop=.004)
    # Keep legacy variant coverage until the corresponding new Meshy donors pass review.
    for name,outer,flute in [('vase_fluted',[(.07,0),(.105,.045),(.125,.14),(.112,.24),(.072,.34),(.042,.40),(.038,.58),(.052,.665),(.057,.69)],.045),('vase_amphora',[(.10,0),(.145,.06),(.197,.18),(.19,.30),(.145,.40),(.085,.455),(.078,.50),(.095,.55)],.018)]:
        k.vessel(name,outer,k.MATS['glass_shell'],flute=flute)
        k.ASSETS[name]['construction']='v1 Blender silhouette retained; UVs and material slots corrected; new reference donor pending'
        for obj in k.GROUPS[name].children:
            if obj.type=='MESH':surface_uv(obj,max(z for _,z in outer),max(r for r,_ in outer))
    for name in ['goblet_laurel','vase_rounded']:irregular_fracture(name)
    export()
    if args.render:preview()

if __name__=='__main__':main()
