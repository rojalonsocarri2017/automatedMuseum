from pathlib import Path
import yaml

BASE_DIR = Path(__file__).resolve().parent
ROOM_YAML = BASE_DIR / "room.yaml"
OUTPUT_HTML = BASE_DIR / "index.html"

# Catálogo mínimo de modelos 3D
MODEL_CATALOG = {
    "chair_basic": "./assets/models/furniture/chair_basic.glb",
    "table_red": "./assets/models/furniture/table_red.glb",
    "lamp_floor": "./assets/models/furniture/lamp_floor.glb",
    "statue_liberty": "./assets/models/statues/statue_liberty.glb",
    "statue_venus": "./assets/models/statues/statue_venus.glb",
}

def vec3_to_str(v, default=(0, 0, 0)):
    if not isinstance(v, dict):
        return f"{default[0]} {default[1]} {default[2]}"
    return f"{v.get('x', default[0])} {v.get('y', default[1])} {v.get('z', default[2])}"

# Cargar YAML
with ROOM_YAML.open(encoding="utf-8") as f:
    datos = yaml.safe_load(f)

h = datos["room"]

# Luces
luces_html = ""
for light in h.get("lights", []):
    luces_html += f"""
      <a-entity light="type: {light["type"]};
                       color: {light["color"]};
                       intensity: {light["intensity"]}">
      </a-entity>
"""

# Entorno
entorno_html = ""
env = h.get("environment", {})
if env.get("skyColor"):
    entorno_html += f'      <a-sky color="{env["skyColor"]}"></a-sky>\n'
if env.get("stars"):
    entorno_html += '      <a-entity star-sky></a-entity>\n'

# Objetos
objetos_html = ""
for obj in h.get("objects", []):
    name = obj.get("name", "objeto")
    position = vec3_to_str(obj.get("position"), (0, 0, 0))
    rotation = vec3_to_str(obj.get("rotation"), (0, 0, 0))
    scale = vec3_to_str(obj.get("scale"), (1, 1, 1))

    # Primitivas A-Frame
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
            objetos_html += f"""
      <a-entity id="{name}"
                geometry="{geometry}"
                material="color: {color}"
                position="{position}"
                rotation="{rotation}"
                scale="{scale}">
      </a-entity>
"""
        continue

    # Modelos 3D
    if "model" in obj:
        model_name = obj["model"]
        model_path = MODEL_CATALOG.get(model_name)

        if model_path:
            objetos_html += f"""
      <a-entity id="{name}"
                gltf-model="{model_path}"
                position="{position}"
                rotation="{rotation}"
                scale="{scale}">
      </a-entity>
"""

# HTML final
html = f"""<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Museo VR</title>

    <script src="https://aframe.io/releases/1.2.0/aframe.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/aframe-extras@6.1.1/dist/aframe-extras.min.js"></script>

    <script src="../components/aframe-lounge.js"></script>
    <script src="../components/star-sky.js"></script>
  </head>

  <body>
    <a-scene antialias="true">

      {luces_html}

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
          id="camera1"
          camera
          position="{h['entryPoint']['x']} {h['entryPoint']['y']} {h['entryPoint']['z']}"
          look-controls
          wasd-controls>
        </a-entity>
      </a-entity>

{objetos_html}

      {entorno_html}

    </a-scene>
  </body>
</html>
"""

with OUTPUT_HTML.open("w", encoding="utf-8") as f:
    f.write(html)

print(f"index.html generado correctamente en {OUTPUT_HTML}")