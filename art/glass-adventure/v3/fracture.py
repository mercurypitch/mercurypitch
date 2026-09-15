"""Cut actual imported surfaces into closed Voronoi fragments without replacing their form.

Adapted from the validated v2 cutter. This module authors only cut caps and
fragment transforms; it never builds vessel silhouettes or ornament geometry.
"""
import random
import bmesh
import bpy
from mathutils import Vector


def select_only(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]


def join_into(target, other):
    select_only([target,other]);bpy.context.view_layer.objects.active=target
    bpy.ops.object.join()


def center_geometry(obj):
    centre=sum((vertex.co for vertex in obj.data.vertices),Vector())/len(obj.data.vertices)
    for vertex in obj.data.vertices:vertex.co-=centre
    obj.location+=centre


def planar_uv(obj):
    layer=obj.data.uv_layers.new(name='cut_uv')
    for face in obj.data.polygons:
        axis=max(range(3),key=lambda i:abs(face.normal[i]));axes=[(1,2),(0,2),(0,1)][axis]
        for index in face.loop_indices:
            point=obj.data.vertices[obj.data.loops[index].vertex_index].co
            layer.data[index].uv=(point[axes[0]],point[axes[1]])


def surface_seeds(intact,count=23,seed=20260915):
    """Deterministic farthest-point coverage follows the donor's actual surface."""
    if not 12<=count<=24:raise ValueError('Use twelve to twenty-four fracture assemblies')
    rng=random.Random(seed)
    candidates=[vertex.co.copy() for vertex in intact.data.vertices]
    if len(candidates)>1200:candidates=rng.sample(candidates,1200)
    chosen=[candidates.pop(rng.randrange(len(candidates)))]
    distances=[(point-chosen[0]).length_squared for point in candidates]
    while len(chosen)<count and candidates:
        index=max(range(len(candidates)),key=lambda i:distances[i])
        chosen.append(candidates.pop(index));distances.pop(index)
        distances=[min(distance,(point-chosen[-1]).length_squared) for point,distance in zip(candidates,distances)]
    return chosen


def fracture(intact, root, seeds, materials, self_intersections=False):
    """Intersect the intact shell with seeded convex cells, preserving its surfaces."""
    name=root.name
    # Triangulate the authored surface before cutting: fluted quad faces are not
    # perfectly planar. Boolean-clipping an untriangulated warped quad can form
    # overlapping cut ngons even when its edge connectivity initially looks closed.
    surface=bmesh.new();surface.from_mesh(intact.data)
    bmesh.ops.triangulate(surface,faces=list(surface.faces))
    if any(not edge.is_manifold for edge in surface.edges):raise ValueError(name+' input triangulation is not closed')
    surface.to_mesh(intact.data);surface.free()
    coords=[v.co for v in intact.data.vertices]
    lo=Vector(tuple(min(v[j] for v in coords)-.04 for j in range(3)))
    hi=Vector(tuple(max(v[j] for v in coords)+.04 for j in range(3)))
    # Intersect disconnected gilt components independently. Joining/coincident caps
    # before a self-intersection Boolean creates false nonmanifold rim junctions.
    source=intact.copy();source.data=intact.data.copy();bpy.context.scene.collection.objects.link(source);source.parent=root
    before=set(bpy.data.objects);select_only([source]);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
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
        cell=bpy.data.objects.new('fracture_cell',data);bpy.context.scene.collection.objects.link(cell);cell.data.materials.append(materials['glass_cut']);planar_uv(cell)
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
                select_only([piece]);modifier=piece.modifiers.new('authored_cell','BOOLEAN');modifier.operation='INTERSECT';modifier.solver='EXACT';modifier.object=cell
                if hasattr(modifier,'use_hole_tolerant'):modifier.use_hole_tolerant=True
                if hasattr(modifier,'use_self'):modifier.use_self=self_intersections
                if hasattr(modifier,'material_mode'):modifier.material_mode='TRANSFER'
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            if not piece.data.polygons:bpy.data.objects.remove(piece,do_unlink=True);continue
            gold=all(component.data.materials[f.material_index].name=='gold_trim' for f in component.data.polygons)
            for face in piece.data.polygons:
                if piece.data.materials[face.material_index].name=='glass_cut':
                    face.use_smooth=False
                    if gold:
                        slot=next((i for i,mat in enumerate(piece.data.materials) if mat.name=='gold_trim'),None)
                        if slot is None:piece.data.materials.append(materials['gold_trim']);slot=len(piece.data.materials)-1
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
        for piece in pieces[1:]:join_into(shard,piece)
        center_geometry(shard);shard['role']='shard';shard.hide_render=True;replacements.append(shard)
    for component in components:bpy.data.objects.remove(component,do_unlink=True)
    for index,shard in enumerate(replacements):shard.name=name+'_shard_%03d'%index
    return replacements
