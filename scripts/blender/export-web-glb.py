# Blender model -> web GLB and thumbnail for the studio's "모델 등록" (the source .blend is opened, never saved).
#   "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" -b --factory-startup model.blend \
#     --python scripts/blender/export-web-glb.py -- model.glb thumbnail.png
# Leaves out Studio/Reference collections, turns curves and text into meshes, keeps colours glTF can carry
# (noise ramps -> one colour, generated-coordinate ramps -> vertex colours, clear glass -> faint alpha),
# drops bump and UVs, lowers geometry to about 40,000 vertices and renders a 640x480 thumbnail.

import bpy, json, sys

glb_path, png_path = sys.argv[sys.argv.index("--") + 1:][:2]
MODEL_TYPES = {"MESH", "CURVE", "FONT", "SURFACE", "META"}

# cabin.blend keeps an old scene next to the model; keep the scene with the most model objects.
scenes = sorted(bpy.data.scenes, key=lambda s: sum(o.type in MODEL_TYPES for o in s.objects), reverse=True)
scene = scenes[0]
for other in scenes[1:]:
    bpy.data.scenes.remove(other)
view_layer = scene.view_layers[0]

def excluded(ob):
    names = " ".join(c.name.lower() for c in ob.users_collection)
    return "studio" in names or "reference" in names

model = [o for o in scene.objects if o.type in MODEL_TYPES and o.visible_get() and not o.hide_render and not excluded(o)]

# Lighter geometry for the web: one subdivision step less and coarser curves and text.
for o in model:
    for m in o.modifiers:
        if m.type == "SUBSURF":
            m.levels = max(0, m.levels - 1)
            m.render_levels = m.levels
    if o.type in {"CURVE", "FONT"}:
        o.data.resolution_u = min(o.data.resolution_u, 4)
        o.data.bevel_resolution = min(o.data.bevel_resolution, 1)

# Curves and text become meshes so every surface can carry colours into the file.
bpy.ops.object.select_all(action="DESELECT")
to_convert = [o for o in model if o.type != "MESH"]
for o in to_convert:
    o.select_set(True)
if to_convert:
    view_layer.objects.active = to_convert[0]
    bpy.ops.object.convert(target="MESH")
model = [o for o in scene.objects if o.type == "MESH" and o.visible_get() and not o.hide_render and not excluded(o)]

