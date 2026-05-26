import yaml

# Cargar YAML
with open("room.yaml") as f:
    datos = yaml.safe_load(f)

h = datos["room"]

# Luces
luces_html = ""
for light in h.get("lights", []):
    luces_html += f'''
    <a-entity light="type: {light["type"]};
                     color: {light["color"]};
                     intensity: {light["intensity"]}">
    </a-entity>
    '''

# Entorno
entorno_html = ""
env = h.get("environment", {})
if env.get("skyColor"):
    entorno_html += f'<a-sky color="{env["skyColor"]}"></a-sky>\n'
if env.get("stars"):
    entorno_html += '<a-entity star-sky></a-entity>\n'

# HTML final
html = f"""
<!DOCTYPE html>
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

      {entorno_html}

    </a-scene>
  </body>
</html>
"""

with open("index.html", "w") as f:
    f.write(html)

print("index.html generado correctamente")
