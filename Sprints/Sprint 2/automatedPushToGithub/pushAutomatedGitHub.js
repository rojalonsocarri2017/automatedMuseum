
const OPENROUTER_API_KEY = "<OPENROUTER_API_KEY_AQUI>";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "arcee-ai/trinity-mini:free";

// const GITHUB_PAT = "<GITHUB_PAT_AQUI>";
const GITHUB_OWNER = "<GITHUB_OWNER_AQUI>";
const GITHUB_REPO = "<GITHUB_REPO_AQUI>";
const GITHUB_FILE_PATH = "<GITHUB_FILE_PATH_AQUI>";
/*************************************************
 * ELEMENTOS DE UI
 *************************************************/
const statusDiv = document.getElementById("status");
const yamlOutput = document.getElementById("yamlOutput");

let GITHUB_PAT = null;
loadConfig().then(config => {
  GITHUB_PAT = config.GITHUB_PAT;
  console.log('✅ Config cargada');
});
/*************************************************
 * SPEECH RECOGNITION
 *************************************************/
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  console.error("❌ SpeechRecognition no soportado en este navegador");
  statusDiv.textContent = "Estado: No soportado en este navegador";
} else {

  const recognition = new SpeechRecognition();
  recognition.lang = "es-ES";
  recognition.continuous = true;
  recognition.interimResults = true;

  let textoAcumulado = "";
  let silencioTimeout = null;
  const TIEMPO_SILENCIO_MS = 2000;

  recognition.onstart = () => {
    statusDiv.textContent = "Estado: Escuchando...";
    console.log("🎤 Escuchando...");
  };

  recognition.onresult = (event) => {
    let textoParcial = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      textoParcial += event.results[i][0].transcript;
    }
    textoAcumulado = textoParcial.trim();

    console.clear();
    console.log("🎙️ Texto parcial:");
    console.log(textoAcumulado);

    statusDiv.textContent = "Estado: Escuchando...";

    if (silencioTimeout) clearTimeout(silencioTimeout);
    silencioTimeout = setTimeout(() => {
      console.log("⏱️ Silencio detectado (2s)");
      recognition.stop();
      statusDiv.textContent = "Estado: Procesando LLM...";
      generarYamlHabitacion(textoAcumulado);
      textoAcumulado = "";
    }, TIEMPO_SILENCIO_MS);
  };

  recognition.onerror = (event) => {
    console.error("❌ Error reconocimiento:", event.error);
    statusDiv.textContent = `Error: ${event.error}`;
  };

  recognition.onend = () => {
    statusDiv.textContent = "Estado: Inactivo";
    console.log("🛑 Reconocimiento detenido");
  };

  document.getElementById("start").onclick = () => recognition.start();
  document.getElementById("stop").onclick = () => recognition.stop();
}

async function loadConfig() {
  try {
    const envResponse = await fetch('../.env');
    if (envResponse.ok) {
      const envText = await envResponse.text();
      const envVars = parseEnv(envText);
      if (envVars.GITHUB_PAT) return envVars;
    }
  } catch (e) {
    console.log('.env no encontrado (normal si es local)');
  }
  
  const stored = localStorage.getItem('github_pat');
  if (stored) return { GITHUB_PAT: stored };
  
  const token = prompt('Ingresa GitHub PAT (se guarda localmente):');
  if (token) {
    localStorage.setItem('github_pat', token);
    return { GITHUB_PAT: token };
  }
  throw new Error('No hay token disponible');
}

function parseEnv(envText) {
  const config = {};
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = match[2] || '';
      val = val.replace(/\\n/g, '\n');
      config[match[1]] = val.replace(/^['"](.*)['"]$/, '$1');
    }
  });
  return config;
}

async function pushYamlAGithub(yamlContent) {
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
    const base64Content = btoa(unescape(encodeURIComponent(yamlContent))); // Codificación UTF-8 segura

    console.log("📡 Obteniendo info del archivo actual...");
    const getResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `token ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Room-YAML-Generator'
      }
    });

    let sha = null;
    if (getResponse.status === 200) {
      const file = await getResponse.json();
      sha = file.sha;
      console.log("✅ Archivo existe, SHA:", sha);
    } else if (getResponse.status === 404) {
      console.log("✅ Nuevo archivo (no existe)");
    } else {
      throw new Error(`Error GET: ${getResponse.status}`);
    }

    console.log("🚀 Haciendo PUT...");
    const body = {
      message: `Push automático: room.yaml actualizado (${new Date().toISOString()})`,
      content: base64Content,
      sha: sha
    };

    const putResponse = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Room-YAML-Generator'
      },
      body: JSON.stringify(body)
    });

    if (putResponse.ok) {
      const result = await putResponse.json();
      console.log("🎉 ¡¡PUSH EXITOSO!!", result.commit.html_url);
      statusDiv.textContent = `✅ YAML en GitHub: ${result.commit.html_url}`;
      
      yamlOutput.insertAdjacentHTML('afterend', 
        `<div style="margin-top: 10px;"><a href="${result.content.html_url}" target="_blank">📂 Ver en GitHub</a></div>`
      );
    } else {
      const error = await putResponse.json();
      throw new Error(`PUT falló: ${putResponse.status} - ${error.message}`);
    }

  } catch (error) {
    console.error("💥 Error GitHub:", error);
    statusDiv.textContent = `❌ GitHub Error: ${error.message}`;
  }
}

/*************************************************
 * GENERAR YAML CON LLM
 *************************************************/
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
- Las coordenadas del entrypoint x, y, z no pueden ir entre comillas simples ni dobles. Importante esto
- Respeta las tabulaciones y indentaciones de los ejemplos

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

Otra entrada, si no te especifican nada de la habitacion, devuelve este yaml literal:
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
    messages: [{ role: "user", content: prompt }],
    max_tokens: 3000
  };

  try {
    console.log("🤖 Generando YAML...");
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    let yamlGenerado = data.choices[0].message.content;

    // Formatear YAML con js-yaml
    try {
      const yamlObj = jsyaml.load(yamlGenerado);
      yamlGenerado = jsyaml.dump(yamlObj, { indent: 2 });
    } catch (err) {
      console.warn("⚠️ No se pudo formatear YAML, se usa tal cual");
    }

    console.log("📄 YAML generado:");
    console.log(yamlGenerado);

    yamlOutput.textContent = yamlGenerado;

    // Descargar archivo room.yaml
    descargarYaml(yamlGenerado);

    // Push a GitHub
    statusDiv.textContent = "Estado: Haciendo push a GitHub...";
    await pushYamlAGithub(yamlGenerado);

  } catch (err) {
    console.error("❌ Error generando YAML:", err);
    statusDiv.textContent = "Error generando YAML";
  }
}

function descargarYaml(yamlFormateado) {
  const blob = new Blob([yamlFormateado], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "room.yaml";
  a.click();
  URL.revokeObjectURL(url);
}