# Materials: glTF keeps constant colours and colour attributes, not procedural nodes.
gradients = {}
summary = {"constant": 0, "noise_to_constant": 0, "gradient_to_vertex": 0, "vertex": 0, "bump_removed": 0}
used = {s.material for o in model for s in o.material_slots if s.material}
for mat in used:
    if not mat.use_nodes:
        continue
    tree = mat.node_tree
    for bsdf in [n for n in tree.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled"]:
        transmission = bsdf.inputs["Transmission Weight"]
        if not transmission.is_linked and transmission.default_value >= 0.5:
            # glTF viewers skip refraction, so clear glass becomes a faint see-through layer, not an opaque disc.
            transmission.default_value = 0
            bsdf.inputs["Alpha"].default_value = 0.12
            mat.surface_render_method = "BLENDED"
            summary["glass_to_alpha"] = summary.get("glass_to_alpha", 0) + 1
        normal = bsdf.inputs["Normal"]
        if normal.is_linked:
            tree.links.remove(normal.links[0]); summary["bump_removed"] += 1
        base = bsdf.inputs["Base Color"]
        if not base.is_linked:
            summary["constant"] += 1; continue
        source = base.links[0].from_node
        if source.bl_idname == "ShaderNodeVertexColor":
            summary["vertex"] += 1; continue
        if source.bl_idname == "ShaderNodeValToRGB":
            fac = source.inputs[0]
            feed = fac.links[0].from_node if fac.is_linked else None
            coord = feed.inputs[0].links[0] if feed and feed.bl_idname == "ShaderNodeSeparateXYZ" and feed.inputs[0].is_linked else None
            if coord and coord.from_node.bl_idname == "ShaderNodeTexCoord" and coord.from_socket.name == "Generated":
                axis = "XYZ".index(fac.links[0].from_socket.name)
                gradients[mat.name] = (axis, source.color_ramp)
                attr = tree.nodes.new("ShaderNodeVertexColor"); attr.layer_name = "otb_gradient"
                tree.links.remove(base.links[0]); tree.links.new(attr.outputs["Color"], base)
                summary["gradient_to_vertex"] += 1; continue
            colour = source.color_ramp.evaluate(0.5)
            tree.links.remove(base.links[0]); base.default_value = colour
            summary["noise_to_constant"] += 1; continue
        raise RuntimeError(f"{mat.name}: unexpected base colour source {source.bl_idname}")

# Gradients over generated (texture space) coordinates, baked per face corner.
for ob in model:
    slots = {i: gradients[s.material.name] for i, s in enumerate(ob.material_slots) if s.material and s.material.name in gradients}
    if not slots:
        continue
    mesh = ob.data
    if mesh.users > 1:
        ob.data = mesh = mesh.copy()
    loc, size = mesh.texspace_location, mesh.texspace_size
    layer = mesh.color_attributes.get("otb_gradient") or mesh.color_attributes.new("otb_gradient", "FLOAT_COLOR", "CORNER")
    for poly in mesh.polygons:
        ramp = slots.get(poly.material_index)
        for li in poly.loop_indices:
            if ramp is None:
                layer.data[li].color = (1, 1, 1, 1); continue
            axis, colours = ramp
            co = mesh.vertices[mesh.loops[li].vertex_index].co
            t = (co[axis] - (loc[axis] - size[axis])) / (2 * size[axis]) if size[axis] else 0.5
            layer.data[li].color = colours.evaluate(min(1, max(0, t)))

# A shared vertex budget: large parts are decimated together, small details stay as they are.
BUDGET = 40000
def evaluated_vertices(obs):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    counts = {}
    for o in obs:
        ev = o.evaluated_get(depsgraph)
        mesh = ev.to_mesh(); counts[o.name] = len(mesh.vertices); ev.to_mesh_clear()
    return counts
before = evaluated_vertices(model)
total = sum(before.values())
if total > BUDGET:
    # Models made of many small parts (leaves, flowers) lower the size limit until the budget is reachable.
    for threshold in (1500, 600, 250, 100):
        large = {name: n for name, n in before.items() if n > threshold}
        small = total - sum(large.values())
        ratio = (BUDGET - small) / sum(large.values()) if large else 0
        if ratio >= 0.15:
            break
    ratio = min(1, max(0.08, ratio))
    for o in model:
        if o.name in large:
            d = o.modifiers.new("otb_web_decimate", "DECIMATE"); d.ratio = ratio
after = sum(evaluated_vertices(model).values())

bpy.ops.object.select_all(action="DESELECT")
for o in model:
    o.select_set(True)
view_layer.objects.active = model[0]
options = dict(filepath=glb_path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
               export_cameras=False, export_lights=False, export_animations=False, export_extras=False,
               export_vertex_color="MATERIAL", export_texcoords=False)
supported = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
bpy.ops.export_scene.gltf(**{k: v for k, v in options.items() if k in supported})

# Thumbnail from the representative camera, pulled back until the whole model fits, with the same
# simplified geometry and materials the GLB carries.
import math
from mathutils import Vector
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 640, 480, 100
corners = [o.matrix_world @ Vector(c) for o in model for c in o.bound_box]
lo = Vector([min(c[i] for c in corners) for i in range(3)]); hi = Vector([max(c[i] for c in corners) for i in range(3)])
centre, radius = (lo + hi) / 2, (hi - lo).length / 2
hero = scene.camera
if hero:
    # A plain copy: the hero camera may carry keys or constraints that would move it back at render time.
    cam = bpy.data.objects.new("otb_thumbnail_camera", hero.data.copy())
    scene.collection.objects.link(cam)
    cam.matrix_world = hero.matrix_world.copy()
    forward = (cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))).normalized()
    if cam.data.type == "ORTHO":
        cam.data.ortho_scale = 2 * radius * 1.04 * 640 / 480
        distance = radius * 3
    else:
        horizontal = cam.data.angle
        vertical = 2 * math.atan(math.tan(horizontal / 2) * 480 / 640)
        distance = radius / math.sin(min(horizontal, vertical) / 2) * 1.04
    cam.location = centre - forward * distance
    cam.data.clip_start = min(cam.data.clip_start, distance / 100)
    cam.data.clip_end = max(cam.data.clip_end, distance + radius * 4)
    scene.camera = cam
scene.render.engine = "BLENDER_EEVEE"
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.filepath = png_path
bpy.ops.render.render(write_still=True)

print("EXPORT_JSON " + json.dumps({"scene": scene.name, "objects": len(model), "converted": len(to_convert),
      "vertices_before_budget": total, "vertices": after, "size": [round(v, 3) for v in (hi - lo)],
      "camera": scene.camera.name if scene.camera else None, "materials": summary, "gradients": sorted(gradients)}, ensure_ascii=False))
