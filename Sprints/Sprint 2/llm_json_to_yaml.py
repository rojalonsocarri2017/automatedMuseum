import requests
import os
import sys
import json
import yaml

API_URL = "https://openrouter.ai/api/v1/chat/completions"

def generar_json(descripcion):
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("ERROR: No se ha encontrado la variable OPENROUTER_API_KEY")
        sys.exit(1)

    prompt = f"""
Eres un sistema que convierte descripciones de habitaciones en JSON.
Si la entrada NO describe una habitación o un espacio físico,
devuelve exactamente este JSON y nada más:

{{
  "error": {{
    "message": "La descripción no corresponde a una habitación"
  }}
}}

IMPORTANTE:
- Devuelve SOLO JSON válido, sin explicaciones ni texto adicional.
- Si algún valor no se menciona en la descripción, usa valores razonables por defecto.
- Respeta exactamente la estructura del esquema:

{{
  "room": {{
    "width": number,
    "depth": number,
    "height": number,
    "ceiling": boolean,
    "walls": {{
      "north": "barrier|wall|glass",
      "east": "barrier|wall|glass",
      "south": "barrier|wall|glass",
      "west": "barrier|wall|glass"
    }},
    "textures": {{
      "floor": string,
      "wall": string,
      "ceiling": string
    }},
    "entryPoint": {{
      "x": number,
      "y": number,
      "z": number
    }},
    "environment": {{
      "skyColor": string,
      "stars": boolean
    }},
    "lights": [
      {{"type": "ambient", "color": string, "intensity": number}}
    ]
  }}
}}

Ejemplo de uso:

Entrada:
Habitación rectangular con techo, 200x300x100, pared norte como barrera, pared este de cristal, suelo de madera, paredes decoradas, cielo oscuro con estrellas y dos luces ambientales.

Salida JSON:
{{
  "room": {{
    "width": 200,
    "depth": 300,
    "height": 100,
    "ceiling": true,
    "walls": {{
      "north": "barrier",
      "east": "glass",
      "south": "wall",
      "west": "wall"
    }},
    "textures": {{
      "floor": "assets/floor-texture.jpg",
      "wall": "assets/jeroglifico.jpg",
      "ceiling": "assets/jeroglifico.jpg"
    }},
    "entryPoint": {{
      "x": -10,
      "y": 2,
      "z": 20
    }},
    "environment": {{
      "skyColor": "#000000",
      "stars": true
    }},
    "lights": [
      {{"type": "ambient", "color": "#ffffff", "intensity": 0.85}},
      {{"type": "ambient", "color": "#ebd9e9", "intensity": 0.3}}
    ]
  }}
}}
Ahora convierte la siguiente descripción:

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
        "max_tokens": 2000
    }

    response = requests.post(API_URL, headers=headers, json=payload)

    if response.status_code != 200:
        print("Error en la llamada a la API:")
        print(response.text)
        sys.exit(1)

    data = response.json()
    json_str = data["choices"][0]["message"]["content"]

    try:
        parsed_json = json.loads(json_str)
    except json.JSONDecodeError:
        print("ERROR: La API devolvió texto que no es JSON válido")
        print(json_str)
        sys.exit(1)

    return parsed_json

if __name__ == "__main__":
    descripcion_usuario = input("Describe la habitación: ")
    result_json = generar_json(descripcion_usuario)

    if "error" in result_json:
        print("ERROR:", result_json["error"]["message"])
        sys.exit(1)

    output_json_file = "llm_result_json.json"
    with open(output_json_file, "w", encoding="utf-8") as f:
        json.dump(result_json, f, indent=2, ensure_ascii=False)
    print(f"JSON generado y guardado en '{output_json_file}'")

    output_yaml_file = "llm_result_json_to_yaml.yaml"
    with open(output_yaml_file, "w", encoding="utf-8") as f:
        yaml.dump(result_json, f, sort_keys=False, allow_unicode=True)
    print(f"YAML generado y guardado en '{output_yaml_file}'")
