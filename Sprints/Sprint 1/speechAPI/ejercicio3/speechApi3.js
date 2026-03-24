const OPENROUTER_API_KEY = "<OPENROUTER_API_KEY_AQUI>";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "arcee-ai/trinity-mini:free";

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  console.error("SpeechRecognition no soportado en este navegador");
} else {

  const recognition = new SpeechRecognition();

  recognition.lang = "es-ES";
  recognition.continuous = true;
  recognition.interimResults = true;

  let textoAcumulado = "";
  let silencioTimeout = null;
  const TIEMPO_SILENCIO_MS = 2000;

  recognition.onstart = () => {
    console.log("Escuchando descripción de la habitación...");
  };

  recognition.onresult = (event) => {
    let textoParcial = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      textoParcial += event.results[i][0].transcript;
    }

    textoAcumulado = textoParcial.trim();

    console.clear();
    console.log("Texto detectado (en tiempo real):");
    console.log(textoAcumulado);

    if (silencioTimeout) {
      clearTimeout(silencioTimeout);
    }

    silencioTimeout = setTimeout(() => {
      console.log("\n⏱Silencio detectado (2s)");
      console.log("Descripción final enviada al LLM:");
      console.log(textoAcumulado);

      recognition.stop();
      generarYamlHabitacion(textoAcumulado);

      textoAcumulado = "";
    }, TIEMPO_SILENCIO_MS);
  };

  recognition.onerror = (event) => {
    console.error("Error de reconocimiento:", event.error);
  };

  recognition.onend = () => {
    console.log("Reconocimiento detenido");
  };

  document.getElementById("start").onclick = () => recognition.start();
  document.getElementById("stop").onclick = () => recognition.stop();
}

async function generarYamlHabitacion(descripcion) {

  const prompt = `
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
${descripcion}
`;

  const payload = {
    model: MODEL,
    messages: [
      { role: "user", content: prompt }
    ],
    max_tokens: 3000
  };

  try {
    console.log("\nGenerando YAML con el LLM...");

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error OpenRouter:", errorText);
      return;
    }

    const data = await response.json();
    const yamlGenerado = data.choices[0].message.content;

    try {
        const yamlObj = jsyaml.load(yamlGenerado); // parsea
        const yamlFormateado = jsyaml.dump(yamlObj, { indent: 2 });
        console.log("📄 YAML formateado:");
        console.log(yamlFormateado);
    } catch (err) {
        console.warn("⚠️ No se pudo formatear el YAML:", err);
        console.log(yamlGenerado);
    }


    if (yamlGenerado.trim().startsWith("error:")) {
      console.error("La descripción no corresponde a una habitación");
    }

  } catch (error) {
    console.error("Error de red:", error);
  }
}