import requests
import os
import sys

API_URL = "https://openrouter.ai/api/v1/chat/completions"

def generar_yaml(descripcion):
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("ERROR: No se ha encontrado la variable OPENROUTER_API_KEY")
        sys.exit(1)

    prompt = f"""
Eres un sistema que convierte descripciones de habitaciones en YAML.
Si la entrada NO describe una habitación o un espacio físico,
devuelve exactamente este YAML y nada más:
error:
  message: "La descripción no corresponde a una habitación"

IMPORTANTE:
- El campo "lights" debe estar SIEMPRE al mismo nivel que "environment"
- Nunca anides "lights" dentro de "environment"
- No añadas campos que no estén definidos en el esquema

Debes generar SIEMPRE un YAML con la siguiente estructura exacta:

room:
  width: number
  depth: number
  height: number
  ceiling: boolean

  walls:
    north: barrier|wall|glass
    east: barrier|wall|glass
    south: barrier|wall|glass
    west: barrier|wall|glass

  textures:
    floor: string
    wall: string
    ceiling: string

  entryPoint:
    x: number
    y: number
    z: number

  environment:
    skyColor: string
    stars: boolean

  lights:
    - type: ambient
      color: string
      intensity: number

Ejemplo:

Entrada:
Habitación rectangular con techo, 200x300x100, pared norte como barrera, pared este de cristal, suelo de madera, paredes decoradas, cielo oscuro con estrellas y dos luces ambientales.

Salida:
room:
  width: 200
  depth: 300
  height: 100
  ceiling: true

  walls:
    north: barrier
    east: glass
    south: wall
    west: wall

  textures:
    floor: assets/floor-texture.jpg
    wall: assets/jeroglifico.jpg
    ceiling: assets/jeroglifico.jpg

  entryPoint:
    x: -10
    y: 2
    z: 20

  environment:
    skyColor: "#000000"
    stars: true

  lights:
    - type: ambient
      color: "#ffffff"
      intensity: 0.85
    - type: ambient
      color: "#ebd9e9"
      intensity: 0.3

Si alguna información no se menciona, usa valores razonables por defecto.
Ahora convierte la siguiente descripción.
Devuelve SOLO el YAML, sin explicaciones.

Entrada:
{descripcion}

"""

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        # "model": "openrouter/auto",
        "model": "arcee-ai/trinity-mini:free",
        "messages": [
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 3000
    }

    response = requests.post(API_URL, headers=headers, json=payload)

    if response.status_code != 200:
        print("Error en la llamada a la API:")
        print(response.text)
        sys.exit(1)

    data = response.json()
    return data["choices"][0]["message"]["content"]


if __name__ == "__main__":
    descripcion_usuario = input("Describe la habitación: ")
    yaml_generado = generar_yaml(descripcion_usuario)

    if yaml_generado.strip().startswith("error:"):
        print("ERROR: La descripción no corresponde a una habitación. No se ha generado ningún YAML.")
    else:
        output_file = "llm_result_yaml.yaml"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(yaml_generado)
        print(f"\nYAML generado y guardado en '{output_file}'")
