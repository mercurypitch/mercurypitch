"""Build dimensioned v2 museum architecture in an isolated Blender process.

Uses v1 geometric primitives as a library; every output is redirected to v2.
No interactive scene, v1 source scene or original export is loaded or overwritten.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import sys
import bmesh
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / 'apps/beside-cue/public/games/adventure-v2'
SPEC = importlib.util.spec_from_file_location('museum_primitives', HERE.parent / 'build_assets.py')
k = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(k)
k.OUT = OUT
k.HERE = HERE
TAU = math.tau


def stone_uv(obj, tile=1.0):
    """Dominant-axis metre UVs, independent of cube atlases and object scaling."""
    data = obj.data
    for layer in list(data.uv_layers):
        data.uv_layers.remove(layer)
    layer = data.uv_layers.new(name='surface_uv')
    for polygon in data.polygons:
        axis = max(range(3), key=lambda i: abs(polygon.normal[i]))
        axes = [(1, 2), (0, 2), (0, 1)][axis]
        for li in polygon.loop_indices:
            p = obj.matrix_local @ data.vertices[data.loops[li].vertex_index].co
            layer.data[li].uv = (p[axes[0]] / tile, p[axes[1]] / tile)
    data.uv_layers.active_index = 0


def cylindrical_uv(obj, radius, height):
    """Duplicate the angular seam per face; map horizontal caps separately."""
    data = obj.data
    for layer in list(data.uv_layers):
        data.uv_layers.remove(layer)
    layer = data.uv_layers.new(name='surface_uv')
    for poly in data.polygons:
        pts = [data.vertices[data.loops[i].vertex_index].co for i in poly.loop_indices]
        us = [(math.atan2(p.y, p.x) / TAU) % 1 for p in pts]
        crossing = max(us) - min(us) > .5
        for li, p, u in zip(poly.loop_indices, pts, us):
            if abs(poly.normal.z) > .85:
                layer.data[li].uv = (p.x, p.y)
            else:
                layer.data[li].uv = ((u + (1 if crossing and u < .5 else 0)) * TAU * radius, p.z)


def box(name, dims, pos, owner, mat='museum_limestone', bevel=.015):
    obj = k.cube(name, dims, pos, owner, k.MATS[mat])
    if bevel:
        # A single chamfer retains the lit edge; a second hidden fillet ring was
        # multiplied across every cornice, plinth and underside pier.
        modifier = obj.modifiers.new('authored_chamfer', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 1
        k.select_only([obj])
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    stone_uv(obj)
    return obj


def line(name, points, radius, owner, mat='museum_brass', closed=False, sides=4):
    obj = k.tube(name, points, radius, owner, k.MATS[mat], sides=sides, closed=closed)
    stone_uv(obj)
    return obj


def circle(name, radius, z, owner, mat='museum_brass', wire=.009):
    steps = 20 if radius < .3 else 32
    return line(name, [(radius * math.cos(TAU*i/steps), radius * math.sin(TAU*i/steps), z) for i in range(steps)], wire, owner, mat, True)


def leaf(name, origin, yaw, length, width, owner, mat='museum_ivory'):
    """Closed curved acanthus leaf with a raised central ridge, not a card."""
    verts=[]
    rows=6
    for back in (False, True):
        for i in range(rows+1):
            t=i/rows
            w=width * math.sin(math.pi*t)**.7 + .001
            for side in (-1,0,1):
                x=side*w
                y=.045*math.sin(math.pi*t) + .10*t*t - (.012 if back else 0) + (0 if side else .018*math.sin(math.pi*t))
                z=length*t
                verts.append((origin[0]+x*math.cos(yaw)-y*math.sin(yaw),origin[1]+x*math.sin(yaw)+y*math.cos(yaw),origin[2]+z))
    offset=(rows+1)*3
    faces=[]
    for side in range(2):
        for i in range(rows):
            a=3*i+side;b=a+3
            faces.extend([(a,a+1,b+1,b),(offset+a,offset+b,offset+b+1,offset+a+1)])
    for edge in (0,2):
        for i in range(rows):
            a=3*i+edge;b=a+3
            faces.append((a,b,offset+b,offset+a))
    faces.extend([(0,offset,offset+1,offset+2,2,1),(rows*3,rows*3+1,rows*3+2,offset+rows*3+2,offset+rows*3+1,offset+rows*3)])
    obj=k.mesh(name,verts,faces,owner,k.MATS[mat],True);stone_uv(obj);return obj


def column_parts(owner, prefix, at=(0,0,0), height=2.18):
    made=[]
    def save(obj):made.append(obj);return obj
    save(box(prefix+'_base',( .43,.43,.09),(0,0,.045),owner))
    save(box(prefix+'_base_step',(.35,.35,.065),(0,0,.1225),owner,bevel=.018))
    profile=[(0,.155),(.168,.155),(.168,.19),(.126,.24),(.112,.30),(.106,1.82),(.125,1.90),(.163,1.94),(.17,2.0),(0,2.0)]
    shaft=save(k.lathe(prefix+'_fluted_shaft',profile,0,TAU,48,owner,k.MATS['museum_limestone'],flute=.065))
    cylindrical_uv(shaft,.12,2.18)
    save(box(prefix+'_capital',(.40,.40,.085),(0,0,2.11),owner,bevel=.018))
    save(box(prefix+'_abacus',(.46,.46,.045),(0,0,2.1625),owner,bevel=.012))
    for j,(r,z) in enumerate([(.17,.18),(.124,.255),(.119,.3),(.128,1.90),(.176,1.995)]):save(circle(prefix+'_bead_'+str(j),r,z,owner,wire=.009))
    for i in range(8):
        a=TAU*i/8
        save(leaf(prefix+'_capital_leaf_'+str(i),(.115*math.cos(a),.115*math.sin(a),1.87),a-math.pi/2,.21,.047,owner))
    for obj in made:
        obj.scale *= height/2.18
        obj.location = Vector(at) + obj.location * (height/2.18)
    return made


def arch_parts(owner,prefix,width=1.1,rise=.5,spring=.38,depth=.22,origin=(0,0,0),yaw=0):
    made=[];segments=9 if rise < .5 else 13
    for i in range(segments):
        a=math.pi*i/segments+.006;b=math.pi*(i+1)/segments-.006
        inner=width/2;outer=inner+.13
        verts=[]
        for y in (-depth/2,depth/2):
            for r,h,t in [(inner,rise,a),(inner,rise,b),(outer,rise+.14,b),(outer,rise+.14,a)]:
                verts.append((r*math.cos(t),y,spring+h*math.sin(t)))
        obj=k.mesh(prefix+'_voussoir_'+str(i),verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],owner,k.MATS['museum_limestone'])
        stone_uv(obj);made.append(obj)
    for side in (-1,1):
        made.append(box(prefix+'_pier_'+str(side),(.16,depth+.05,spring+.025),(side*(width/2+.07),0,spring/2),owner))
        made.append(box(prefix+'_foot_'+str(side),(.24,depth+.10,.065),(side*(width/2+.07),0,.0325),owner,'museum_ivory'))
    for y in (-depth/2-.005,depth/2+.005):
        samples = 12 if rise < .5 else 20
        points=[((width/2+.02)*math.cos(math.pi*i/samples),y,spring+(rise+.02)*math.sin(math.pi*i/samples)) for i in range(samples+1)]
        made.append(line(prefix+'_arch_bead_'+str(y),points,.009,owner))
    made.append(box(prefix+'_key',(.105,depth+.04,.18),(0,0,spring+rise+.105),owner,'museum_brass',.012))
    for obj in made:
        pos=obj.location.copy()
        obj.rotation_euler.z=yaw
        obj.location=(origin[0]+pos.x*math.cos(yaw)-pos.y*math.sin(yaw),origin[1]+pos.x*math.sin(yaw)+pos.y*math.cos(yaw),origin[2]+pos.z)
    return made


def platform(name,w,d,kind='flat'):
    root=k.parent(name,'platform-kit.glb',{'shape':'box','width':w,'depth':d,'height':.22,'topY':0})
    box(name+'_floor',(w,d,.085),(0,0,-.0425),root,'museum_ivory',bevel=.026)
    for i,(inset,thick,z,mat) in enumerate([(.025,.055,-.110,'museum_limestone'),(.055,.10,-.185,'museum_limestone'),(.10,.065,-.265,'museum_limestone'),(.03,.018,-.08,'museum_brass')]):
        box(name+'_cornice_'+str(i),(w-2*inset,d-2*inset,thick),(0,0,z),root,mat,.018 if mat!='museum_brass' else .007)
    # Continuous planar surface remains exactly inside the existing collider.
    outer=[(-w/2+.09,-d/2+.09,.002),(w/2-.09,-d/2+.09,.002),(w/2-.09,d/2-.09,.002),(-w/2+.09,d/2-.09,.002)]
    inner=[(-w/2+.145,-d/2+.145,.002),(w/2-.145,-d/2+.145,.002),(w/2-.145,d/2-.145,.002),(-w/2+.145,d/2-.145,.002)]
    obj=k.mesh(name+'_teal_border',outer+inner,[(i,(i+1)%4,(i+1)%4+4,i+4) for i in range(4)],root,k.MATS['museum_petrol'])
    stone_uv(obj)
    # A marble marquetry rosette is geometry, so teal and gold remain separate surfaces.
    if min(w,d) >= 1.3:
        radius=min(w,d)*.19
        for petal in range(8):
            a=TAU*petal/8
            boundary=[]
            for step in range(25):
                t=TAU*step/24
                r=radius*(.60+.40*math.cos(t))
                tang=radius*.12*math.sin(t)
                boundary.append((r*math.cos(a)-tang*math.sin(a),r*math.sin(a)+tang*math.cos(a),.002))
            obj=k.mesh(name+'_inlaid_petal_'+str(petal),boundary[:-1],[tuple(range(24))],root,k.MATS['museum_petrol'])
            stone_uv(obj)
            line(name+'_inlay_petal_gilt_'+str(petal),boundary[:-1],.0025,root,closed=True)
        circle(name+'_inlay_centre',radius*.15,.004,root,wire=.005)
    # Real masonry silhouette, confined below the course surface.
    for axis,span,other in [('x',w,d),('y',d,w)]:
        count=max(1,round(span/1.1));bay=span/count
        for side in (-1,1):
            for j in range(count):
                pos=-span/2+bay*(j+.5)
                at=(pos,side*(other/2-.14),-.95) if axis=='x' else (side*(other/2-.14),pos,-.95)
                arch_parts(root,name+'_arcade_'+axis+str(side)+'_'+str(j),width=max(.3,bay-.28),rise=.30,spring=.22,depth=.18,origin=at,yaw=0 if axis=='x' else math.pi/2)
    box(name+'_underside_tray',(max(.3,w-.34),max(.3,d-.34),.09),(0,0,-1.015),root,bevel=.035)
    # Light floral border relief stays below the floor, never within the walking plane.
    if w>=2 and d>=2:
        for side in (-1,1):
            for i in range(9):
                x=-w*.38+i*w*.095
                leaf(name+'_fascia_leaf_'+str(side)+'_'+str(i),(x,side*(d/2-.042),-.29),0 if side>0 else math.pi,.15,.045,root,'museum_brass')
    if kind=='moving':circle(name+'_levitation',min(w,d)*.37,-1.07,root,'museum_brass',.017)
    return root


def architecture():
    for name,w,d,kind in [('platform_terrace',3.3,3.3,'flat'),('platform_island',1.375,1.375,'flat'),('platform_ledge',.77,2.2,'flat'),('platform_bridge',1.1,3.3,'bridge'),('platform_plinth',1.375,1.375,'moving')]:platform(name,w,d,kind)
    col=k.parent('museum_column','platform-kit.glb');column_parts(col,'museum_column')
    arch=k.parent('museum_arch','platform-kit.glb');arch_parts(arch,'museum_arch',width=1.65,rise=.80,spring=1.28,depth=.30)
    bay=k.parent('museum_arcade_bay','platform-kit.glb');arch_parts(bay,'museum_arcade_bay',width=.82,rise=.34,spring=.32,depth=.26)
    bal=k.parent('museum_balustrade','platform-kit.glb')
    box('balustrade_rail',(1.10,.16,.075),(0,0,.43),bal,bevel=.015)
    box('balustrade_sill',(1.10,.19,.06),(0,0,.03),bal,bevel=.012)
    for i in range(7):
        x=-.46+i*.1533
        profile=[(0,.06),(.035,.06),(.042,.08),(.026,.11),(.041,.20),(.038,.26),(.02,.33),(.035,.39),(0,.39)]
        obj=k.lathe('baluster_'+str(i),profile,0,TAU,20,bal,k.MATS['museum_ivory']);obj.location.x=x;cylindrical_uv(obj,.04,.39)
    rot=k.parent('museum_rotunda','platform-kit.glb')
    for i in range(8):
        a=TAU*i/8;column_parts(rot,'rotunda_column_'+str(i),(1.2*math.cos(a),1.2*math.sin(a),0),1.85)
    for z,r in [(1.91,1.25),(2.05,1.23)]:circle('rotunda_cornice_'+str(z),r,z,rot,'museum_ivory',.07)
    for i in range(12):
        a=TAU*i/12
        points=[(1.23*math.cos(a)*math.cos(math.pi*t/2),1.23*math.sin(a)*math.cos(math.pi*t/2),2.08+.72*math.sin(math.pi*t/2)) for t in [j/16 for j in range(17)]]
        line('rotunda_roof_rib_'+str(i),points,.014,rot,'museum_brass')
    for t in (.28,.55,.78):circle('rotunda_roof_ring_'+str(t),1.23*math.cos(math.pi*t/2),2.08+.72*math.sin(math.pi*t/2),rot,'museum_brass',.009)
    # Reference calls for an open gold-rib canopy; no glass roof surface.


def init_materials():
    for name,color,metal,rough in [('museum_ivory',(.86,.84,.78),0,.23),('museum_limestone',(.78,.72,.61),0,.38),('museum_brass',(.71,.45,.15),.92,.23),('museum_petrol',(.025,.18,.19),.12,.20),('museum_obsidian',(.05,.065,.07),.05,.28),('museum_cyan',(.05,.5,.5),.1,.22)]:k.material(name,color,metal,rough)
    k.material('museum_glass',(.86,.98,.95),rough=.035,transmission=.92)


def export():
    OUT.mkdir(parents=True,exist_ok=True);(HERE/'models').mkdir(exist_ok=True)
    # Batch by material within each authored assembly; retain catalogue parent names.
    k.batch_ornaments()
    for obj in bpy.data.objects:
        if obj.type != "MESH": continue
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    for obj in bpy.data.objects:
        if obj.type=='MESH' and not obj.data.uv_layers:stone_uv(obj)
    for record in k.ASSETS.values():
        record["role"] = "platform" if "collider" in record else "non-colliding-ornament"
    k.inspect_assets()
    objects=[obj for root in k.GROUPS.values() for obj in [root,*root.children]]
    k.select_only(objects)
    bpy.ops.export_scene.gltf(filepath=str(OUT/'platform-kit.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_animations=False,export_tangents=True)
    payload=(OUT/'platform-kit.glb').read_bytes()
    doc={'version':2,'units':'metres','up':'+Y','front':'+Z','source':'art/glass-adventure/v2/build_architecture.py','assets':k.ASSETS,'bundles':{'platform-kit.glb':{'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest()}},'materials':'scalar named slots; external shared PBR textures bound by runtime','uvMetresPerRepeat':1,'status':'geometry-review'}
    (HERE/'architecture-manifest.json').write_text(json.dumps(doc,indent=2)+'\n')
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'models/museum-kit.blend'))
    print('V2_ARCHITECTURE='+json.dumps({'bytes':len(payload),'assets':list(k.ASSETS)}))


def preview():
    # Review only; .blend was saved before objects are rearranged.
    for root in k.GROUPS.values():root.hide_render=True;[setattr(o,'hide_render',True) for o in root.children]
    for name,pos in [('platform_terrace',(0,0,0)),('museum_column',(-1.35,1.3,0)),('museum_arch',(.25,1.3,0))]:
        root=k.GROUPS[name];root.hide_render=False;root.location=pos
        for o in root.children:o.hide_render=False
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
    scene.render.resolution_x=1400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('review_world');scene.world.color=(.24,.28,.32)
    for name,pos,power,size,color in [('key',(1,-3,6),850,5,(1,.87,.65)),('fill',(-4,-1,3),600,5,(.65,.82,1)),('rim',(2,4,4),1000,3,(1,.92,.72))]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
        obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(4.8,-6,4.5));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.50))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=6.8;scene.camera=cam
    scene.view_settings.view_transform='AgX';scene.render.film_transparent=False
    scene.render.filepath=str(HERE/'architecture-review.png');bpy.ops.render.render(write_still=True)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--render',action='store_true');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.save_version=0;bpy.context.scene.unit_settings.system='METRIC'
    init_materials();architecture();export()
    if args.render:preview()

if __name__=='__main__':main()
