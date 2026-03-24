from pathlib import Path
import yaml

BASE_DIR = Path(__file__).resolve().parent
ROOM_YAML = BASE_DIR / "room.yaml"
OUTPUT_HTML = BASE_DIR / "index.html"

MODEL_CATALOG = {
    "chair_basic": {
        "src": "./assets/models/furniture/chair_basic.glb",
        "floorOffset": 8,
        "scale": {"x": 1, "y": 1, "z": 1}
    },
    "table_red": {
        "src": "./assets/models/furniture/table_red.glb",
        "floorOffset": -6,
        "scale": {"x": 1, "y": 1, "z": 1}
    },
    "lamp_floor": {
        "src": "./assets/models/furniture/lamp_floor.glb",
        "floorOffset": 7,
        "scale": {"x": 6, "y": 6, "z": 6}
    },
    "statue_liberty": {
        "src": "./assets/models/statues/statue_liberty.glb",
        "floorOffset": 0,
        "scale": {"x": 6, "y": 6, "z": 6}
    },
    "statue_venus": {
        "src": "./assets/models/statues/statue_venus.glb",
        "floorOffset": 0,
        "scale": {"x": 15, "y": 15, "z": 15}
    }
}

PRIMITIVE_GEOMETRY_MAP = {
    "box": "primitive: box",
    "sphere": "primitive: sphere",
    "cylinder": "primitive: cylinder",
    "cone": "primitive: cone",
    "plane": "primitive: plane",
    "circle": "primitive: circle",
    "torus": "primitive: torus",
}


def vec3_dict(v, default=(0, 0, 0)):
    if not isinstance(v, dict):
        return {"x": default[0], "y": default[1], "z": default[2]}
    return {
        "x": v.get("x", default[0]),
        "y": v.get("y", default[1]),
        "z": v.get("z", default[2]),
    }


def vec3_str(x, y, z):
    return f"{x} {y} {z}"


def scale_str(scale_dict):
    return f'{scale_dict["x"]} {scale_dict["y"]} {scale_dict["z"]}'


with ROOM_YAML.open(encoding="utf-8") as f:
    data = yaml.safe_load(f)

room = data["room"]
floor_y = -room["height"] / 2

# =========================
# LIGHTS
# =========================
lights_html = ""
for light in room.get("lights", []):
    light_type = light.get("type", "ambient")
    color = light.get("color", "#ffffff")
    intensity = light.get("intensity", 1)
    lights_html += f"""
      <a-entity light="type: {light_type};
                       color: {color};
                       intensity: {intensity}">
      </a-entity>
"""

# =========================
# ENVIRONMENT
# =========================
environment_html = ""
env = room.get("environment", {})

if env.get("skyColor"):
    environment_html += f'      <a-sky color="{env["skyColor"]}"></a-sky>\n'

if env.get("stars"):
    environment_html += '      <a-entity star-sky></a-entity>\n'

# =========================
# OBJECTS
# =========================
objects_html = ""

for obj in room.get("objects", []):
    name = obj.get("name", "object")
    pos = vec3_dict(obj.get("position"), (0, 0, 0))
    rot = vec3_dict(obj.get("rotation"), (0, 0, 0))
    scl = vec3_dict(obj.get("scale"), (1, 1, 1))

    # PRIMITIVES
    if "primitive" in obj:
        primitive = obj["primitive"]
        geometry = PRIMITIVE_GEOMETRY_MAP.get(primitive)
        color = obj.get("color", "#ffffff")

        if geometry:
            final_y = floor_y + pos["y"]

            objects_html += f"""
      <a-entity id="{name}"
                geometry="{geometry}"
                material="color: {color}"
                position="{vec3_str(pos["x"], final_y, pos["z"])}"
                rotation="{vec3_str(rot["x"], rot["y"], rot["z"])}"
                scale="{vec3_str(scl["x"], scl["y"], scl["z"])}">
      </a-entity>
"""
        continue

    # 3D MODELS
    if "model" in obj:
        model_name = obj["model"]
        model_entry = MODEL_CATALOG.get(model_name)

        if model_entry:
            base_scale = model_entry.get("scale", {"x": 1, "y": 1, "z": 1})
            floor_offset = model_entry.get("floorOffset", 0)

            final_y = floor_y + floor_offset + pos["y"]

            final_scale = {
                "x": base_scale["x"] * scl["x"],
                "y": base_scale["y"] * scl["y"],
                "z": base_scale["z"] * scl["z"],
            }

            objects_html += f"""
      <a-entity id="{name}"
                gltf-model="{model_entry["src"]}"
                position="{vec3_str(pos["x"], final_y, pos["z"])}"
                rotation="{vec3_str(rot["x"], rot["y"], rot["z"])}"
                scale="{scale_str(final_scale)}">
      </a-entity>
"""

# =========================
# CAMERA
# =========================
entry = room.get("entryPoint", {"x": 0, "y": 2, "z": 0})

# Igual que en room-renderer:
# y = -room.height / 2 + 5
camera_x = entry.get("x", 0)
camera_y = -room["height"] / 2 + 5
camera_z = entry.get("z", 0)

# =========================
# HTML
# =========================
html = f"""<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Museo VR</title>

    <script src="https://aframe.io/releases/1.2.0/aframe.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/aframe-extras@6.1.1/dist/aframe-extras.min.js"></script>

    <script src="./components/aframe-lounge.js"></script>
    <script src="./components/star-sky.js"></script>
  </head>

  <body>
    <a-scene antialias="true">

{lights_html}
      <a-entity id="lounge"
        lounge="
          width: {room['width']};
          depth: {room['depth']};
          height: {room['height']};
          ceiling: {str(room['ceiling']).lower()};
          north: {room['walls']['north']};
          east: {room['walls']['east']};
          south: {room['walls']['south']};
          west: {room['walls']['west']};
          floorTexture: {room['textures']['floor']};
          wallTexture: {room['textures']['wall']};
          ceilingTexture: {room['textures']['ceiling']};
        ">
      </a-entity>

      <a-entity lounge-entry-point>
        <a-entity
          id="camera1"
          camera
          position="{camera_x} {camera_y} {camera_z}"
          look-controls
          wasd-controls>
        </a-entity>
      </a-entity>

{objects_html}
{environment_html}
    </a-scene>
  </body>
</html>
"""

with OUTPUT_HTML.open("w", encoding="utf-8") as f:
    f.write(html)

print("index.html generado correctamente")
