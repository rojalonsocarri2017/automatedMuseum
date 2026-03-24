from pathlib import Path
import yaml

BASE_DIR = Path(__file__).resolve().parent
ROOM_YAML = BASE_DIR / "room.yaml"
OUTPUT_HTML = BASE_DIR / "index.html"

MODEL_CATALOG = {
    "chair_basic": {
        "src": "./assets/models/furniture/chair_basic.glb",
        "scale": {"x": 1, "y": 1, "z": 1},
        "floorOffset": 0
    },
    "table_red": {
        "src": "./assets/models/furniture/table_red.glb",
        "scale": {"x": 1, "y": 1, "z": 1},
        "floorOffset": 0
    },
    "lamp_floor": {
        "src": "./assets/models/furniture/lamp_floor.glb",
        "scale": {"x": 1, "y": 1, "z": 1},
        "floorOffset": 0
    },
    "statue_liberty": {
        "src": "./assets/models/statues/statue_liberty.glb",
        "scale": {"x": 1, "y": 1, "z": 1},
        "floorOffset": 0
    },
    "statue_venus": {
        "src": "./assets/models/statues/statue_venus.glb",
        "scale": {"x": 1, "y": 1, "z": 1},
        "floorOffset": 0
    },
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


with ROOM_YAML.open(encoding="utf-8") as f:
    data = yaml.safe_load(f)

h = data["room"]
floor_y = -h["height"] / 2


lights_html = ""
for light in h.get("lights", []):
    lights_html += f"""
      <a-entity light="type: {light["type"]};
                       color: {light["color"]};
                       intensity: {light["intensity"]}">
      </a-entity>
"""


env_html = ""
env = h.get("environment", {})

if env.get("skyColor"):
    env_html += f'      <a-sky color="{env["skyColor"]}"></a-sky>\n'

if env.get("stars"):
    env_html += '      <a-entity star-sky></a-entity>\n'


objects_html = ""

for obj in h.get("objects", []):
    name = obj.get("name", "object")
    pos = vec3_dict(obj.get("position"), (0, 0, 0))
    rot = vec3_dict(obj.get("rotation"), (0, 0, 0))
    scl = vec3_dict(obj.get("scale"), (1, 1, 1))

    # PRIMITIVES
    if "primitive" in obj:
        primitive = obj["primitive"]
        color = obj.get("color", "#ffffff")

        geometry_map = {
            "box": "primitive: box",
            "sphere": "primitive: sphere",
            "cylinder": "primitive: cylinder",
            "cone": "primitive: cone",
            "plane": "primitive: plane",
            "circle": "primitive: circle",
            "torus": "primitive: torus",
        }

        geometry = geometry_map.get(primitive)

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

    # MODELS
    if "model" in obj:
        model_name = obj["model"]
        model_entry = MODEL_CATALOG.get(model_name)

        if model_entry:
            base_scale = model_entry.get("scale", {"x": 1, "y": 1, "z": 1})
            floor_offset = model_entry.get("floorOffset", 0)

            final_y = floor_y + floor_offset + pos["y"]
            final_scale = vec3_str(
                base_scale["x"] * scl["x"],
                base_scale["y"] * scl["y"],
                base_scale["z"] * scl["z"]
            )

            objects_html += f"""
      <a-entity id="{name}"
                gltf-model="{model_entry["src"]}"
                position="{vec3_str(pos["x"], final_y, pos["z"])}"
                rotation="{vec3_str(rot["x"], rot["y"], rot["z"])}"
                scale="{final_scale}">
      </a-entity>
"""


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
          width: {h['width']};
          depth: {h['depth']};
          height: {h['height']};
          ceiling: {str(h['ceiling']).lower()};
          north: {h['walls']['north']};
          east: {h['walls']['east']};
          south: {h['walls']['south']};
          west: {h['walls']['west']};
          floorTexture: {h['textures']['floor']};
          wallTexture: {h['textures']['wall']};
          ceilingTexture: {h['textures']['ceiling']};
        ">
      </a-entity>

      <a-entity lounge-entry-point>
        <a-entity
          camera
          position="{h['entryPoint']['x']} {h['entryPoint']['y']} {h['entryPoint']['z']}"
          look-controls
          wasd-controls>
        </a-entity>
      </a-entity>

{objects_html}

      {env_html}

    </a-scene>
  </body>
</html>
"""

with OUTPUT_HTML.open("w", encoding="utf-8") as f:
    f.write(html)

print("index.html generado correctamente")
